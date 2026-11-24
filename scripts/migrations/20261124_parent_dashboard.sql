-- scripts/migrations/20261124_parent_dashboard.sql
--
-- Parent dashboard ("Mode Orang Tua").
--
--  * New organization role 'parent'. A parent is an organization member so the
--    existing tenant / login routing keeps working, but is NOT staff: every
--    staff-facing RLS helper is tightened so a parent can never read or write
--    student, report or counselling data directly. Parents only ever see data
--    through the server-side parent dashboard, which reads a fixed set of
--    columns after checking parent_student_links.
--  * students.parent_code: a per-student pairing code the school hands to the
--    parent. A parent signs up with >= 1 code (more can be added later).
--  * parent_student_links: which parent account is paired with which student.
--  * parent_contents: everything a parent can read (update cards, periodic
--    summaries, character profile). Each row starts as an AI DRAFT and is only
--    visible to parents after the student's musyrif approves it. Audit trail in
--    parent_content_audit.
--  * parent_content_reads / parent_questions: light parent responses.
--  * parent_home_profiles: context the parents fill in at home (two-way).
--  * parent_consents / parent_access_log: privacy.
--
-- Idempotent. Run once in the Supabase SQL editor.

BEGIN;

-- ─── 1. Role ────────────────────────────────────────────────────────────────

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.organization_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.organization_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'ustadz', 'parent'));

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'ustadz', 'parent')) NOT VALID;

-- ─── 2. Keep parents out of every staff policy ──────────────────────────────

-- "Member" now means staff. Everything that used is_organization_member
-- (cross-assignment reports, RAG, BK monthly summaries, usage, ...) therefore
-- excludes parents without each policy having to change.
CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND om.role <> 'parent'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_parent(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND om.role = 'parent'
  );
$$;

-- Staff can see staff profiles only; parents are not visible to colleagues.
CREATE OR REPLACE FUNCTION public.is_same_organization_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members mine
    JOIN public.organization_members theirs
      ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = auth.uid()
      AND mine.role <> 'parent'
      AND theirs.user_id = target_user_id
      AND (theirs.role <> 'parent' OR mine.role IN ('owner', 'admin'))
  );
$$;

-- Members may pick their own app_mode (setUserAppMode). A parent must not be
-- able to become a "BK counselor" that way.
CREATE OR REPLACE FUNCTION public.is_bk_counselor(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND om.app_mode = 'bp'
      AND om.role <> 'parent'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_organization_parent(UUID) TO authenticated;

-- A parent can read their own membership and the organization row (name/logo),
-- which the login/tenant routing needs. The old policies required staff.
DROP POLICY IF EXISTS "Users can read their own memberships" ON public.organization_members;
CREATE POLICY "Users can read their own memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Parents can read their organization" ON public.organizations;
CREATE POLICY "Parents can read their organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_organization_parent(id));

-- New auth users are auto-enrolled in the default organization as staff.
-- Parents are enrolled explicitly by the parent sign-up route instead.
CREATE OR REPLACE FUNCTION public.ensure_default_organization_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id UUID;
  member_role TEXT;
BEGIN
  IF NEW.role = 'parent' THEN
    RETURN NEW;
  END IF;

  -- Someone who signed up with Google (parent flow) is not staff: they are
  -- enrolled explicitly once they pair a child code. Staff accounts are created
  -- by admins with email + password.
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id
      AND COALESCE(u.raw_app_meta_data->>'provider', 'email') <> 'email'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'sekolahimpian';

  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization with slug sekolahimpian was not found';
  END IF;

  member_role := CASE
    WHEN NEW.role IN ('owner', 'admin') THEN NEW.role
    ELSE 'ustadz'
  END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (default_org_id, NEW.id, member_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET organization_id = default_org_id
  WHERE id = NEW.id
    AND organization_id IS NULL;

  RETURN NEW;
END;
$$;

-- ─── 3. Pairing codes ───────────────────────────────────────────────────────

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_code TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as
-- XXXX-XXXX. ~1e12 combinations, so codes cannot be guessed by brute force.
CREATE OR REPLACE FUNCTION public.generate_parent_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes BYTEA := gen_random_bytes(8);
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 0..7 LOOP
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    IF i = 3 THEN result := result || '-'; END IF;
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.students_assign_parent_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_code IS NULL THEN
    NEW.parent_code := public.generate_parent_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_assign_parent_code ON public.students;
CREATE TRIGGER students_assign_parent_code
  BEFORE INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_assign_parent_code();

UPDATE public.students SET parent_code = public.generate_parent_code() WHERE parent_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_parent_code_key ON public.students (parent_code);

-- ─── 4. Parent <-> student links ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS parent_student_links_student_idx ON public.parent_student_links (student_id);
CREATE INDEX IF NOT EXISTS parent_student_links_org_idx ON public.parent_student_links (organization_id);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

-- Writes happen only through the server (service role). Parents read their own
-- links; organization admins read their school's links.
DROP POLICY IF EXISTS "Parents read own links" ON public.parent_student_links;
CREATE POLICY "Parents read own links"
  ON public.parent_student_links FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "Admins read organization links" ON public.parent_student_links;
CREATE POLICY "Admins read organization links"
  ON public.parent_student_links FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id));

