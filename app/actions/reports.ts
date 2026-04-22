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

    // Step 2: Insert Scores
    const scoresToInsert = data.scores.map(s => ({
      report_id: report.id,
      category: s.category,
      pillar_id: s.pillar_id,
      score: s.score
    }));

    const { error: scoresError } = await supabase
      .from('report_scores')
      .insert(scoresToInsert);

    if (scoresError) {
      console.error("Step 2 Failed (Scores Table):", scoresError);
      return { success: false, error: scoresError.message };
    }

    return { success: true, id: report.id };
  } catch (err: any) {
    console.error("Unexpected Error:", err);
    return { success: false, error: err.message || "Unknown error" };
  }
}