/**
 * app/actions/reports.ts
 *
 * Server actions for individual report mutation.
 *
 * removeSubIndicator — permanently removes one fulfilled sub-indicator from a
 *   report's treatment_plan JSONB. The caller passes the canonical framework
 *   sub-indicator string; this action removes any AI-generated string in
 *   fulfilled_sub_indicators that fuzzy-matches it (same logic as the recap
 *   page's isLikelySame). After updating Supabase it revalidates the report
 *   page so the Server Component re-fetches with the corrected data.
 *
 * saveStudentReport — LEGACY, kept for historical reference only.
 */
"use server";

import { revalidatePath } from "next/cache";

import { getServerSupabase } from "@/lib/supabase-server";

const norm = (s: string) => s.trim().toLowerCase();
const isLikelySame = (a: string, b: string) => {
  const na = norm(a), nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};

/**
 * Permanently removes a fulfilled sub-indicator from a single report.
 *
 * @param reportId          - UUID of the report row
 * @param category          - "Karakter" | "Mental" | "Soft Skill"
 * @param theme             - Theme title (as stored in the assessment)
 * @param indicator         - Indicator title (as stored in the assessment)
 * @param canonicalSub      - The canonical framework sub-indicator string shown in the UI
 */
export async function removeSubIndicator(
  reportId: string,
  category: string,
  theme: string,
  indicator: string,
  canonicalSub: string,
): Promise<{ success: boolean; error?: string }> {
  const db = await getServerSupabase();

  const { data: report, error: fetchError } = await db
    .from("reports")
    .select("treatment_plan")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { success: false, error: fetchError?.message ?? "Report not found" };
  }

  let plan = report.treatment_plan;
  if (typeof plan === "string") {
    try { plan = JSON.parse(plan); } catch {
      return { success: false, error: "Failed to parse treatment_plan" };
    }
  }

  if (Array.isArray(plan?.detailed_assessments)) {
    plan.detailed_assessments = plan.detailed_assessments.map((assessment: any) => {
      const catMatch = norm(assessment.category ?? "") === norm(category);
      const themeMatch = norm(assessment.theme ?? "") === norm(theme);
      const indMatch = norm(assessment.indicator ?? "") === norm(indicator);
      if (!catMatch || !themeMatch || !indMatch) return assessment;

      return {
        ...assessment,
        fulfilled_sub_indicators: (assessment.fulfilled_sub_indicators ?? []).filter(
          (aiSub: string) => !isLikelySame(aiSub, canonicalSub),
        ),
      };
    });
  }

  const { error: updateError } = await db
    .from("reports")
    .update({ treatment_plan: plan })
    .eq("id", reportId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath(`/reports/${reportId}`);
  return { success: true };
}

export async function saveStudentReport(data: {
  student_id: string;
  narrative: string;
  treatment: string;
  scores: { category: string; pillar_id: string; score: number }[];
}) {
  console.log("Starting save for student:", data.student_id);

  try {
    const db = await getServerSupabase();

    // Step 1: Insert Report
    const { data: report, error: reportError } = await db
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