-- ─── 5. Parent-facing content (approval gate) ──────────────────────────────

-- content_type:
--   update  one card per report and kind (kabar_baik | didampingi)
--   summary one per student per period_key ('YYYY-MM')
--   profile one per student (strength-based profile + "cara terbaik mendampingi")
-- draft    = what the AI wrote (never edited)
-- content  = what parents see once status = 'published' (musyrif may edit it)
-- Corrections to something already published insert a NEW row in the same chain
-- (version + 1); the old row becomes 'superseded' and stays as history.
CREATE TABLE IF NOT EXISTS public.parent_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  content_type TEXT NOT NULL CHECK (content_type IN ('update', 'summary', 'profile')),
  kind TEXT CHECK (kind IN ('kabar_baik', 'didampingi')),
  aspect TEXT CHECK (aspect IN ('karakter', 'mental', 'soft_skill')),
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  period_key TEXT,
  draft JSONB NOT NULL,
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'published', 'superseded')),
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  sensitive_reason TEXT,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS parent_contents_student_idx ON public.parent_contents (student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS parent_contents_org_status_idx ON public.parent_contents (organization_id, status);
CREATE INDEX IF NOT EXISTS parent_contents_chain_idx ON public.parent_contents (chain_id, version);

-- One open draft and one published row per logical slot.
CREATE UNIQUE INDEX IF NOT EXISTS parent_contents_open_slot
  ON public.parent_contents (student_id, content_type, COALESCE(period_key, ''), COALESCE(report_id::text, ''), COALESCE(kind, ''))
  WHERE status IN ('pending', 'held');
CREATE UNIQUE INDEX IF NOT EXISTS parent_contents_published_slot
  ON public.parent_contents (student_id, content_type, COALESCE(period_key, ''), COALESCE(report_id::text, ''), COALESCE(kind, ''))
  WHERE status = 'published';

DROP TRIGGER IF EXISTS parent_contents_updated_at ON public.parent_contents;
CREATE TRIGGER parent_contents_updated_at
  BEFORE UPDATE ON public.parent_contents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.parent_content_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.parent_contents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('generated', 'approve', 'edit_approve', 'hold', 'release', 'correct', 'hide')),
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parent_content_audit_content_idx ON public.parent_content_audit (content_id, created_at);

-- Parent responses.
CREATE TABLE IF NOT EXISTS public.parent_content_reads (
  content_id UUID NOT NULL REFERENCES public.parent_contents(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reaction TEXT CHECK (reaction IN ('thanks')),
  PRIMARY KEY (content_id, parent_id)
);

-- One question per card per parent, not a free chat.
CREATE TABLE IF NOT EXISTS public.parent_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.parent_contents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, parent_id)
);

-- "Profil dari rumah": interests, habits and important notes from each guardian.
CREATE TABLE IF NOT EXISTS public.parent_home_profiles (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  interests TEXT NOT NULL DEFAULT '',
  habits TEXT NOT NULL DEFAULT '',
  important_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, parent_id)
);

-- Consent to use of the child's data, versioned.
CREATE TABLE IF NOT EXISTS public.parent_consents (
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_id, version)
);

CREATE TABLE IF NOT EXISTS public.parent_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  section TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parent_access_log_org_idx ON public.parent_access_log (organization_id, created_at DESC);

ALTER TABLE public.parent_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_content_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_content_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_home_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_access_log ENABLE ROW LEVEL SECURITY;

-- Staff reads (is_assigned_student = the student's musyrif or an org admin).
-- All WRITES go through server actions with the service role after an explicit
-- check, so there are no client write policies at all.
DROP POLICY IF EXISTS "Musyrif read parent contents" ON public.parent_contents;
CREATE POLICY "Musyrif read parent contents"
  ON public.parent_contents FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id) OR public.is_assigned_student(student_id));

DROP POLICY IF EXISTS "Musyrif read parent audit" ON public.parent_content_audit;
CREATE POLICY "Musyrif read parent audit"
  ON public.parent_content_audit FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Musyrif read parent questions" ON public.parent_questions;
CREATE POLICY "Musyrif read parent questions"
  ON public.parent_questions FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id) OR public.is_assigned_student(student_id));

DROP POLICY IF EXISTS "Musyrif read home profiles" ON public.parent_home_profiles;
CREATE POLICY "Musyrif read home profiles"
  ON public.parent_home_profiles FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id) OR public.is_assigned_student(student_id));

DROP POLICY IF EXISTS "Admins read parent access log" ON public.parent_access_log;
CREATE POLICY "Admins read parent access log"
  ON public.parent_access_log FOR SELECT TO authenticated
  USING (public.is_organization_admin(organization_id));

GRANT ALL ON public.parent_student_links, public.parent_contents, public.parent_content_audit,
  public.parent_content_reads, public.parent_questions, public.parent_home_profiles,
  public.parent_consents, public.parent_access_log
  TO authenticated, service_role;

COMMIT;
