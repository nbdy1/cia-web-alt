-- scripts/migrations/20261004_student_list_stats.sql
--
-- Powers the "Profil CMS Santri" list (app/students/page.tsx).
--
-- WHY: the list used to run
--     students.select("*, reports(id, treatment_plan, created_at)")
-- which ships EVERY report's full treatment_plan JSON to the browser just so the
-- client can count themes / sub-indicators. For a large org (sekolahimpian:
-- ~176 students, up to 26 reports each) an admin/owner downloads ~6 MB and the
-- query alone takes ~3 s even without RLS. Under RLS (per-row SECURITY DEFINER
-- helper calls) on a phone connection that is slow enough to hit Supabase's
-- statement timeout or the browser's patience, so "Profil" errors out while the
-- lightweight "input" page (which never loads treatment_plan) keeps working.
--
-- This function returns one small row per student with the numbers the list
-- needs. It is SECURITY INVOKER, so the existing RLS on students/reports still
-- decides what each caller may see (admins: whole org, ustadz: assigned only).
--
-- Counting rules mirror the previous client-side code exactly:
--   * themes_explored          = distinct lower(trim(theme)) across all reports
--   * fulfilled_sub_indicators = sum(len(fulfilled)) - sum(len(declined)), min 0
--   * last_report_at           = newest report created_at
--
-- Run once in the Supabase SQL editor. The app falls back to the old query if
-- this function is missing, so deploying code before/after is both safe.

CREATE OR REPLACE FUNCTION public.get_student_list_stats(
  target_organization_id UUID,
  target_ustadz_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  nis TEXT,
  photo_url TEXT,
  assigned_ustadz_id UUID,
  reports_count INTEGER,
  themes_explored INTEGER,
  fulfilled_sub_indicators INTEGER,
  last_report_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH stu AS (
    SELECT s.id, s.name, s.nis, s.photo_url, s.assigned_ustadz_id
    FROM public.students s
    WHERE s.organization_id = target_organization_id
      AND (s.is_removed IS NULL OR s.is_removed = FALSE)
      AND (target_ustadz_id IS NULL OR s.assigned_ustadz_id = target_ustadz_id)
  ),
  plans AS (
    SELECT
      r.student_id,
      r.created_at,
      -- Older rows may hold the plan as a JSON *string*; unwrap those when they
      -- look like an object so they keep counting like they did client-side.
      CASE
        WHEN jsonb_typeof(r.treatment_plan) = 'string'
             AND (r.treatment_plan #>> '{}') ~ '^\s*\{'
          THEN (r.treatment_plan #>> '{}')::jsonb
        ELSE r.treatment_plan
      END AS plan
    FROM public.reports r
    JOIN stu ON stu.id = r.student_id
    WHERE r.organization_id = target_organization_id
  ),
  report_totals AS (
    SELECT student_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
    FROM plans
    GROUP BY student_id
  ),
  assessments AS (
    SELECT p.student_id, a.value AS item
    FROM plans p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p.plan -> 'detailed_assessments') = 'array'
          THEN p.plan -> 'detailed_assessments'
        ELSE '[]'::jsonb
      END
    ) AS a
  ),
  assessment_totals AS (
    SELECT
      student_id,
      COUNT(DISTINCT lower(btrim(item ->> 'theme')))
        FILTER (WHERE nullif(btrim(item ->> 'theme'), '') IS NOT NULL) AS themes,
      COALESCE(SUM(
        CASE WHEN jsonb_typeof(item -> 'fulfilled_sub_indicators') = 'array'
          THEN jsonb_array_length(item -> 'fulfilled_sub_indicators') ELSE 0 END
      ), 0)
      - COALESCE(SUM(
        CASE WHEN jsonb_typeof(item -> 'declined_sub_indicators') = 'array'
          THEN jsonb_array_length(item -> 'declined_sub_indicators') ELSE 0 END
      ), 0) AS fulfilled
    FROM assessments
    GROUP BY student_id
  )
  SELECT
    stu.id,
    stu.name,
    stu.nis,
    stu.photo_url,
    stu.assigned_ustadz_id,
    COALESCE(rt.cnt, 0)::INTEGER,
    COALESCE(ast.themes, 0)::INTEGER,
    GREATEST(0, COALESCE(ast.fulfilled, 0))::INTEGER,
    rt.last_at
  FROM stu
  LEFT JOIN report_totals rt ON rt.student_id = stu.id
  LEFT JOIN assessment_totals ast ON ast.student_id = stu.id
  ORDER BY stu.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_list_stats(UUID, UUID) TO authenticated;
