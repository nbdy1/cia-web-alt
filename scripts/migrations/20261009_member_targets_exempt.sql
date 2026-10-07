-- scripts/migrations/20261009_member_targets_exempt.sql
--
-- Lets admins exempt individual teachers from the weekly report target and the
-- treatment follow-up target (e.g. test accounts, or people who are not actually
-- tasked with supervising students). Toggled from /admin/monitoring and
-- /admin/treatment-plans.
--
-- Stored per membership (a person can be exempt in one organization and regulated
-- in another). Writes go through the existing "Organization admins can manage
-- memberships" RLS policy, so only owners/admins can change it.
--
-- Safe to deploy in either order: until this runs nobody is exempt and the admin
-- screens explain that the exemption cannot be saved yet.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS targets_exempt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.organization_members.targets_exempt IS
  'When true the member is not judged against the report / treatment follow-up targets.';
