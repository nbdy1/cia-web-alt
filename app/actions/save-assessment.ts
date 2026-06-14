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
 * After a successful save, revalidates the /students path so the student
 * list and profile pages reflect the new report without a full page reload.
 *
 * This is the CURRENT save path. The legacy `saveStudentReport` in reports.ts
 * is no longer used by the UI and exists only as a historical reference.
 */
"use server";

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function saveAssessmentAction(data: {
  student_id: string;
  narrative: string;
  analysis: any; // Full structured analysis object
}) {
  try {
    // Step 1: Insert the main Report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert([{
        student_id: data.student_id,
        narrative: data.narrative,
        title: data.analysis?.report_title || "Laporan Perkembangan",
        treatment_plan: data.analysis // JSONB
      }])
      .select()
      .single();

    if (reportError) throw reportError;

    revalidatePath('/students'); 
    return { success: true };

  } catch (error: any) {
    console.error("Database Save Error:", error);
    return { success: false, error: error.message };
  }
}
