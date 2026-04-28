"use server";

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

export async function finalizeAssessment(transcript: string) {
  try {
    const responseText = await callOpenRouter(CIA_FINAL_ANALYSIS_PROMPT, `FINAL TRANSCRIPT:\n"${transcript}"`);
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.error("Finalize Assessment Error:", error);
    return { error: error.message };
  }
}