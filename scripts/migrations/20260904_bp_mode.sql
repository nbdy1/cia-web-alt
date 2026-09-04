-- Mode BP (Bimbingan dan Konseling)
--
-- Students stay in the shared roster. BP sessions are intentionally stored in
-- their own table so they never alter CMS scores, progress, or CDS reports.

BEGIN;

-- Kept as a legacy/default source for existing deployments. The application
-- reads the per-user membership setting below.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS app_mode TEXT NOT NULL DEFAULT 'cds'
  CHECK (app_mode IN ('cds', 'bp'));

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS app_mode TEXT NOT NULL DEFAULT 'cds'
  CHECK (app_mode IN ('cds', 'bp'));

CREATE TABLE IF NOT EXISTS public.bp_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'follow_up', 'resolved')),
  follow_up_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bp_reports_org_created_idx
  ON public.bp_reports (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bp_reports_student_created_idx
  ON public.bp_reports (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bp_reports_creator_created_idx
  ON public.bp_reports (created_by, created_at DESC);

DROP TRIGGER IF EXISTS bp_reports_updated_at ON public.bp_reports;
CREATE TRIGGER bp_reports_updated_at
  BEFORE UPDATE ON public.bp_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bp_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can read BP reports" ON public.bp_reports;
CREATE POLICY "Organization members can read BP reports"
  ON public.bp_reports FOR SELECT TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR created_by = auth.uid()
    OR public.is_assigned_student(student_id)
  );

DROP POLICY IF EXISTS "Organization members can create BP reports" ON public.bp_reports;
CREATE POLICY "Organization members can create BP reports"
  ON public.bp_reports FOR INSERT TO authenticated
  WITH CHECK (
    public.is_organization_member(organization_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "BP report creators and admins can update" ON public.bp_reports;
CREATE POLICY "BP report creators and admins can update"
  ON public.bp_reports FOR UPDATE TO authenticated
  USING (public.is_organization_admin(organization_id) OR created_by = auth.uid())
  WITH CHECK (public.is_organization_admin(organization_id) OR created_by = auth.uid());

GRANT ALL ON public.bp_reports TO authenticated, service_role;

COMMIT;
