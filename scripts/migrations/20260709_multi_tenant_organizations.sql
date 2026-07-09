-- Multi-tenant organization migration for CIA Portal.
--
-- Target:
--   One deployment, one PostgreSQL database, many pesantren organizations.
--   Tenant isolation is enforced with organization_id + Supabase RLS.
--
-- Existing rows are preserved and assigned to "Sekolah Impian".

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'ustadz')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.organizations (name, slug)
VALUES ('Sekolah Impian', 'sekolah-impian')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = NOW();

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.student_scores
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
UPDATE public.students
SET organization_id = (SELECT id FROM default_org)
WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
UPDATE public.reports r
SET organization_id = COALESCE(s.organization_id, (SELECT id FROM default_org))
FROM public.students s
WHERE r.student_id = s.id
  AND r.organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
UPDATE public.reports
SET organization_id = (SELECT id FROM default_org)
WHERE organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
UPDATE public.student_scores ss
SET organization_id = COALESCE(s.organization_id, (SELECT id FROM default_org))
FROM public.students s
WHERE ss.student_id = s.id
  AND ss.organization_id IS NULL;

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
UPDATE public.student_scores
SET organization_id = (SELECT id FROM default_org)
WHERE organization_id IS NULL;

ALTER TABLE public.students
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.reports
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.student_scores
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS students_organization_id_idx
  ON public.students (organization_id);

CREATE INDEX IF NOT EXISTS reports_organization_id_idx
  ON public.reports (organization_id);

CREATE INDEX IF NOT EXISTS reports_student_org_idx
  ON public.reports (student_id, organization_id);

CREATE INDEX IF NOT EXISTS student_scores_organization_id_idx
  ON public.student_scores (organization_id);

CREATE INDEX IF NOT EXISTS student_scores_student_org_idx
  ON public.student_scores (student_id, organization_id);

CREATE INDEX IF NOT EXISTS organization_members_user_id_idx
  ON public.organization_members (user_id);

CREATE INDEX IF NOT EXISTS organization_members_org_role_idx
  ON public.organization_members (organization_id, role);

WITH default_org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT
  default_org.id,
  p.id,
  CASE
    WHEN p.role = 'admin' THEN 'admin'
    ELSE 'ustadz'
  END
FROM public.profiles p
CROSS JOIN default_org
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

