-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnose + repair org membership for a single account.
--
-- Context: after enabling RLS, the app derives a user's role and access ENTIRELY
-- from public.organization_members (NOT from profiles.role). If a user has no
-- membership row (or the wrong role), they get: no admin button, /admin blocked,
-- empty student lists, and a permanent loading spinner on /students.
--
-- Run the whole file in the Supabase SQL Editor. It runs as `postgres`, so it
-- bypasses RLS and shows/repairs the true state. Change the email if needed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. DIAGNOSTIC — what does the database actually contain for this account? ──
SELECT
  u.id                AS user_id,
  u.email,
  p.role              AS profile_role,
  p.organization_id   AS profile_org_id,
  om.role             AS membership_role,
  o.name              AS org_name,
  o.slug              AS org_slug
FROM auth.users u
LEFT JOIN public.profiles            p  ON p.id = u.id
LEFT JOIN public.organization_members om ON om.user_id = u.id
LEFT JOIN public.organizations       o  ON o.id = om.organization_id
WHERE u.email = 'sekolahimpianstudio@gmail.com';

-- If "membership_role" is NULL  -> no membership row exists (the repair creates it).
-- If "membership_role" is 'ustadz' but you expect admin -> the repair promotes it.
-- If a correct 'owner'/'admin' row already shows here but the app is still empty,
--   the problem is NOT the data: the browser session JWT isn't reaching the DB
--   (auth.uid() is null). In that case, check the browser console for the
--   "[Auth] ..." log added to auth-context.tsx and report it back.


-- ── 2. REPAIR — guarantee this account is an OWNER of Sekolah Impian ───────────
WITH usr AS (
  SELECT id FROM auth.users WHERE email = 'sekolahimpianstudio@gmail.com'
),
org AS (
  SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'
)
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT org.id, usr.id, 'owner'
FROM usr, org
ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role = 'owner';

-- Keep the denormalised pointer + profiles.role consistent.
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'sekolah-impian'),
    role            = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'sekolahimpianstudio@gmail.com');


-- ── 3. VERIFY — re-run the diagnostic; membership_role should now be 'owner'. ──
SELECT
  u.email,
  om.role           AS membership_role,
  o.slug            AS org_slug,
  p.organization_id AS profile_org_id
FROM auth.users u
LEFT JOIN public.profiles            p  ON p.id = u.id
LEFT JOIN public.organization_members om ON om.user_id = u.id
LEFT JOIN public.organizations       o  ON o.id = om.organization_id
WHERE u.email = 'sekolahimpianstudio@gmail.com';
