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
