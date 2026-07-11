-- ─────────────────────────────────────────────────────────────────────────────
-- Super-admin access fixes.
--
-- 1) Let platform (company) super-admins READ every organization and its
--    members, even orgs they are not a member of. The original multi-tenant
--    policies only allowed org members to read, so a dedicated company admin
--    account (not a tenant member) would see an empty /super-admin list.
-- 2) Confirm / seed your platform admin so the Members modal stops returning
--    "Forbidden: platform super-admin only".
--
-- Run in the Supabase SQL Editor. Requires the billing migration (which created
-- is_platform_admin()) to have run first.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend read access for platform admins.
DROP POLICY IF EXISTS "Members can read their organizations" ON public.organizations;
CREATE POLICY "Members can read their organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Members can read memberships in their organizations" ON public.organization_members;
CREATE POLICY "Members can read memberships in their organizations"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id) OR public.is_platform_admin());

-- (Optional) also let platform admins read every profile so the Members modal
-- always resolves names/emails, even across orgs they don't belong to.
DROP POLICY IF EXISTS "Users can read profiles in their organizations" ON public.profiles;
CREATE POLICY "Users can read profiles in their organizations"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_same_organization_user(id) OR public.is_platform_admin());

-- 2a. Is your account already a platform admin? (Empty result = NO.)
SELECT u.email, pa.created_at
FROM auth.users u
JOIN public.platform_admins pa ON pa.user_id = u.id
WHERE u.email = 'sekolahimpianstudio@gmail.com';

-- 2b. If the query above returned nothing, seed it. Replace the email with the
--     account you want to be a company super-admin (ideally a dedicated company
--     account, not a pesantren owner).
INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'founder'
FROM auth.users
WHERE email = 'sekolahimpianstudio@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
