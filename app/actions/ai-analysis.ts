/**
 * app/actions/ai-analysis.ts
 *
 * The core AI engine for CDS assessments. All functions here are Next.js
 * Server Actions ("use server") — they run only on the server and are called
 * directly from client components via React's server action mechanism.
 *
 * ── Assessment Workflow ───────────────────────────────────────────────────────
 *
 *  1. Interview  → processInterviewStep()
 *     Called after every teacher message in the chat (assessment/page.tsx).
 *     Uses RAG (Retrieval-Augmented Generation) to find which CDS framework
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
 *  The full CDS framework has 400+ sub-indicators across 88 themes. Sending
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
import { createClient } from "@/lib/supabase/server";
import { recordUsage, withUsageContext } from "@/lib/usage/usage-tracker";
import { checkQuota } from "@/lib/usage/quota";
import { buildFinalAnalysisPrompt, buildInterviewPrompt } from "@/lib/data/prompts";
import {
  normalise,
  sanitizeFreeText,
  parseModelJson,
  normalizeReportTitle,
  enrichDetailedAssessments,
  enrichTreatment,
  computeOverallStats,
  expandKnowledgeQuery,
  formatKnowledgeContext,
  formatCriteriaContext,
  getRecentTranscriptWindow,
  buildUnexploredThemesContext,
  type CriteriaRow,
  type KnowledgeRow,
} from "@/lib/ai/assessment-helpers";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
// Experimental: lets the admin settings page sweep temperature per-model to
// find the best fit. Not a permanent feature — expected to be removed once
// we settle on a model.
const DEFAULT_TEMPERATURE = 0.7;

// ─── RAG: lightweight local re-scoring (no extra network call) ───────────────
// A pure embedding top-K has a known precision gap: cosine similarity often
// surfaces items that are merely topically adjacent to the query rather than
// actually on-topic. The obvious fix is a dedicated reranker model, but no
// such model is reliably available on OpenRouter today — we tried routing
// through a full chat model as an LLM listwise reranker, but that adds a
// whole extra network round-trip per retrieval call (2 per interview turn:
// criteria + knowledge), which measured out to several extra seconds per
// turn — worse than the precision problem it was meant to fix. Reverted.
//
// Instead: a hybrid dense+lexical re-score done entirely in-process, with
// effectively zero added latency. We still cast a wider net from pgvector
// (cheap — same query, just a higher match_count), then blend each
// candidate's embedding similarity with a lexical keyword-overlap score
// against the query. Keyword overlap catches exact domain-term matches
// (e.g. "disiplin", "tanggung jawab", "sabar") that a bi-encoder can
// under-weight, without needing a second model call.

const STOPWORDS_ID = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "dengan", "pada", "adalah",
  "itu", "ini", "atau", "juga", "akan", "tidak", "ada", "saya", "kamu",
  "dia", "nya", "apa", "bagaimana", "siapa", "mengapa", "kenapa", "boleh",
  "bisa", "tolong", "ceritakan", "jelaskan", "guru", "murid", "ustadz",
  "santri", "sudah", "belum", "sangat", "lebih", "kurang", "banyak", "saat",
  "hari", "kalau", "jika", "karena", "sebagai", "atas", "dalam", "oleh",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS_ID.has(word));
}

/**
 * Blends each candidate's pgvector cosine similarity with a lexical
 * keyword-overlap score against the query, then returns the top `topK`.
 * Pure in-process computation — no network call, sub-millisecond even for
 * a few dozen candidates. `label` is just for the console logs below, to
 * make it easy to see whether this is actually changing anything.
 */
// Added to the combined score of a row that belongs to an org-specific
// supplementary framework (organization_id set), so it consistently outranks
// equally-similar global rows and actually surfaces in conversation instead
// of only doing so when it happens to also win on similarity/lexical overlap.
const ORG_PRIORITY_BOOST = 0.12;

