-- Mandatory CDS treatment follow-up
--
-- New reports with a treatment plan automatically receive a two-week follow-up
-- reminder. Historical reports are intentionally left alone, except for the
-- last seven days so this rollout begins with a manageable starting cohort.

BEGIN;

CREATE TABLE IF NOT EXISTS public.treatment_plan_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  next_check_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id)
);

CREATE INDEX IF NOT EXISTS treatment_plan_reminders_responsible_due_idx
  ON public.treatment_plan_reminders (responsible_user_id, is_active, next_check_at);
CREATE INDEX IF NOT EXISTS treatment_plan_reminders_org_due_idx
  ON public.treatment_plan_reminders (organization_id, is_active, next_check_at);

CREATE TABLE IF NOT EXISTS public.treatment_plan_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.treatment_plan_reminders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('done', 'not_done')),
  reflection TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treatment_plan_checkins_report_created_idx
  ON public.treatment_plan_checkins (report_id, created_at DESC);

DROP TRIGGER IF EXISTS treatment_plan_reminders_updated_at ON public.treatment_plan_reminders;
CREATE TRIGGER treatment_plan_reminders_updated_at
  BEFORE UPDATE ON public.treatment_plan_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.schedule_treatment_plan_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(BTRIM(COALESCE(NEW.treatment_plan->'treatment'->>'action_plan', '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.treatment_plan_reminders (
    organization_id,
    report_id,
    student_id,
    responsible_user_id,
    next_check_at
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.student_id,
    COALESCE(
      NEW.created_by,
      (SELECT assigned_ustadz_id FROM public.students WHERE id = NEW.student_id)
    ),
    NEW.created_at + INTERVAL '14 days'
  ) ON CONFLICT (report_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_treatment_plan_follow_up_on_report ON public.reports;
CREATE TRIGGER schedule_treatment_plan_follow_up_on_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.schedule_treatment_plan_follow_up();

-- One rollout cohort only: reports from the past week receive their first
-- reminder at the two-week mark from their creation date. Older pending plans
-- are deliberately not backfilled.
INSERT INTO public.treatment_plan_reminders (
  organization_id,
  report_id,
  student_id,
  responsible_user_id,
  next_check_at
)
SELECT
  report.organization_id,
  report.id,
  report.student_id,
  COALESCE(report.created_by, student.assigned_ustadz_id),
  report.created_at + INTERVAL '14 days'
FROM public.reports report
LEFT JOIN public.students student ON student.id = report.student_id
WHERE report.created_at >= NOW() - INTERVAL '7 days'
  AND NULLIF(BTRIM(COALESCE(report.treatment_plan->'treatment'->>'action_plan', '')), '') IS NOT NULL
  AND COALESCE(report.treatment_plan->'treatment'->>'status', 'pending') = 'pending'
ON CONFLICT (report_id) DO NOTHING;

ALTER TABLE public.treatment_plan_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plan_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Treatment reminder viewers" ON public.treatment_plan_reminders;
CREATE POLICY "Treatment reminder viewers"
  ON public.treatment_plan_reminders FOR SELECT TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR responsible_user_id = auth.uid()
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Treatment reminder managers" ON public.treatment_plan_reminders;
CREATE POLICY "Treatment reminder managers"
  ON public.treatment_plan_reminders FOR UPDATE TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR responsible_user_id = auth.uid()
  )
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR responsible_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Treatment checkin viewers" ON public.treatment_plan_checkins;
CREATE POLICY "Treatment checkin viewers"
  ON public.treatment_plan_checkins FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plan_reminders reminder
      WHERE reminder.id = reminder_id
        AND (
          public.is_organization_admin(reminder.organization_id)
          OR reminder.responsible_user_id = auth.uid()
          OR public.is_assigned_student(reminder.student_id)
        )
    )
  );

DROP POLICY IF EXISTS "Treatment checkin creators" ON public.treatment_plan_checkins;
CREATE POLICY "Treatment checkin creators"
  ON public.treatment_plan_checkins FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.treatment_plan_reminders reminder
      WHERE reminder.id = reminder_id
        AND (
          public.is_organization_admin(reminder.organization_id)
          OR reminder.responsible_user_id = auth.uid()
        )
    )
  );

GRANT ALL ON public.treatment_plan_reminders, public.treatment_plan_checkins TO authenticated, service_role;

COMMIT;
