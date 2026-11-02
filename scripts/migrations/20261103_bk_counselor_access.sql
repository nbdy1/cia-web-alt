-- scripts/migrations/20261103_bk_counselor_access.sql
--
-- Mode BK is a school-wide counselling workspace: a member who works in BK mode
-- can see every student in the organization and every BK note / monthly report,
-- not only students assigned to them. (Before this, BK pages and row-level
-- security only let a non-admin see assigned students, so most BK-mode teachers —
-- who have no assigned students — saw an empty list.)
--
-- "Works in BK mode" = organization_members.app_mode = 'bp' for that organization.
-- NOTE: members choose their own mode in Settings (setUserAppMode), so in practice
-- every member of the organization can read BK records by switching mode. If BK
-- notes should be limited to specific counselors, gate on an admin-controlled flag
-- instead and change only is_bk_counselor() below.
--
-- Writes are unchanged: anyone may add a BK session (created_by = themselves);
-- editing a session or its follow-ups stays with its author or an admin. Monthly
-- reports are shared files, so BK members may also edit/finalize them.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_bk_counselor(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_organization_id
      AND om.app_mode = 'bp'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_bk_counselor(UUID) TO authenticated;

-- Read every BK session in the organization.
DROP POLICY IF EXISTS "Organization members can read BP reports" ON public.bp_reports;
CREATE POLICY "Organization members can read BP reports"
  ON public.bp_reports FOR SELECT TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR created_by = auth.uid()
    OR public.is_assigned_student(student_id)
    OR public.is_bk_counselor(organization_id)
  );

-- Read the students themselves, so names/photos resolve everywhere BK lists them.
DROP POLICY IF EXISTS "BK counselors can read students" ON public.students;
CREATE POLICY "BK counselors can read students"
  ON public.students FOR SELECT TO authenticated
  USING (public.is_bk_counselor(organization_id));

-- Monthly reports (only exists once 20261102 has been applied).
DO $$
BEGIN
  IF to_regclass('public.bp_monthly_summaries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "BK monthly summary viewers" ON public.bp_monthly_summaries;
    CREATE POLICY "BK monthly summary viewers"
      ON public.bp_monthly_summaries FOR SELECT TO authenticated
      USING (
        public.is_organization_admin(organization_id)
        OR generated_by = auth.uid()
        OR public.is_assigned_student(student_id)
        OR public.is_bk_counselor(organization_id)
      );

    DROP POLICY IF EXISTS "BK monthly summary editors" ON public.bp_monthly_summaries;
    CREATE POLICY "BK monthly summary editors"
      ON public.bp_monthly_summaries FOR UPDATE TO authenticated
      USING (
        public.is_organization_admin(organization_id)
        OR generated_by = auth.uid()
        OR public.is_assigned_student(student_id)
        OR public.is_bk_counselor(organization_id)
      )
      WITH CHECK (
        public.is_organization_admin(organization_id)
        OR generated_by = auth.uid()
        OR public.is_assigned_student(student_id)
        OR public.is_bk_counselor(organization_id)
      );
  END IF;
END $$;

COMMIT;
