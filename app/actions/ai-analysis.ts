"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runFullAnalysis(narrative: string) {
  console.log("🚀 AI Analysis Started for narrative:", narrative.substring(0, 50) + "...");

  try {
    // 1. Fetch Framework
    const { data: framework, error: dbError } = await supabase
      .from('assessment_categories')
      .select(`
        name,
        definition,
        assessment_pillars (code, title, indicators)
      `);

    if (dbError) {
      console.error("❌ Supabase Error:", dbError);
      return { error: "Failed to fetch framework from database" };
    }
    console.log("✅ Framework fetched. Total categories:", framework?.length);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Analyze this narrative for a student at Sekolah Impian. 
      Use this framework: ${JSON.stringify(framework)}
      
      NARRATIVE: "${narrative}"
      
      Output ONLY valid JSON in this format:
      {
        "scores": [{ "category": "Karakter", "code": "Pilar 1", "title": "...", "score": 4, "reason": "..." }],
        "treatment": "..."
      }
    `;

    console.log("🧠 Sending request to Gemini...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean potential markdown code blocks from AI response
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    
    console.log("📡 AI Raw Response received");
    const parsed = JSON.parse(cleanJson);
    
    console.log("✨ Analysis Successful!");
    return parsed;

  } catch (error: any) {
    console.error("💥 Server Action Crash:", error.message);
    return { error: error.message || "Internal Server Error" };
  }
}