WITH first_admin AS (
  SELECT om.id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE o.slug = 'sekolah-impian'
    AND om.role = 'admin'
  ORDER BY om.created_at ASC
  LIMIT 1
)
UPDATE public.organization_members om
SET role = 'owner'
FROM first_admin
WHERE om.id = first_admin.id;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    om.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.organization_role(target_organization_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.role
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = target_organization_id
  LIMIT 1;
$$;

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
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_admin(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.organization_role(target_organization_id) IN ('owner', 'admin');
$$;

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
      AND theirs.user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_student(target_student_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = target_student_id
      AND s.organization_id IN (
        SELECT om.organization_id
        FROM public.organization_members om
        WHERE om.user_id = auth.uid()
      )
      AND (
        public.is_organization_admin(s.organization_id)
        OR s.assigned_ustadz_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.set_student_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed for students';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_organization_id();
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'No organization membership found for current user';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_organization_member(NEW.organization_id) THEN
    RAISE EXCEPTION 'Current user is not a member of organization %', NEW.organization_id;
  END IF;

  IF NEW.assigned_ustadz_id IS NOT NULL THEN
    SELECT om.organization_id INTO org_id
    FROM public.organization_members om
    WHERE om.user_id = NEW.assigned_ustadz_id
      AND om.organization_id = NEW.organization_id
    LIMIT 1;

    IF org_id IS NULL THEN
      RAISE EXCEPTION 'assigned_ustadz_id must belong to the same organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_report_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_org_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed for reports';
  END IF;

  SELECT s.organization_id INTO student_org_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF student_org_id IS NULL THEN
    RAISE EXCEPTION 'Report student does not exist';
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := student_org_id;
  END IF;

  IF NEW.organization_id <> student_org_id THEN
    RAISE EXCEPTION 'Report organization must match student organization';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_assigned_student(NEW.student_id) THEN
    RAISE EXCEPTION 'Current user cannot write reports for this student';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_score_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_org_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed for student_scores';
  END IF;

  SELECT s.organization_id INTO student_org_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF student_org_id IS NULL THEN
    RAISE EXCEPTION 'Score student does not exist';
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := student_org_id;
  END IF;

  IF NEW.organization_id <> student_org_id THEN
    RAISE EXCEPTION 'Score organization must match student organization';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_assigned_student(NEW.student_id) THEN
    RAISE EXCEPTION 'Current user cannot write scores for this student';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_set_organization_id ON public.students;
CREATE TRIGGER students_set_organization_id
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_student_organization_id();

DROP TRIGGER IF EXISTS reports_set_organization_id ON public.reports;
CREATE TRIGGER reports_set_organization_id
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_report_organization_id();

DROP TRIGGER IF EXISTS student_scores_set_organization_id ON public.student_scores;
CREATE TRIGGER student_scores_set_organization_id
  BEFORE INSERT OR UPDATE ON public.student_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_student_score_organization_id();

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
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'sekolah-impian';

  member_role := CASE WHEN NEW.role = 'admin' THEN 'admin' ELSE 'ustadz' END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (default_org_id, NEW.id, member_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_default_organization_membership ON public.profiles;
CREATE TRIGGER profiles_default_organization_membership
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_default_organization_membership();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their organizations" ON public.organizations;
CREATE POLICY "Members can read their organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(id));

DROP POLICY IF EXISTS "Organization admins can update their organizations" ON public.organizations;
CREATE POLICY "Organization admins can update their organizations"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_organization_admin(id))
  WITH CHECK (public.is_organization_admin(id));

DROP POLICY IF EXISTS "Members can read memberships in their organizations" ON public.organization_members;
CREATE POLICY "Members can read memberships in their organizations"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.organization_members;
CREATE POLICY "Organization admins can manage memberships"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Users can read profiles in their organizations" ON public.profiles;
CREATE POLICY "Users can read profiles in their organizations"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_same_organization_user(id));

DROP POLICY IF EXISTS "Users and org admins can update profiles" ON public.profiles;
CREATE POLICY "Users and org admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = profiles.id
        AND public.is_organization_admin(om.organization_id)
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = profiles.id
        AND public.is_organization_admin(om.organization_id)
    )
  );

DROP POLICY IF EXISTS "Organization users can read allowed students" ON public.students;
CREATE POLICY "Organization users can read allowed students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR (
      public.is_organization_member(organization_id)
      AND assigned_ustadz_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organization admins can create students" ON public.students;
CREATE POLICY "Organization admins can create students"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Organization admins can update students" ON public.students;
CREATE POLICY "Organization admins can update students"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "Organization members can read allowed reports" ON public.reports;
CREATE POLICY "Organization members can read allowed reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = reports.student_id
        AND s.organization_id = reports.organization_id
        AND s.assigned_ustadz_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Assigned organization users can create reports" ON public.reports;
CREATE POLICY "Assigned organization users can create reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Assigned organization users can update reports" ON public.reports;
CREATE POLICY "Assigned organization users can update reports"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  )
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Organization users can read allowed scores" ON public.student_scores;
CREATE POLICY "Organization users can read allowed scores"
  ON public.student_scores
  FOR SELECT
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Assigned organization users can create scores" ON public.student_scores;
CREATE POLICY "Assigned organization users can create scores"
  ON public.student_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Assigned organization users can update scores" ON public.student_scores;
CREATE POLICY "Assigned organization users can update scores"
  ON public.student_scores
  FOR UPDATE
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  )
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR public.is_assigned_student(student_id)
  );

COMMIT;
