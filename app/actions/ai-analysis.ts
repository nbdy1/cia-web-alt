"use server";

import { supabase } from "@/lib/supabase";
import { buildFinalAnalysisPrompt, buildInterviewPrompt } from "@/lib/data/prompts";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

// ─── Shared fetch wrapper ─────────────────────────────────────────────────────

// ─── Deterministic Stats Computation ─────────────────────────────────────────
// The AI only sees ~30 retrieved criteria via RAG, so we cannot trust its
// self-reported overall_stats counts. Instead, we extract all fulfilled
// sub-indicator strings from the AI's JSON and count them ourselves by
// cross-referencing the FULL local framework. This is always 100% accurate.

function normalise(s: string) {
  return s.trim().toLowerCase();
}

interface OverallStats {
  fulfilled: number;
  total: number;
  percentage: number;
}

const ALL_DATA_BY_CATEGORY: Record<
  string,
  { themes: { title: string; indicators: { title: string; sub_indicators: string[] }[] }[] }
> = {
  Karakter: karakterData,
  Mental: mentalData,
  "Soft Skill": softSkillData,
};

function lookupFullIndicatorSubIndicators(
  category: string,
  themeTitle: string,
  indicatorTitle: string
): string[] | null {
  const catData = ALL_DATA_BY_CATEGORY[category];
  if (!catData) return null;

  for (const theme of catData.themes) {
    if (normalise(theme.title) !== normalise(themeTitle)) continue;
    for (const ind of theme.indicators) {
      if (normalise(ind.title) === normalise(indicatorTitle)) {
        return ind.sub_indicators;
      }
    }
  }
  return null;
}

function isLikelySameSubIndicator(candidate: string, target: string): boolean {
  const c = normalise(candidate);
  const t = normalise(target);
  return c === t || c.includes(t) || t.includes(c);
}

