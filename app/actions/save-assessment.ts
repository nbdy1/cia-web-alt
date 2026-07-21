/**
 * app/actions/save-assessment.ts
 *
 * Server action called after the teacher reviews the AI-generated report on
 * the results page (/create-report/results). Persists the completed assessment
 * to the Supabase `reports` table.
 *
 * The full structured analysis object (detailed_assessments, treatment,
 * overall_stats, etc.) is stored as JSONB in the `treatment_plan` column,
 * keeping the schema flexible without requiring separate score tables.
 *
 * After a successful save:
 * - Revalidates the /students path so the student list and profile pages
 *   reflect the new report without a full page reload.
 * - Triggers generateStudentProfile() (non-blocking, fire-and-forget) to
 *   regenerate the student's historical profile summary for the next assessment.
 *   The profile is stored in students.profile_summary and injected into both
 *   the interview and final analysis prompts on the next session.
 *
 * This is the CURRENT save path. The legacy `saveStudentReport` in reports.ts
 * is no longer used by the UI and exists only as a historical reference.
 */
"use server";

import { revalidatePath } from 'next/cache';
import { generateStudentProfile } from '@/app/actions/ai-analysis';
import { createClient } from '@/lib/supabase/server';
import { assertTenantOrganization } from '@/lib/tenant-server';

export async function saveAssessmentAction(data: {
  student_id: string;
  narrative: string;
  analysis: any; // Full structured analysis object
  model_used?: string;
}) {
  try {
    // Server-side Supabase client reads the session from cookies set by middleware
    const db = await createClient();

    const { data: { user } } = await db.auth.getUser();

    const { data: student, error: studentError } = await db
      .from('students')
      .select('organization_id')
      .eq('id', data.student_id)
      .single();

    if (studentError || !student) {
      throw studentError ?? new Error("Student not found");
    }

    await assertTenantOrganization(db, student.organization_id);

    // Step 1: Insert the main Report
    const { data: report, error: reportError } = await db
      .from('reports')
      .insert([{
        student_id: data.student_id,
        narrative: data.narrative,
        title: data.analysis?.report_title || "Laporan Perkembangan",
        treatment_plan: data.analysis, // JSONB
        model_used: data.model_used || "google/gemini-3-flash-preview",
        created_by: user?.id ?? null
      }])
      .select()
      .single();

    if (reportError) throw reportError;

    revalidatePath('/students');

    // Step 2: Regenerate the student's rolling profile summary in the background.
    // This is non-fatal — if it fails, the report is already saved and the next
    // assessment will just run without an updated profile.
    await generateStudentProfile(data.student_id, data.model_used);

    return { success: true };

  } catch (error: any) {
    console.error("Database Save Error:", error);
    return { success: false, error: error.message };
  }
}
