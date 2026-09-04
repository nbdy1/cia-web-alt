-- Follow-up for installations that already applied 20260904_bp_mode.sql when
-- mode was organization-wide. A user's last selected mode is now remembered
-- per organization_members row, so colleagues can choose independently.

BEGIN;

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS app_mode TEXT;

-- Preserve the currently active organisation-wide setting as every member's
-- starting preference, then each user can change it independently.
UPDATE public.organization_members om
SET app_mode = COALESCE(o.app_mode, 'cds')
FROM public.organizations o
WHERE o.id = om.organization_id
  AND om.app_mode IS NULL;

UPDATE public.organization_members
SET app_mode = 'cds'
WHERE app_mode IS NULL OR app_mode NOT IN ('cds', 'bp');

ALTER TABLE public.organization_members
  ALTER COLUMN app_mode SET DEFAULT 'cds',
  ALTER COLUMN app_mode SET NOT NULL;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_app_mode_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_app_mode_check
  CHECK (app_mode IN ('cds', 'bp'));

COMMIT;
