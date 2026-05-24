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
