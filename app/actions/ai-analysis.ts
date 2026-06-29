/**
 * app/actions/ai-analysis.ts
 *
 * The core AI engine for CIA assessments. All functions here are Next.js
 * Server Actions ("use server") — they run only on the server and are called
 * directly from client components via React's server action mechanism.
 *
 * ── Assessment Workflow ───────────────────────────────────────────────────────
 *
 *  1. Interview  → processInterviewStep()
 *     Called after every teacher message in the chat (assessment/page.tsx).
 *     Uses RAG (Retrieval-Augmented Generation) to find which CIA framework
 *     criteria are most relevant to the last few messages, then asks Gemini
 *     to formulate a follow-up question in natural Indonesian. Returns JSON:
 *     { reply, discoveredPillars, isFinished }
 *
 *  2. Finalization → finalizeAssessment() (also exported as runFullAnalysis)
 *     Called once after the interview ends (analysis/page.tsx). Uses RAG again
 *     with the full transcript to retrieve the ~30 most relevant criteria, then
 *     asks Gemini to map the transcript to specific fulfilled sub-indicators.
 *     The raw AI JSON is then post-processed (see below) before being saved.
 *
 * ── RAG Strategy ─────────────────────────────────────────────────────────────
 *
 *  The full CIA framework has 400+ sub-indicators across 88 themes. Sending
 *  all of them to the LLM every time would cost ~8,000 tokens per call.
 *  Instead, we embed the transcript and retrieve only the top-K most similar
 *  criteria rows from Supabase (using pgvector + the match_cia_criteria RPC).
 *  This reduces prompt size to ~500–800 tokens while covering the relevant themes.
 *
 * ── Deterministic Post-Processing ────────────────────────────────────────────
 *
 *  LLMs make arithmetic mistakes and may hallucinate indicator names. We never
 *  trust the AI's self-reported counts or exact strings. After the AI responds:
 *    - enrichDetailedAssessments() → re-maps AI indicator names to canonical
 *      framework names (fuzzy match), de-duplicates, and computes
 *      fulfilled/missing sub-indicator lists from the local framework source.
 *    - enrichTreatment()          → pins treatment to canonical indicator names.
 *    - computeOverallStats()      → counts fulfilled sub-indicators per category
 *      by cross-referencing the AI output against the FULL local framework —
 *      not just the RAG-retrieved subset. Always 100% accurate.
 *
 * ── External Services ────────────────────────────────────────────────────────
 *
 *  LLM chat:     OpenRouter API → google/gemini-3-flash-preview
 *  Embeddings:   OpenRouter API → openai/text-embedding-3-small
 *  Vector store: Supabase pgvector (match_cia_criteria RPC)
 *                Seeded by scripts/ingest-framework.ts
 */
"use server";

import { supabase } from "@/lib/supabase";
import { buildFinalAnalysisPrompt, buildInterviewPrompt } from "@/lib/data/prompts";
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

// ─── Deterministic Stats & Enrichment Helpers ────────────────────────────────
// The AI only sees ~30 retrieved criteria via RAG, so we cannot trust its
// self-reported overall_stats counts. Instead, we extract all fulfilled
// sub-indicator strings from the AI's JSON and count them ourselves by
// cross-referencing the FULL local framework. This is always 100% accurate.

function normalise(s: string) {
  return s.trim().toLowerCase();
}

function buildFallbackTitle(parsed: any): string {
  const t = String(parsed?.treatment?.priority_theme ?? "").trim();
  if (t) return `Fokus ${t}`;
  const s = String(parsed?.status_summary ?? "").trim();
  if (!s) return "Laporan Perkembangan";
  const clean = s.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").slice(0, 6);
  return words.length > 0 ? words.join(" ") : "Laporan Perkembangan";
}

function normalizeReportTitle(rawTitle: unknown, parsed: any): string {
  const source = typeof rawTitle === "string" ? rawTitle : "";
  const cleaned = source
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6);
  if (words.length === 0) return buildFallbackTitle(parsed);
  return words.join(" ");
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

