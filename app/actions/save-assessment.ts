"use server";

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function saveAssessmentAction(data: {
  student_id: string;
  narrative: string;
  scores: any[];
  treatment: string;
}) {
  try {
    // Step 1: Insert the main Report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert([{
        student_id: data.student_id,
        narrative: data.narrative,
        treatment_plan: data.treatment // This can now be a JSON string
      }])
      .select()
      .single();

    if (reportError) throw reportError;

    // Step 2: Map the AI scores to the report_scores schema
    const scoreEntries = data.scores.map(s => ({
      report_id: report.id,
      category: s.category,
      pillar_id: s.code,
      pillar_title: s.title,
      score: s.score,
      reason: s.reason
    }));

    const { error: scoresError } = await supabase
      .from('report_scores')
      .insert(scoreEntries);

    if (scoresError) throw scoresError;

    revalidatePath('/students'); 
    return { success: true };

  } catch (error: any) {
    console.error("Database Save Error:", error);
    return { success: false, error: error.message };
  }
}