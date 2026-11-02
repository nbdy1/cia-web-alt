-- scripts/migrations/20261102_bk_monthly_summaries.sql
--
-- Mode BK: "Rapor bulanan" — a per-student, per-month summary of counselling
-- sessions. Generated ON DEMAND (never automatically) from the notes that already
-- exist in bp_reports, reviewed by the counselor, then marked final.
--
-- One row per student per month (period_month = first day of the month, Asia/Jakarta).
-- source_report_ids records which sessions the summary was built from, so the app can
-- tell the counselor "2 new sessions since this was generated" instead of silently
-- spending AI tokens again.
--
-- Read/write access follows bp_reports (widened for BK-mode members by 20261103): admins, the assigned
-- teacher, or whoever generated the row.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bp_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period_month DATE NOT NULL CHECK (EXTRACT(DAY FROM period_month) = 1),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  teacher_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  sessions_count INTEGER NOT NULL DEFAULT 0,
  source_report_ids UUID[] NOT NULL DEFAULT '{}',
  model_used TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, period_month)
);

CREATE INDEX IF NOT EXISTS bp_monthly_summaries_org_period_idx
  ON public.bp_monthly_summaries (organization_id, period_month DESC);

DROP TRIGGER IF EXISTS bp_monthly_summaries_updated_at ON public.bp_monthly_summaries;
CREATE TRIGGER bp_monthly_summaries_updated_at
  BEFORE UPDATE ON public.bp_monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bp_monthly_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BK monthly summary viewers" ON public.bp_monthly_summaries;
CREATE POLICY "BK monthly summary viewers"
  ON public.bp_monthly_summaries FOR SELECT TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR generated_by = auth.uid()
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "BK monthly summary creators" ON public.bp_monthly_summaries;
CREATE POLICY "BK monthly summary creators"
  ON public.bp_monthly_summaries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(organization_id)
    AND generated_by = auth.uid()
  );

DROP POLICY IF EXISTS "BK monthly summary editors" ON public.bp_monthly_summaries;
CREATE POLICY "BK monthly summary editors"
  ON public.bp_monthly_summaries FOR UPDATE TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR generated_by = auth.uid()
    OR public.is_assigned_student(student_id)
  )
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR generated_by = auth.uid()
    OR public.is_assigned_student(student_id)
  );

GRANT ALL ON public.bp_monthly_summaries TO authenticated, service_role;

COMMIT;