function canonicalCategory(category: string): string | null {
  return Object.keys(ALL_DATA_BY_CATEGORY).find(
    (k) => normalise(k) === normalise(category)
  ) ?? null;
}

function lookupCanonicalIndicator(
  category: string,
  themeTitle: string,
  indicatorTitle: string
): { category: string; theme: string; indicator: string; subIndicators: string[] } | null {
  const canonicalCat = canonicalCategory(category);
  if (!canonicalCat) return null;
  const catData = ALL_DATA_BY_CATEGORY[canonicalCat];
  for (const theme of catData.themes) {
    if (normalise(theme.title) !== normalise(themeTitle)) continue;
    for (const ind of theme.indicators) {
      if (normalise(ind.title) === normalise(indicatorTitle)) {
        return {
          category: canonicalCat,
          theme: theme.title,
          indicator: ind.title,
          subIndicators: ind.sub_indicators,
        };
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

function enrichDetailedAssessments(rawAssessments: any[]): any[] {
  const enriched: any[] = [];
  const seen = new Set<string>();

  for (const item of rawAssessments ?? []) {
    const canonical = lookupCanonicalIndicator(
      String(item?.category ?? ""),
      String(item?.theme ?? ""),
      String(item?.indicator ?? "")
    );
    if (!canonical) continue;

    const key = `${canonical.category}::${canonical.theme}::${canonical.indicator}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const aiFulfilled = Array.isArray(item?.fulfilled_sub_indicators)
      ? item.fulfilled_sub_indicators.map((s: any) => String(s))
      : [];

    const canonicalFulfilled = canonical.subIndicators.filter((frameworkSub) =>
      aiFulfilled.some((aiSub: string) => isLikelySameSubIndicator(aiSub, frameworkSub))
    );

    const canonicalMissing = canonical.subIndicators.filter(
      (frameworkSub) =>
        !canonicalFulfilled.some((fulfilledSub) => normalise(fulfilledSub) === normalise(frameworkSub))
    );

    enriched.push({
      category: canonical.category,
      theme: canonical.theme,
      indicator: canonical.indicator,
      fulfilled_sub_indicators: canonicalFulfilled,
      missing_sub_indicators: canonicalMissing,
      fulfillment_fraction: `${canonicalFulfilled.length}/${canonical.subIndicators.length}`,
      reasoning: String(item?.reasoning ?? "").trim(),
    });
  }

  return enriched;
}

function enrichTreatment(
  treatment: any,
  enrichedAssessments: any[]
): any {
  if (!treatment || typeof treatment !== "object") return treatment;

  const priorityTheme = String(treatment.priority_theme ?? "");
  const priorityIndicator = String(treatment.priority_indicator ?? "");
  const targetRaw = Array.isArray(treatment.target_sub_indicators)
    ? treatment.target_sub_indicators.map((s: any) => String(s))
    : [];

  const matchedAssessment = enrichedAssessments.find(
    (a) =>
      normalise(a.theme) === normalise(priorityTheme) &&
      normalise(a.indicator) === normalise(priorityIndicator)
  );

  if (!matchedAssessment) {
    return {
      ...treatment,
      target_sub_indicators: targetRaw,
    };
  }

  const deterministicTargets = matchedAssessment.missing_sub_indicators
    .filter((sub: string) =>
      targetRaw.length === 0
        ? true
        : targetRaw.some((t: string) => isLikelySameSubIndicator(t, sub))
    )
    .slice(0, 3);

  return {
    ...treatment,
    priority_theme: matchedAssessment.theme,
    priority_indicator: matchedAssessment.indicator,
    target_sub_indicators:
      deterministicTargets.length > 0
        ? deterministicTargets
        : matchedAssessment.missing_sub_indicators.slice(0, 3),
  };
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

async function callOpenRouter(systemPrompt: string, userMessage: string, model: string = CHAT_MODEL) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
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

// ─── RAG: Retrieve relevant knowledge chunks from the full PDF ────────────────
// Queries the pdf_knowledge table (seeded by scripts/ingest-pdf-knowledge.ts).
// This covers intro theory (p.4–74) + implementation guide + 25 Situasi chapters
// (p.254–596) — content that exists in the book but NOT in cia_criteria.
//
// Token budget: topK=4 chunks × ~120 tokens each ≈ 480 tokens added per call.
// Only injected when similarity > threshold, so irrelevant queries cost nothing.

interface KnowledgeRow {
  id: number;
  content: string;
  section: string;
  page_start: number;
  similarity: number;
}

// If the query looks like a direct knowledge question ("Apa itu X?", "Jelaskan Y"),
// expand it with KMS domain context so the embedding lands closer to the right
// PDF chunks (which are dense 300-word passages, not short questions).
function expandKnowledgeQuery(query: string): string {
  // Strip speaker prefixes like "Guru: " or "AI: " that appear in transcript lines
  const stripped = query.replace(/^(Guru|AI|Ustadz|Murid)\s*:\s*/im, "").trim();
  const isQuestion = /^(apa|jelaskan|bagaimana|siapa|mengapa|kenapa|ceritakan|tolong|bisa|boleh)/i.test(stripped);
  if (isQuestion) {
    // Return expanded query WITHOUT the "Guru:" prefix so the embedding
    // focuses on the actual question content, not the speaker label
    return `${stripped} penjelasan dalam konteks Quran Character Building Mental Building Soft Skill KMS Quranik pesantren Islam`;
  }
  return stripped || query;
}

async function retrieveRelevantKnowledge(
  query: string,
  topK = 5
): Promise<KnowledgeRow[]> {
  try {
    const expandedQuery = expandKnowledgeQuery(query);
    const embedding = await embedText(expandedQuery);

    const { data, error } = await supabase.rpc("match_pdf_knowledge", {
      query_embedding: embedding,
      match_threshold: 0.15,  // same as criteria — let the prompt handle relevance
      match_count: topK,
    });

    if (error) {
      // Non-fatal: if the table doesn't exist yet (before migration), just return empty
      console.warn("[Knowledge RAG] RPC error (table may not exist yet):", error.message);
      return [];
    }

    return (data as KnowledgeRow[]) ?? [];
  } catch (err: any) {
    console.warn("[Knowledge RAG] Skipped:", err.message);
    return [];
  }
}

function formatKnowledgeContext(rows: KnowledgeRow[]): string {
  if (rows.length === 0) return "";

  return rows
    .map((row) => {
      // Strip the "[Section Name]" prefix that was prepended during ingest
      // so the AI sees clean prose, not the metadata tag
      const cleanContent = row.content.replace(/^\[[^\]]+\]\n/, "").trim();
      return `— ${row.section}:\n${cleanContent}`;
    })
    .join("\n\n");
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

// ─── Student Profile Generation ───────────────────────────────────────────────

/**
 * Reads the student's last 5 reports and asks the LLM to write a compact
 * 150-200 word character profile (in Indonesian). The profile is stored in
 * students.profile_summary and injected into future assessment prompts so the
 * AI is informed by the student's history, personality, and known patterns.
 *
 * Called by saveAssessmentAction() after each report is successfully saved.
 * Errors are caught and logged — profile generation failure never blocks the
 * user from seeing their saved report.
 */
export async function generateStudentProfile(studentId: string): Promise<void> {
  try {
    // Fetch last 5 reports — enough history without blowing token budget
    const { data: reports } = await supabase
      .from("reports")
      .select("title, created_at, treatment_plan")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!reports || reports.length === 0) return;

    // Build a compact, structured summary of each report (~80-100 tokens each)
    const reportContext = reports
      .map((r, i) => {
        let plan = r.treatment_plan;
        if (typeof plan === "string") {
          try { plan = JSON.parse(plan); } catch { /* leave as-is */ }
        }

        const date = new Date(r.created_at).toLocaleDateString("id-ID", {
          year: "numeric", month: "long", day: "numeric",
        });
        const summary = String(plan?.status_summary ?? "").trim();
        const priorityTheme = String(plan?.treatment?.priority_theme ?? "").trim();
        const priorityIndicator = String(plan?.treatment?.priority_indicator ?? "").trim();

        // Extract up to 4 distinct assessed themes for context
        const themes: string[] = Array.isArray(plan?.detailed_assessments)
          ? Array.from(new Set(
              (plan.detailed_assessments as any[]).map((a) => String(a?.theme ?? "")).filter(Boolean)
            )).slice(0, 4)
          : [];

        return [
          `[Laporan ${i + 1} — ${date}]`,
          summary ? `Ringkasan: ${summary}` : null,
          themes.length > 0 ? `Tema yang dinilai: ${themes.join(", ")}` : null,
          priorityTheme ? `Prioritas penanganan: ${priorityTheme}${priorityIndicator ? ` → ${priorityIndicator}` : ""}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const systemPrompt = `Anda menganalisis riwayat asesmen karakter seorang santri di pesantren (Sekolah Impian). Berdasarkan laporan-laporan di bawah, buatlah PROFIL SANTRI yang ringkas (tidak lebih dari 200 kata) dalam Bahasa Indonesia.

Profil harus mencakup:
- Kesan umum kepribadian dan karakter santri secara alami
- Pola kekuatan yang konsisten muncul dari laporan ke laporan
- Area kelemahan atau perkembangan yang masih perlu perhatian
- Konteks singkat yang berguna bagi ustadz dan AI dalam asesmen berikutnya

Tulis seperti catatan profesional yang disiapkan untuk seseorang yang belum pernah bertemu santri ini. Gunakan gaya narasi yang alami, bukan daftar poin.

PENTING: Kembalikan HANYA teks profil mentah — tidak boleh ada JSON, tidak boleh ada array, tidak boleh ada markdown, tidak boleh ada judul, tidak boleh ada key-value. Hanya paragraf teks biasa.`;

    const profileText = await callOpenRouter(systemPrompt, reportContext);

    // ── Aggressively strip any JSON/markdown wrapping the model might produce ──
    // Despite instructions, LLMs sometimes wrap output in arrays or objects.
    // We normalise to plain text here so profile_summary is always clean.
    let cleanProfile = profileText
      .replace(/```[\s\S]*?```/g, "") // strip markdown fences
      .trim();

    // Helper: extract the profile string from a plain object, checking all
    // observed key names the model has used in the past.
    const extractFromObject = (obj: Record<string, unknown>): string | null =>
      typeof obj?.profil_karakter === "string" ? obj.profil_karakter
      : typeof obj?.profil_santri  === "string" ? obj.profil_santri
      : typeof obj?.profil         === "string" ? obj.profil
      : typeof obj?.profile        === "string" ? obj.profile
      : null;

    try {
      const parsed = JSON.parse(cleanProfile);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        cleanProfile =
          typeof first === "string"
            ? first
            : extractFromObject(first as Record<string, unknown>) ?? cleanProfile;
      } else if (parsed && typeof parsed === "object") {
        cleanProfile = extractFromObject(parsed as Record<string, unknown>) ?? cleanProfile;
      } else if (typeof parsed === "string") {
        cleanProfile = parsed;
      }
    } catch { /* not JSON — already plain text, use as-is */ }

    cleanProfile = cleanProfile.trim();

    await supabase
      .from("students")
      .update({ profile_summary: cleanProfile })
      .eq("id", studentId);

    console.log(`[Profile] Updated profile for student ${studentId} (${cleanProfile.length} chars)`);
  } catch (err) {
    // Non-fatal — a missing profile just means the next interview runs without it
    console.error("[Profile] Failed to generate student profile:", err);
  }
}

// ─── Public Actions ───────────────────────────────────────────────────────────

/**
 * Called after every teacher message in the interview chat.
 * Fetches the student's historical profile (if any) from the DB and injects it
 * into the interview prompt alongside the RAG-retrieved criteria context.
 *
 * studentId is optional — if absent (e.g. test scenarios), the interview runs
 * without profile context, which matches the behaviour before this feature.
 */
export async function processInterviewStep(
  transcript: string,
  discoveredThemes: string[] = [],
  studentId?: string,
  selectedModel: string = CHAT_MODEL
) {
  try {
    // Fetch the student's historical profile if a studentId was provided.
    // This is a single indexed read and adds ~250 tokens to the prompt.
    let studentProfile: string | undefined;
    if (studentId) {
      const { data: studentData } = await supabase
        .from("students")
        .select("profile_summary")
        .eq("id", studentId)
        .single();
      studentProfile = studentData?.profile_summary ?? undefined;
    }

    const recentWindow = getRecentTranscriptWindow(transcript, 4);

    // Run criteria RAG and knowledge RAG in parallel to save latency
    const [frontierRows, knowledgeRows] = await Promise.all([
      retrieveRelevantCriteria(recentWindow || transcript, 15),
      retrieveRelevantKnowledge(recentWindow || transcript, 3),
    ]);

    const frontierCriteriaContext = formatCriteriaContext(frontierRows);
    const unexploredThemesContext = buildUnexploredThemesContext(frontierRows, discoveredThemes, 4);
    const knowledgeContext = formatKnowledgeContext(knowledgeRows);

    const _kqRaw = recentWindow || transcript;
    const _kqExpanded = expandKnowledgeQuery(_kqRaw);
    console.log("[Knowledge RAG] Raw query:", _kqRaw);
    console.log("[Knowledge RAG] Expanded query:", _kqExpanded);
    console.log("[Knowledge RAG] Sections retrieved:", knowledgeRows.map((r) => `${r.section} (${r.similarity?.toFixed(2)})`));

    const interviewPrompt = buildInterviewPrompt(
      frontierCriteriaContext,
      unexploredThemesContext,
      discoveredThemes,
      studentProfile,
      knowledgeContext || undefined
    );
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
      `TRANSKRIP SAAT INI:\n"${transcript}"`,
      selectedModel
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
  discoveredThemes: string[] = [],
  selectedModel: string = CHAT_MODEL
) {
  try {
    // 1. Fetch the student's previous progress + historical profile for context
    let currentProgressContext =
      "Belum ada data asesmen sebelumnya. Mulai dari awal kerangka kerja.";
    let studentProfile: string | undefined;
    let previousTitlesContext = "";

    if (studentId) {
      // Fetch profile and latest report in parallel to keep latency down
      const [profileResult, latestReportResult] = await Promise.all([
        supabase
          .from("students")
          .select("profile_summary")
          .eq("id", studentId)
          .single(),
        supabase
          .from("reports")
          .select("treatment_plan")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      studentProfile = profileResult.data?.profile_summary ?? undefined;
      const latestReport = latestReportResult.data;

      if (studentProfile) {
        console.log(`[Finalize] Injecting student profile (${studentProfile.length} chars) into analysis prompt`);
      }

      const { data: recentTitles } = await supabase
        .from("reports")
        .select("title")
        .eq("student_id", studentId)
        .not("title", "is", null)
        .order("created_at", { ascending: false })
        .limit(8);

      if (latestReport?.treatment_plan) {
        let prevAnalysis = latestReport.treatment_plan;
        if (typeof prevAnalysis === "string") {
          try {
            prevAnalysis = JSON.parse(prevAnalysis);
          } catch (e) {}
        }

        currentProgressContext = `
PROGRES SEBELUMNYA (kumulatif dari seluruh laporan terdahulu):
- Karakter: ${prevAnalysis?.overall_stats?.karakter?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.karakter?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.karakter?.total ?? 0})
- Mental: ${prevAnalysis?.overall_stats?.mental?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.mental?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.mental?.total ?? 0})
- Soft Skill: ${prevAnalysis?.overall_stats?.soft_skill?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.soft_skill?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.soft_skill?.total ?? 0})

PENTING: Prioritaskan Tema/Indikator pertama yang masih belum lengkap berdasarkan statistik di atas.
        `;
      }

      const titles = (recentTitles ?? [])
        .map((r: any) => String(r?.title ?? "").trim())
        .filter(Boolean);
      if (titles.length > 0) {
        previousTitlesContext = `\n\nJUDUL LAPORAN TERDAHULU (hindari pengulangan persis):\n${titles
          .map((t) => `- ${t}`)
          .join("\n")}`;
      }
    }

    // 2. RAG: run criteria and knowledge retrieval in parallel
    console.log("[RAG] Embedding transcript and retrieving relevant criteria + knowledge...");
    const [relevantRows, knowledgeRows] = await Promise.all([
      retrieveRelevantCriteria(transcript, 30),
      retrieveRelevantKnowledge(transcript, 4),
    ]);

    const discoveredThemesContext = discoveredThemes.length
      ? `\n\n### TEMA YANG SUDAH DIEKSPLORASI SELAMA WAWANCARA:\n${discoveredThemes
          .map((theme) => `- ${theme}`)
          .join("\n")}\nGunakan konteks ini untuk memperkuat pemetaan bukti ke kriteria terkait.`
      : "";
    const criteriaContext = `${formatCriteriaContext(relevantRows)}${discoveredThemesContext}`;
    const knowledgeContext = formatKnowledgeContext(knowledgeRows);

    console.log(`[RAG] Retrieved ${relevantRows.length} criteria rows, ${knowledgeRows.length} knowledge chunks.`);
    if (knowledgeRows.length > 0) {
      console.log("[Knowledge RAG] Sections injected:", knowledgeRows.map((r) => r.section));
    }
    console.log("[Finalize][Server] Inputs for final summary", {
      discoveredThemesCount: discoveredThemes.length,
      discoveredThemes,
      ragThemes: Array.from(new Set(relevantRows.map((row) => row.theme))),
      ragRowsCount: relevantRows.length,
      transcriptLines: transcript.split("\n").filter(Boolean).length,
    });

    // 3. Build a lean prompt injecting criteria + knowledge context + student profile
    const systemPrompt = buildFinalAnalysisPrompt(
      criteriaContext,
      studentProfile,
      knowledgeContext || undefined
    );

    // 4. Call the LLM
    const responseText = await callOpenRouter(
      systemPrompt,
      `${currentProgressContext}${previousTitlesContext}\n\nTRANSKRIP AKHIR:\n"${transcript}"`,
      selectedModel
    );
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    const enrichedAssessments = enrichDetailedAssessments(parsed?.detailed_assessments ?? []);
    parsed.analysis_version = 2;
    parsed.report_title = normalizeReportTitle(parsed?.report_title, parsed);
    parsed.model_used = selectedModel;
    parsed.detailed_assessments = enrichedAssessments;
    parsed.treatment = enrichTreatment(parsed?.treatment, enrichedAssessments);
    const finalThemes: string[] = Array.isArray(parsed?.detailed_assessments)
      ? Array.from(new Set(parsed.detailed_assessments.map((a: any) => a?.theme).filter(Boolean))) as string[]
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

    // 5. Deterministically compute numeric fields (never trust AI arithmetic).
    parsed.overall_stats = computeOverallStats(parsed);
    console.log("[Stats] Computed overall_stats:", parsed.overall_stats);

    return parsed;
  } catch (error: any) {
    console.error("Finalize Assessment Error:", error);
    return { error: error.message };
  }
}

export const runFullAnalysis = finalizeAssessment;
