-- scripts/migrations/20260721_cross_assignment_reports.sql
--
-- Allows a non-admin ustadz to create a report for a student who is NOT
-- assigned to them (e.g. they noticed something worth flagging while
-- covering another ustadz's class). Previously both the RLS policy and the
-- set_report_organization_id() trigger hard-blocked this with
-- "Current user cannot write reports for this student".
--
-- To let that ustadz later find/follow up on the report they made for a
-- student outside their normal roster (the report won't show up via the
-- assigned-student join the app normally uses), reports now record who
-- created them.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);

-- Best-effort backfill: assume existing reports were written by the
-- student's assigned ustadz (true for the vast majority of historical rows).
UPDATE public.reports r
SET created_by = s.assigned_ustadz_id
FROM public.students s
WHERE r.student_id = s.id
  AND r.created_by IS NULL
  AND s.assigned_ustadz_id IS NOT NULL;

-- Read-only helper for the "search other students" picker: returns every
-- student in the caller's organization (not just their assigned ones),
-- limited to the columns needed to search/display a picker row so the rest
-- of a student's record (profile_summary, etc.) stays scoped to their
-- assigned ustadz / admins as before.
CREATE OR REPLACE FUNCTION public.search_organization_students(target_organization_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  nis TEXT,
  photo_url TEXT,
  assigned_ustadz_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.nis, s.photo_url, s.assigned_ustadz_id
  FROM public.students s
  WHERE s.organization_id = target_organization_id
    AND public.is_organization_member(target_organization_id)
    AND (s.is_removed IS NULL OR s.is_removed = FALSE)
  ORDER BY s.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.search_organization_students(UUID) TO authenticated;

-- Relax the report-writing gate: any organization member may write a report
-- for any student in their organization, not just their assigned ones.
-- Auto-stamp created_by so the app doesn't have to be trusted to set it.
CREATE OR REPLACE FUNCTION public.set_report_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_org_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed for reports';
  END IF;

  SELECT s.organization_id INTO student_org_id
  FROM public.students s
  WHERE s.id = NEW.student_id;

  IF student_org_id IS NULL THEN
    RAISE EXCEPTION 'Report student does not exist';
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := student_org_id;
  END IF;

  IF NEW.organization_id <> student_org_id THEN
    RAISE EXCEPTION 'Report organization must match student organization';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_organization_member(student_org_id) THEN
    RAISE EXCEPTION 'Current user cannot write reports for this student';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Reports: any org member can create (was: admin or assigned-only).
DROP POLICY IF EXISTS "Assigned organization users can create reports" ON public.reports;
CREATE POLICY "Organization members can create reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_member(organization_id)
  );

-- Reports: read if admin, assigned to the student, or the report's own author.
DROP POLICY IF EXISTS "Organization members can read allowed reports" ON public.reports;
CREATE POLICY "Organization members can read allowed reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = reports.student_id
        AND s.organization_id = reports.organization_id
        AND s.assigned_ustadz_id = auth.uid()
    )
  );

-- Reports: update (e.g. treatment status) if admin, assigned, or the author —
-- so an ustadz can still follow up on a report they made for a non-assigned
-- student even if that student later gets assigned elsewhere.
DROP POLICY IF EXISTS "Assigned organization users can update reports" ON public.reports;
CREATE POLICY "Organization members can update allowed reports"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    public.is_organization_admin(organization_id)
    OR created_by = auth.uid()
    OR public.is_assigned_student(student_id)
  )
  WITH CHECK (
    public.is_organization_admin(organization_id)
    OR created_by = auth.uid()
    OR public.is_assigned_student(student_id)
  );
