"use server";

import { supabase } from "@/lib/supabase";
import { CIA_INTERVIEW_PROMPT, CIA_FINAL_ANALYSIS_PROMPT } from "@/lib/data/prompts";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "google/gemini-3-flash-preview";

async function callOpenRouter(systemPrompt: string, userMessage: string) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // "HTTP-Referer": "https://cia-assessment.id", // Optional
      // "X-Title": "CIA Assessment", // Optional
    },
    body: JSON.stringify({
      "model": MODEL,
      "messages": [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": userMessage }
      ],
      "response_format": { "type": "json_object" }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function processInterviewStep(transcript: string) {
  try {
    const responseText = await callOpenRouter(CIA_INTERVIEW_PROMPT, `CURRENT TRANSCRIPT:\n"${transcript}"`);
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Interview Step Error:", error);
    return { error: error.message };
  }
}

export async function finalizeAssessment(transcript: string, studentId?: string) {
  try {
    let currentProgressContext = "No previous assessment data found. Start from the beginning of the framework.";
    
    if (studentId) {
      const { data: latestReport } = await supabase
        .from('reports')
        .select('treatment_plan')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestReport?.treatment_plan) {
        const prevAnalysis = JSON.parse(latestReport.treatment_plan);
        currentProgressContext = `
PREVIOUS PROGRESS:
- Karakter: ${prevAnalysis.overall_stats?.karakter?.percentage || 0}% (${prevAnalysis.overall_stats?.karakter?.fulfilled || 0}/${prevAnalysis.overall_stats?.karakter?.total || 0})
- Mental: ${prevAnalysis.overall_stats?.mental?.percentage || 0}% (${prevAnalysis.overall_stats?.mental?.fulfilled || 0}/${prevAnalysis.overall_stats?.mental?.total || 0})
- Soft Skill: ${prevAnalysis.overall_stats?.soft_skill?.percentage || 0}% (${prevAnalysis.overall_stats?.soft_skill?.fulfilled || 0}/${prevAnalysis.overall_stats?.soft_skill?.total || 0})

IMPORTANT: Prioritize the first Theme/Indicator that is still incomplete based on the stats above.
        `;
      }
    }

    const responseText = await callOpenRouter(
      CIA_FINAL_ANALYSIS_PROMPT, 
      `${currentProgressContext}\n\nFINAL TRANSCRIPT:\n"${transcript}"`
    );
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Finalize Assessment Error:", error);
    return { error: error.message };
  }
}

export const runFullAnalysis = finalizeAssessment;