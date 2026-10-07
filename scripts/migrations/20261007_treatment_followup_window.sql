-- scripts/migrations/20261007_treatment_followup_window.sql
--
-- Lets each organization's admins choose how often a teacher must record at
-- least one treatment (previously fixed at 14 days). Edited from
-- /admin/treatment-plans; read by the teacher reminder card on /students and by
-- the admin compliance view.
--
-- Safe to deploy in either order: until this runs, the app falls back to 14 days
-- and the admin page tells admins the setting cannot be saved yet.
-- Writes go through the existing "Organization admins can update their
-- organizations" RLS policy, so only owners/admins can change it.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS treatment_followup_days INTEGER NOT NULL DEFAULT 14;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_treatment_followup_days_range;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_treatment_followup_days_range
  CHECK (treatment_followup_days BETWEEN 1 AND 90);

COMMENT ON COLUMN public.organizations.treatment_followup_days IS
  'Each teacher must record at least one treatment within this many days (1-90).';
