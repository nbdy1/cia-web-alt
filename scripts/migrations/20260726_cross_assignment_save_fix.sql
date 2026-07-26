-- Resolve only the tenant of a selected student for cross-assignment saves.
-- The caller must belong to that student's organization.
CREATE OR REPLACE FUNCTION public.get_student_organization_for_report(target_student_id UUID)
RETURNS TABLE (organization_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id
  FROM public.students s
  WHERE s.id = target_student_id
    AND public.is_organization_member(s.organization_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_student_organization_for_report(UUID) TO authenticated;

-- Return only reports authored by the caller for students outside their own
-- roster. This avoids relying on a nested students(...) relation, which is
-- correctly hidden by the students table RLS policy for unassigned students.
CREATE OR REPLACE FUNCTION public.get_my_cross_assignment_reports(target_organization_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ,
  student_name TEXT,
  assigned_ustadz_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.created_at, s.name, s.assigned_ustadz_id
  FROM public.reports r
  JOIN public.students s ON s.id = r.student_id
  WHERE r.organization_id = target_organization_id
    AND r.created_by = auth.uid()
    AND public.is_organization_member(target_organization_id)
    AND (s.assigned_ustadz_id IS NULL OR s.assigned_ustadz_id <> auth.uid())
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_cross_assignment_reports(UUID) TO authenticated;

-- Resolve the minimal student display data needed by a report detail page.
-- The report author is allowed to open their own report even when the student
-- is assigned elsewhere, but should not need broad student-table access.
CREATE OR REPLACE FUNCTION public.get_report_student_for_view(target_report_id UUID)
RETURNS TABLE (
  name TEXT,
  photo_url TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.name, s.photo_url
  FROM public.reports r
  JOIN public.students s ON s.id = r.student_id
  WHERE r.id = target_report_id
    AND (
      public.is_organization_admin(r.organization_id)
      OR r.created_by = auth.uid()
      OR s.assigned_ustadz_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_report_student_for_view(UUID) TO authenticated;
