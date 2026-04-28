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
        treatment_plan: data.analysis // JSONB
      }])
      .select()
      .single();

    if (reportError) throw reportError;

    // Step 2: Granular Mapping for report_scores
    const scoreEntries: any[] = [];

    // 2.1 Category Level
    Object.entries(data.analysis.overall_stats || {}).map(([cat, stats]: [string, any]) => {
      scoreEntries.push({
        report_id: report.id,
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        pillar_id: cat,
        pillar_title: `${cat} Progress`,
        score: stats.percentage,
        type: 'category',
        reason: `${stats.fulfilled}/${stats.total} fulfilled`
      });
    });

    // 2.2 Detailed Levels (Themes, Indicators)
    data.analysis.detailed_assessments?.forEach((item: any) => {
      // Theme row
      scoreEntries.push({
        report_id: report.id,
        category: item.category,
        pillar_id: item.theme,
        pillar_title: item.theme,
        type: 'theme',
        score: 0, // Themes use fractions/indicators
        reason: item.reasoning
      });

      // Indicator row
      scoreEntries.push({
        report_id: report.id,
        category: item.category,
        pillar_id: `${item.theme}-${item.indicator}`,
        pillar_title: item.indicator,
        type: 'indicator',
        score: 0,
        reason: `Fulfillment: ${item.fulfillment_fraction}`
      });

      // Sub-indicator rows (Fulfilled)
      item.fulfilled_sub_indicators.forEach((si: string) => {
        scoreEntries.push({
          report_id: report.id,
          category: item.category,
          pillar_id: `${item.theme}-${item.indicator}-${si}`,
          pillar_title: si,
          type: 'sub-indicator',
          fulfilled: true,
          score: 100
        });
      });

      // Sub-indicator rows (Missing)
      item.missing_sub_indicators.forEach((si: string) => {
        scoreEntries.push({
          report_id: report.id,
          category: item.category,
          pillar_id: `${item.theme}-${item.indicator}-${si}`,
          pillar_title: si,
          type: 'sub-indicator',
          fulfilled: false,
          score: 0
        });
      });
    });

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