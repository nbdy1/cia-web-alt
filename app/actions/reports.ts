/**
 * app/actions/reports.ts
 *
 * LEGACY — no longer called by any UI component.
 *
 * This was the original report-save action used before the `treatment_plan`
 * JSONB column was introduced. It inserted scores into a separate
 * `report_scores` table (since removed by phaseout_report_scores.sql).
 *
 * Kept here for historical reference. If you need to reintroduce per-indicator
 * score rows in the future, this is the pattern to follow. Otherwise, use
 * save-assessment.ts which stores the full analysis object as JSONB.
 */
"use server";

import { supabase } from "@/lib/supabase";

export async function saveStudentReport(data: {
  student_id: string;
  narrative: string;
  treatment: string;
  scores: { category: string; pillar_id: string; score: number }[];
}) {
  console.log("Starting save for student:", data.student_id);

  try {
    // Step 1: Insert Report
    const { data: report, error: reportError } = await supabase
      .from('reports') 
      .insert({
        student_id: data.student_id,
        narrative: data.narrative,
        treatment: data.treatment
      })
      .select()
      .single();

    if (reportError) {
      console.error("Step 1 Failed (Reports Table):", reportError);
      return { success: false, error: reportError.message };
    }

    console.log("Report inserted, ID:", report.id);

    return { success: true, id: report.id };
  } catch (err: any) {
    console.error("Unexpected Error:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}