function hybridRescore<T extends { similarity: number; organization_id?: string | null }>(
  query: string,
  candidates: T[],
  toText: (item: T) => string,
  topK: number,
  label: string,
): T[] {
  if (candidates.length <= topK) return candidates;

  const startedAt = Date.now();
  const queryTokens = new Set(tokenize(query));

  const scored = candidates.map((row) => {
    const rowTokens = tokenize(toText(row));
    const overlap = rowTokens.filter((t) => queryTokens.has(t)).length;
    const lexicalScore = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
    // Embedding similarity stays the dominant signal; lexical overlap is a
    // boost for candidates that share exact domain terms with the query.
    const orgBoost = row.organization_id ? ORG_PRIORITY_BOOST : 0;
    const combinedScore = row.similarity + lexicalScore * 0.25 + orgBoost;
    return { row, combinedScore, lexicalScore };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);
  const picked = scored.slice(0, topK);
  const elapsedMs = Date.now() - startedAt;

  // Log which originally-top embedding matches got displaced by the lexical
  // boost — the clearest signal of whether this is doing anything useful.
  const originalTopTexts = new Set(candidates.slice(0, topK).map(toText));
  const promoted = picked.filter((p) => !originalTopTexts.has(toText(p.row)));

  console.log(
    `[RAG][${label}] rescored ${candidates.length} -> ${picked.length} candidates in ${elapsedMs}ms` +
    (promoted.length > 0 ? ` (${promoted.length} promoted by lexical overlap)` : ` (embedding order unchanged)`)
  );
  if (promoted.length > 0) {
    console.log(
      `[RAG][${label}] promoted:`,
      promoted.map((p) => ({ sim: p.row.similarity.toFixed(3), lex: p.lexicalScore.toFixed(2), text: toText(p.row).slice(0, 70) }))
    );
  }

  return picked.map((p) => p.row);
}

// ─── Deterministic Stats & Enrichment Helpers ────────────────────────────────
// The AI only sees ~30 retrieved criteria via RAG, so we cannot trust its
// self-reported overall_stats counts. Instead, we extract all fulfilled
// sub-indicator strings from the AI's JSON and count them ourselves by
// cross-referencing the FULL local framework. This is always 100% accurate.
// See lib/ai/assessment-helpers.ts for the pure enrichment/stats functions.

/**
 * Builds the set of every sub-indicator this student has EVER had fulfilled,
 * across all their prior reports. Used to gate declined_sub_indicators: a
 * sub-indicator can only "regress" if it was actually achieved at some point
 * — you can't decline something that was never gained.
 */
async function getEverFulfilledSubIndicators(db: any, studentId: string): Promise<Set<string>> {
  const { data: priorReports } = await db
    .from("reports")
    .select("treatment_plan")
    .eq("student_id", studentId);

  const everFulfilled = new Set<string>();
  (priorReports ?? []).forEach((r: any) => {
    let plan = r.treatment_plan;
    if (typeof plan === "string") {
      try { plan = JSON.parse(plan); } catch { return; }
    }
    const assessments = Array.isArray(plan?.detailed_assessments) ? plan.detailed_assessments : [];
    assessments.forEach((a: any) => {
      (a?.fulfilled_sub_indicators ?? []).forEach((s: any) => everFulfilled.add(normalise(String(s))));
    });
  });
  return everFulfilled;
}

/**
 * Deterministically strips any declined_sub_indicators the AI proposed for a
 * sub-indicator this student has never actually fulfilled before — the AI is
 * instructed not to do this, but this makes it impossible regardless of
 * prompt compliance. Doing this here (at finalize/results time) rather than
 * trusting the AI keeps cumulative fulfillment counts from ever needing a
 * sub-indicator to be "fulfilled" a negative number of times.
 */
async function stripUngroundedDeclines(
  enrichedAssessments: any[],
  studentId: string | undefined,
  db: any,
): Promise<any[]> {
  if (!studentId) {
    return enrichedAssessments.map((a) => ({ ...a, declined_sub_indicators: [] }));
  }
  const everFulfilled = await getEverFulfilledSubIndicators(db, studentId);
  return enrichedAssessments.map((a) => ({
    ...a,
    declined_sub_indicators: (a.declined_sub_indicators ?? []).filter((sub: string) =>
      everFulfilled.has(normalise(sub))
    ),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  model: string = CHAT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      temperature,
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
  recordUsage({
    provider: "openrouter",
    model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  });
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
  recordUsage({
    provider: "openrouter",
    model: EMBEDDING_MODEL,
    purpose: "embedding",
    inputTokens: data.usage?.prompt_tokens ?? data.usage?.total_tokens ?? 0,
  });
  return data.data[0].embedding as number[];
}

// ─── RAG: Retrieve the top-N most relevant criteria from Supabase ─────────────

async function retrieveRelevantCriteria(
  transcript: string,
  topK = 25,
  organizationId?: string | null
): Promise<CriteriaRow[]> {
  const startedAt = Date.now();
  const embedding = await embedText(transcript);
  const embedMs = Date.now() - startedAt;

  // Cast a slightly wider net than topK — cheap (same query, higher
  // match_count) and gives hybridRescore below more to work with.
  const candidateCount = Math.min(topK * 3, 90);
  const { data, error } = await supabase.rpc("match_cia_criteria", {
    query_embedding: embedding,
    match_threshold: 0.15,
    match_count: candidateCount,
    target_organization_id: organizationId ?? null,
  });

  if (error) throw new Error(`Supabase RPC Error: ${error.message}`);
  const candidates = (data as CriteriaRow[]) ?? [];
  console.log(
    `[RAG][criteria] embedText ${embedMs}ms, embedding search ${candidates.length}/${candidateCount} candidates (threshold 0.15)`
  );

  return hybridRescore(
    transcript,
    candidates,
    (row) => `${row.category} > ${row.theme} > ${row.indicator}: ${row.sub_indicator}`,
    topK,
    "criteria",
  );
}

// ─── RAG: Retrieve relevant knowledge chunks from the full PDF ────────────────
// Queries the pdf_knowledge table (seeded by scripts/ingest-pdf-knowledge.ts).
// This covers intro theory (p.4–74) + implementation guide + 25 Situasi chapters
// (p.254–596) — content that exists in the book but NOT in cia_criteria.
//
// Token budget: topK=4 chunks × ~120 tokens each ≈ 480 tokens added per call.
// Only injected when similarity > threshold, so irrelevant queries cost nothing.

async function retrieveRelevantKnowledge(
  query: string,
  topK = 5,
  organizationId?: string | null
): Promise<KnowledgeRow[]> {
  try {
    const startedAt = Date.now();
    const expandedQuery = expandKnowledgeQuery(query);
    const embedding = await embedText(expandedQuery);
    const embedMs = Date.now() - startedAt;

    // Cast a slightly wider net than topK — cheap (same query, higher
    // match_count) and gives hybridRescore below more to work with.
    const candidateCount = Math.min(topK * 3, 90);
    const { data, error } = await supabase.rpc("match_pdf_knowledge", {
      query_embedding: embedding,
      match_threshold: 0.15,  // same as criteria — let the prompt handle relevance
      match_count: candidateCount,
      target_organization_id: organizationId ?? null,
    });

    if (error) {
      // Non-fatal: if the table doesn't exist yet (before migration), just return empty
      console.warn("[Knowledge RAG] RPC error (table may not exist yet):", error.message);
      return [];
    }

    const candidates = (data as KnowledgeRow[]) ?? [];
    console.log(
      `[RAG][knowledge] embedText ${embedMs}ms, embedding search ${candidates.length}/${candidateCount} candidates (threshold 0.15)`
    );

    return hybridRescore(
      expandedQuery,
      candidates,
      (row) => `[${row.section}] ${row.content.replace(/^\[[^\]]+\]\n/, "").trim().slice(0, 300)}`,
      topK,
      "knowledge",
    );
  } catch (err: any) {
    console.warn("[Knowledge RAG] Skipped:", err.message);
    return [];
  }
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
export async function generateStudentProfile(
  studentId: string,
  selectedModel: string = CHAT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
): Promise<void> {
  return withUsageContext({ purpose: "profile_summary", studentId }, async () => {
    try {
    const db = await createClient();

    // Fetch last 5 reports — enough history without blowing token budget
    const { data: reports } = await db
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
        const treatmentStatus = plan?.treatment?.status as string | undefined;
        const outcomeNote = String(plan?.treatment?.outcome_note ?? "").trim();

        // Extract up to 4 distinct assessed themes for context
        const themes: string[] = Array.isArray(plan?.detailed_assessments)
          ? Array.from(new Set(
              (plan.detailed_assessments as any[]).map((a) => String(a?.theme ?? "")).filter(Boolean)
            )).slice(0, 4)
          : [];

        let treatmentOutcomeLine: string | null = null;
        if (treatmentStatus === "completed") {
          treatmentOutcomeLine = `Hasil penanganan: SUDAH diterapkan ustadz.${outcomeNote ? ` Catatan ustadz tentang efektivitasnya: ${outcomeNote}` : ""}`;
        } else if (treatmentStatus === "declined") {
          treatmentOutcomeLine = `Hasil penanganan: TIDAK diterapkan ustadz.${outcomeNote ? ` Alasan: ${outcomeNote}` : ""}`;
        }

        return [
          `Laporan ${i + 1} (${date}):`,
          summary ? `Ringkasan: ${summary}` : null,
          themes.length > 0 ? `Tema yang dinilai: ${themes.join(", ")}` : null,
          priorityTheme ? `Prioritas penanganan: ${priorityTheme}${priorityIndicator ? ` → ${priorityIndicator}` : ""}` : null,
          treatmentOutcomeLine,
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
- Rencana penanganan yang SUDAH diterapkan dan efektivitasnya (jika ada catatan hasil penanganan), atau yang TIDAK diterapkan beserta alasannya — ini penting agar ustadz berikutnya tidak mengulang penanganan yang sudah terbukti tidak efektif atau ditolak
- Konteks singkat yang berguna bagi ustadz dan AI dalam asesmen berikutnya

Tulis seperti catatan profesional yang disiapkan untuk seseorang yang belum pernah bertemu santri ini. Gunakan gaya narasi yang alami, bukan daftar poin.

PENTING: Kembalikan HANYA teks profil mentah — tidak boleh ada JSON, tidak boleh ada array, tidak boleh ada markdown, tidak boleh ada judul, tidak boleh ada key-value. Hanya paragraf teks biasa.`;

    const profileText = await callOpenRouter(systemPrompt, reportContext, selectedModel, temperature);

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

    cleanProfile = sanitizeFreeText(cleanProfile);

    await db
      .from("students")
      .update({ profile_summary: cleanProfile })
      .eq("id", studentId);

    console.log(`[Profile] Updated profile for student ${studentId} (${cleanProfile.length} chars)`);
  } catch (err) {
    // Non-fatal — a missing profile just means the next interview runs without it
    console.error("[Profile] Failed to generate student profile:", err);
  }
  });
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
  selectedModel: string = CHAT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
) {
  return withUsageContext({ purpose: "interview_step", studentId }, async () => {
    try {
    const db = await createClient();

    // Hard-cap: block once the org's monthly report quota / subscription is spent.
    const quota = await checkQuota("report", { studentId });
    if (!quota.ok) {
      return { error: quota.message, quotaExceeded: true, quotaReason: quota.reason };
    }

    // Fetch the student's historical profile if a studentId was provided.
    // This is a single indexed read and adds ~250 tokens to the prompt.
    let studentProfile: string | undefined;
    let organizationId: string | null = null;
    if (studentId) {
      const { data: studentData } = await db
        .from("students")
        .select("profile_summary, organization_id")
        .eq("id", studentId)
        .single();
      studentProfile = studentData?.profile_summary ?? undefined;
      organizationId = studentData?.organization_id ?? null;
    }

    const recentWindow = getRecentTranscriptWindow(transcript, 4);

    // Run criteria RAG and knowledge RAG in parallel to save latency
    const [frontierRows, knowledgeRows] = await Promise.all([
      retrieveRelevantCriteria(recentWindow || transcript, 15, organizationId),
      retrieveRelevantKnowledge(recentWindow || transcript, 3, organizationId),
    ]);

    const frontierCriteriaContext = formatCriteriaContext(frontierRows);
    const unexploredThemesContext = buildUnexploredThemesContext(frontierRows, discoveredThemes, 4, organizationId);
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
      selectedModel,
      temperature
    );
    const parsed = parseModelJson(responseText, "Interview step");
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
  });
}

export async function finalizeAssessment(
  transcript: string,
  studentId?: string,
  discoveredThemes: string[] = [],
  selectedModel: string = CHAT_MODEL,
  temperature: number = DEFAULT_TEMPERATURE,
) {
  return withUsageContext({ purpose: "finalize", studentId }, async () => {
    try {
    const db = await createClient();

    // Hard-cap: block finalising a report once the monthly quota is spent.
    const quota = await checkQuota("report", { studentId });
    if (!quota.ok) {
      return { error: quota.message, quotaExceeded: true, quotaReason: quota.reason };
    }

    // 1. Fetch the student's previous progress + historical profile for context
    let currentProgressContext =
      "Belum ada data asesmen sebelumnya. Mulai dari awal kerangka kerja.";
    let studentProfile: string | undefined;
    let previousTitlesContext = "";
    let organizationId: string | null = null;

    if (studentId) {
      // Fetch profile and latest report in parallel to keep latency down
      const [profileResult, latestReportResult] = await Promise.all([
        db
          .from("students")
          .select("profile_summary, organization_id")
          .eq("id", studentId)
          .single(),
        db
          .from("reports")
          .select("treatment_plan")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      // Defensive: sanitize even here, in case an older profile_summary was
      // saved before this cleanup existed — otherwise a corrupted profile
      // keeps re-poisoning every future report via the injected context.
      const rawProfile = profileResult.data?.profile_summary ?? undefined;
      studentProfile = rawProfile ? sanitizeFreeText(rawProfile) : undefined;
      organizationId = profileResult.data?.organization_id ?? null;
      const latestReport = latestReportResult.data;

      if (studentProfile) {
        console.log(`[Finalize] Injecting student profile (${studentProfile.length} chars) into analysis prompt`);
      }

      const { data: recentTitles } = await db
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

        const prevTreatmentStatus = prevAnalysis?.treatment?.status as string | undefined;
        const prevOutcomeNote = String(prevAnalysis?.treatment?.outcome_note ?? "").trim();
        let prevTreatmentLine = "";
        if (prevTreatmentStatus === "completed") {
          prevTreatmentLine = `\nRENCANA PENANGANAN LAPORAN TERAKHIR SUDAH DITERAPKAN ustadz.${prevOutcomeNote ? ` Catatan efektivitas dari ustadz: "${prevOutcomeNote}"` : ""} Pertimbangkan hasil ini saat menyusun rencana penanganan baru — lanjutkan jika efektif, atau sesuaikan pendekatan jika catatan menunjukkan kurang berhasil.`;
        } else if (prevTreatmentStatus === "declined") {
          prevTreatmentLine = `\nRENCANA PENANGANAN LAPORAN TERAKHIR TIDAK DITERAPKAN ustadz.${prevOutcomeNote ? ` Alasan: "${prevOutcomeNote}"` : ""} JANGAN ulangi pendekatan yang sama tanpa penyesuaian — pertimbangkan alasan penolakan di atas.`;
        }

        currentProgressContext = `
PROGRES SEBELUMNYA (kumulatif dari seluruh laporan terdahulu):
- Character: ${prevAnalysis?.overall_stats?.karakter?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.karakter?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.karakter?.total ?? 0})
- Mental: ${prevAnalysis?.overall_stats?.mental?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.mental?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.mental?.total ?? 0})
- Soft Skill: ${prevAnalysis?.overall_stats?.soft_skill?.percentage ?? 0}% (${prevAnalysis?.overall_stats?.soft_skill?.fulfilled ?? 0}/${prevAnalysis?.overall_stats?.soft_skill?.total ?? 0})
${prevTreatmentLine}
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
      retrieveRelevantCriteria(transcript, 30, organizationId),
      retrieveRelevantKnowledge(transcript, 4, organizationId),
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
      selectedModel,
      temperature
    );
    const parsed = parseModelJson(responseText, "Finalize assessment");
    let enrichedAssessments = enrichDetailedAssessments(parsed?.detailed_assessments ?? [], organizationId);
    enrichedAssessments = await stripUngroundedDeclines(enrichedAssessments, studentId, db);
    parsed.analysis_version = 2;
    parsed.status_summary = sanitizeFreeText(String(parsed?.status_summary ?? ""));
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
    parsed.overall_stats = computeOverallStats(parsed, organizationId);
    console.log("[Stats] Computed overall_stats:", parsed.overall_stats);

    return parsed;
  } catch (error: any) {
    console.error("Finalize Assessment Error:", error);
    return { error: error.message };
  }
  });
}

export const runFullAnalysis = finalizeAssessment;
