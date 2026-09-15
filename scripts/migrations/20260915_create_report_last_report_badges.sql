-- scripts/migrations/20260915_create_report_last_report_badges.sql
--
-- The create-report student picker needs to tell a teacher whether a student
-- has previously been assessed. A teacher may not be allowed to read another
-- teacher's report content, so the normal reports SELECT policy cannot safely
-- power that small piece of picker metadata.

CREATE INDEX IF NOT EXISTS reports_organization_student_created_at_idx
  ON public.reports (organization_id, student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_student_last_report_dates(
  target_organization_id UUID
)
RETURNS TABLE (
  student_id UUID,
  last_report_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.student_id, MAX(r.created_at) AS last_report_at
  FROM public.reports r
  WHERE r.organization_id = target_organization_id
    AND public.is_organization_member(target_organization_id)
  GROUP BY r.student_id;
$$;

REVOKE ALL ON FUNCTION public.get_student_last_report_dates(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_last_report_dates(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
