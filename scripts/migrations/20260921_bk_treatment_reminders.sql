-- BK treatment-plan reminders
--
-- A reminder belongs to one BK report. Its follow-up entries are retained as
-- an audit trail and mirrored into the report's JSON analysis by the server
-- action so later BK sessions can use the recent outcome as bounded context.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bp_treatment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.bp_reports(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  frequency_days INTEGER NOT NULL CHECK (frequency_days IN (1, 3, 7, 14)),
  next_check_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id)
);

CREATE INDEX IF NOT EXISTS bp_treatment_reminders_org_due_idx
  ON public.bp_treatment_reminders (organization_id, is_active, next_check_at);
CREATE INDEX IF NOT EXISTS bp_treatment_reminders_creator_due_idx
  ON public.bp_treatment_reminders (created_by, is_active, next_check_at);

CREATE TABLE IF NOT EXISTS public.bp_treatment_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.bp_treatment_reminders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('done', 'not_done')),
  reflection TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bp_treatment_checkins_reminder_created_idx
  ON public.bp_treatment_checkins (reminder_id, created_at DESC);

DROP TRIGGER IF EXISTS bp_treatment_reminders_updated_at ON public.bp_treatment_reminders;
CREATE TRIGGER bp_treatment_reminders_updated_at
  BEFORE UPDATE ON public.bp_treatment_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bp_treatment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp_treatment_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BK reminder viewers" ON public.bp_treatment_reminders;
CREATE POLICY "BK reminder viewers"
  ON public.bp_treatment_reminders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bp_reports report
      WHERE report.id = report_id
        AND (
          public.is_organization_admin(report.organization_id)
          OR report.created_by = auth.uid()
          OR public.is_assigned_student(report.student_id)
        )
    )
  );

DROP POLICY IF EXISTS "BK reminder creators and admins can manage" ON public.bp_treatment_reminders;
CREATE POLICY "BK reminder creators and admins can manage"
  ON public.bp_treatment_reminders FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_organization_admin(organization_id))
  WITH CHECK (created_by = auth.uid() OR public.is_organization_admin(organization_id));

DROP POLICY IF EXISTS "BK checkin viewers" ON public.bp_treatment_checkins;
CREATE POLICY "BK checkin viewers"
  ON public.bp_treatment_checkins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bp_treatment_reminders reminder
      JOIN public.bp_reports report ON report.id = reminder.report_id
      WHERE reminder.id = reminder_id
        AND (
          public.is_organization_admin(report.organization_id)
          OR report.created_by = auth.uid()
          OR public.is_assigned_student(report.student_id)
        )
    )
  );

DROP POLICY IF EXISTS "BK checkin creators and admins can add" ON public.bp_treatment_checkins;
CREATE POLICY "BK checkin creators and admins can add"
  ON public.bp_treatment_checkins FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bp_treatment_reminders reminder
      WHERE reminder.id = reminder_id
        AND (reminder.created_by = auth.uid() OR public.is_organization_admin(reminder.organization_id))
    )
  );

GRANT ALL ON public.bp_treatment_reminders, public.bp_treatment_checkins TO authenticated, service_role;

COMMIT;