function computeOverallStats(aiJson: any): {
  karakter: OverallStats;
  mental: OverallStats;
  soft_skill: OverallStats;
} {
  // 1. Collect canonical fulfilled sub-indicators per category by mapping the
  //    AI output back to the local framework indicator (theme+indicator scoped).
  const fulfilledByCategory: Record<string, Set<string>> = {
    Karakter: new Set(),
    Mental: new Set(),
    "Soft Skill": new Set(),
  };

  if (Array.isArray(aiJson.detailed_assessments)) {
    for (const assessment of aiJson.detailed_assessments) {
      const cat = assessment.category as string;
      const bucket =
        fulfilledByCategory[cat] ??
        fulfilledByCategory[Object.keys(fulfilledByCategory).find(
          (k) => normalise(k) === normalise(cat)
        ) ?? ""];
      if (!bucket) continue;

      const fullSubs = lookupFullIndicatorSubIndicators(
        cat,
        assessment.theme as string,
        assessment.indicator as string
      );

      if (!fullSubs || !Array.isArray(assessment.fulfilled_sub_indicators)) continue;

      for (const frameworkSub of fullSubs) {
        for (const aiSub of assessment.fulfilled_sub_indicators) {
          if (isLikelySameSubIndicator(aiSub, frameworkSub)) {
            bucket.add(normalise(frameworkSub));
            break;
          }
        }
      }
    }
  }

  // 2. Count against the full local framework
  const count = (
    data: { themes: { indicators: { sub_indicators: string[] }[] }[] },
    bucket: Set<string>
  ) => {
    let total = 0;
    let fulfilled = 0;
    for (const theme of data.themes) {
      for (const ind of theme.indicators) {
        for (const sub of ind.sub_indicators) {
          total++;
          if (bucket.has(normalise(sub))) fulfilled++;
        }
      }
    }
    return { total, fulfilled, percentage: total > 0 ? Math.round((fulfilled / total) * 10000) / 100 : 0 };
  };

  return {
    karakter: count(karakterData, fulfilledByCategory["Karakter"]),
    mental: count(mentalData, fulfilledByCategory["Mental"]),
    soft_skill: count(softSkillData, fulfilledByCategory["Soft Skill"]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function callOpenRouter(systemPrompt: string, userMessage: string) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Chat Error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

// ─── RAG: Embed a text string via OpenRouter ──────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Embedding Error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

// ─── RAG: Retrieve the top-N most relevant criteria from Supabase ─────────────

interface CriteriaRow {
  category: string;
  theme: string;
  indicator: string;
  sub_indicator: string;
  similarity: number;
}

async function retrieveRelevantCriteria(transcript: string, topK = 25): Promise<CriteriaRow[]> {
  const embedding = await embedText(transcript);

  const { data, error } = await supabase.rpc("match_cia_criteria", {
    query_embedding: embedding,
    match_threshold: 0.15,
    match_count: topK,
  });

  if (error) throw new Error(`Supabase RPC Error: ${error.message}`);
  return (data as CriteriaRow[]) ?? [];
}

// ─── Format retrieved rows into a compact, structured string ──────────────────

function formatCriteriaContext(rows: CriteriaRow[]): string {
  // Group: category -> theme -> indicator -> [sub_indicators]
  const grouped: Record<string, Record<string, Record<string, string[]>>> = {};

  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = {};
    if (!grouped[row.category][row.theme]) grouped[row.category][row.theme] = {};
    if (!grouped[row.category][row.theme][row.indicator]) {
      grouped[row.category][row.theme][row.indicator] = [];
    }
    grouped[row.category][row.theme][row.indicator].push(row.sub_indicator);
  }

  const lines: string[] = [];
  for (const [cat, themes] of Object.entries(grouped)) {
    lines.push(`## Kategori: ${cat}`);
    for (const [theme, indicators] of Object.entries(themes)) {
      lines.push(`  ### Tema: ${theme}`);
      for (const [indicator, subs] of Object.entries(indicators)) {
        lines.push(`    Indikator: ${indicator}`);
        for (const sub of subs) {
          lines.push(`      - ${sub}`);
        }
      }
    }
  }

  return lines.join("\n");
}

function getRecentTranscriptWindow(transcript: string, maxLines = 4): string {
  const lines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-maxLines).join("\n");
}

function buildUnexploredThemesContext(frontierRows: CriteriaRow[], discoveredThemes: string[], limit = 4): string {
  const frontierThemes = new Set(frontierRows.map((row) => normalise(row.theme)));
  const discovered = new Set(discoveredThemes.map((t) => normalise(t)));

  const allThemes = [
    ...karakterData.themes.map((theme) => ({ category: "Karakter", title: theme.title })),
    ...mentalData.themes.map((theme) => ({ category: "Mental", title: theme.title })),
    ...softSkillData.themes.map((theme) => ({ category: "Soft Skill", title: theme.title })),
  ];

  const unexplored = allThemes
    .filter((theme) => !discovered.has(normalise(theme.title)))
    .filter((theme) => !frontierThemes.has(normalise(theme.title)))
    .slice(0, limit);

  if (unexplored.length === 0) return "";

  return unexplored.map((theme) => `- ${theme.category}: ${theme.title}`).join("\n");
}

// ─── Public Actions ───────────────────────────────────────────────────────────

export async function processInterviewStep(transcript: string, discoveredThemes: string[] = []) {
  try {
    const recentWindow = getRecentTranscriptWindow(transcript, 4);
    const frontierRows = await retrieveRelevantCriteria(recentWindow || transcript, 15);
    const frontierCriteriaContext = formatCriteriaContext(frontierRows);
    const unexploredThemesContext = buildUnexploredThemesContext(frontierRows, discoveredThemes, 4);
    const interviewPrompt = buildInterviewPrompt(frontierCriteriaContext, unexploredThemesContext, discoveredThemes);
    const frontierThemeSet = Array.from(new Set(frontierRows.map((r) => r.theme)));

    console.log("[Interview][Server] Retrieval context", {
      transcriptLines: transcript.split("\n").filter(Boolean).length,
      recentWindow,
      discoveredThemesInputCount: discoveredThemes.length,
      discoveredThemesInput: discoveredThemes,
      frontierRowsCount: frontierRows.length,
      frontierThemes: frontierThemeSet,
      unexploredThemesContext,
    });

    const responseText = await callOpenRouter(
      interviewPrompt,
      `CURRENT TRANSCRIPT:\n"${transcript}"`
    );
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    console.log("[Interview][Server] Model output", {
      discoveredPillarsThisStep: parsed?.discoveredPillars ?? [],
      discoveredPillarsCount: parsed?.discoveredPillars?.length ?? 0,
      isFinished: parsed?.isFinished,
    });
    return parsed;
  } catch (error: any) {
    console.error("Interview Step Error:", error);
    return { error: error.message };
  }
}

export async function finalizeAssessment(
  transcript: string,
  studentId?: string,
  discoveredThemes: string[] = []
) {
  try {
    // 1. Fetch the student's previous progress for context
    let currentProgressContext =
      "No previous assessment data found. Start from the beginning of the framework.";

    if (studentId) {
      const { data: latestReport } = await supabase
        .from("reports")
        .select("treatment_plan")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestReport?.treatment_plan) {
        let prevAnalysis = latestReport.treatment_plan;
        if (typeof prevAnalysis === "string") {
          try {
            prevAnalysis = JSON.parse(prevAnalysis);
          } catch (e) {}
        }

        currentProgressContext = `
PREVIOUS PROGRESS (cumulative across all past reports):
- Karakter: ${prevAnalysis?.overall_stats?.karakter?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.karakter?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.karakter?.total ?? 0})
- Mental: ${prevAnalysis?.overall_stats?.mental?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.mental?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.mental?.total ?? 0})
- Soft Skill: ${prevAnalysis?.overall_stats?.soft_skill?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.soft_skill?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.soft_skill?.total ?? 0})

IMPORTANT: Prioritize the first Theme/Indicator that is still incomplete based on the stats above.
        `;
      }
    }

    // 2. RAG: retrieve only the most relevant criteria for this transcript
    console.log("[RAG] Embedding transcript and retrieving relevant criteria...");
    const relevantRows = await retrieveRelevantCriteria(transcript, 30);
    const discoveredThemesContext = discoveredThemes.length
      ? `\n\n### TEMA YANG SUDAH DIEKSPLORASI SELAMA WAWANCARA:\n${discoveredThemes
          .map((theme) => `- ${theme}`)
          .join("\n")}\nGunakan konteks ini untuk memperkuat pemetaan bukti ke kriteria terkait.`
      : "";
    const criteriaContext = `${formatCriteriaContext(relevantRows)}${discoveredThemesContext}`;
    console.log(`[RAG] Retrieved ${relevantRows.length} relevant criteria rows.`);
    console.log("[Finalize][Server] Inputs for final summary", {
      discoveredThemesCount: discoveredThemes.length,
      discoveredThemes,
      ragThemes: Array.from(new Set(relevantRows.map((row) => row.theme))),
      ragRowsCount: relevantRows.length,
      transcriptLines: transcript.split("\n").filter(Boolean).length,
    });

    // 3. Build a lean prompt injecting only the retrieved criteria
    const systemPrompt = buildFinalAnalysisPrompt(criteriaContext);

    // 4. Call the LLM
    const responseText = await callOpenRouter(
      systemPrompt,
      `${currentProgressContext}\n\nFINAL TRANSCRIPT:\n"${transcript}"`
    );
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const finalThemes = Array.isArray(parsed?.detailed_assessments)
      ? Array.from(new Set(parsed.detailed_assessments.map((a: any) => a?.theme).filter(Boolean)))
      : [];
    const missingFromFinal = discoveredThemes.filter(
      (theme) => !finalThemes.some((finalTheme) => normalise(finalTheme) === normalise(theme))
    );
    console.log("[Finalize][Server] Final summary comparison", {
      finalThemes,
      finalThemesCount: finalThemes.length,
      discoveredThemesInput: discoveredThemes,
      discoveredThemesInputCount: discoveredThemes.length,
      missingDiscoveredThemesInFinal: missingFromFinal,
      priorityTheme: parsed?.treatment?.priority_theme,
    });

    // 5. Overwrite the AI's self-reported stats with our deterministic calculation.
    //    The AI only saw ~30 criteria via RAG; our local framework has the full picture.
    parsed.overall_stats = computeOverallStats(parsed);
    console.log("[Stats] Computed overall_stats:", parsed.overall_stats);

    return parsed;
  } catch (error: any) {
    console.error("Finalize Assessment Error:", error);
    return { error: error.message };
  }
}

export const runFullAnalysis = finalizeAssessment;
