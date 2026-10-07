-- scripts/migrations/20261008_report_requirement_and_pauses.sql
--
-- Admin-configurable requirements (edited from /admin/monitoring and
-- /admin/treatment-plans):
--
--   1. The weekly report target ("every teacher writes a report for every student
--      they supervise, by Thursday") — cycle length, deadline weekday, and what
--      counts as meeting it.
--   2. A pause window for each target (report + treatment follow-up) so admins can
--      ease off for a period, e.g. exams or school holidays.
--
-- Safe to deploy in either order: until this runs the app uses the defaults below
-- and the admin pages explain that settings cannot be saved yet. Writes go through
-- the existing "Organization admins can update their organizations" RLS policy.
--
-- Pause semantics: a pause is active on a date when pause_from <= date AND
-- (pause_until IS NULL OR date <= pause_until). pause_from NULL means "no pause";
-- pause_until NULL means "until an admin turns it back on". Dates are Asia/Jakarta.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS report_cycle_weeks INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS report_deadline_weekday INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS report_requirement_mode TEXT NOT NULL DEFAULT 'per_student',
  ADD COLUMN IF NOT EXISTS report_min_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS report_pause_from DATE,
  ADD COLUMN IF NOT EXISTS report_pause_until DATE,
  ADD COLUMN IF NOT EXISTS treatment_pause_from DATE,
  ADD COLUMN IF NOT EXISTS treatment_pause_until DATE;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_report_requirement_ranges;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_report_requirement_ranges CHECK (
  report_cycle_weeks BETWEEN 1 AND 4
  AND report_deadline_weekday BETWEEN 1 AND 7            -- ISO: 1 = Monday ... 7 = Sunday
  AND report_requirement_mode IN ('per_student', 'per_teacher')
  AND report_min_count BETWEEN 1 AND 50
);

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_pause_ranges;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pause_ranges CHECK (
  (report_pause_until IS NULL OR (report_pause_from IS NOT NULL AND report_pause_from <= report_pause_until))
  AND (treatment_pause_until IS NULL OR (treatment_pause_from IS NOT NULL AND treatment_pause_from <= treatment_pause_until))
);

COMMENT ON COLUMN public.organizations.report_requirement_mode IS
  'per_student: every assigned student needs report_min_count reports per cycle. per_teacher: the teacher needs report_min_count reports in total per cycle.';
