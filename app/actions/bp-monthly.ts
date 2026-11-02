"use server";

/**
 * app/actions/bp-monthly.ts
 *
 * Mode BK "Rapor bulanan": one AI-written summary per student per month, built
 * from the counselling notes that already exist. This is the ONLY place that calls
 * the AI for monthly summaries, and it is deliberately frugal:
 *   - never automatic: it runs only when a person asks for it;
 *   - no sessions that month = no AI call;
 *   - nothing changed since the last generation = no AI call (returns "unchanged");
 *   - the AI sees a capped digest of existing notes: no transcripts, no retrieval
 *     (RAG/embeddings), and the student's name is not sent.
 * Facts (counts, dates, safety flags, follow-up tallies) are computed in code and
 * merged in after the AI answers (lib/bk-monthly.ts).
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { checkQuota } from "@/lib/usage/quota";
import { recordUsage, withUsageContext } from "@/lib/usage/usage-tracker";
import { normalizeAppLanguage } from "@/lib/data/language";
import { parseModelJson } from "@/lib/ai/assessment-helpers";
import {
  UnusableSummaryError,
  buildMonthlyPrompt,
  buildSessionDigest,
  deriveMonthFacts,
  diffSources,
  extractMonthCheckins,
  isValidMonthKey,
  monthBounds,
  monthStartDate,
  sanitizeMonthlySummary,
  type BkMonthlySummaryData,
  type BkSessionRow,
} from "@/lib/bk-monthly";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = "google/gemini-3-flash-preview";
// Summaries should be faithful, not creative.
const MAX_TEMPERATURE = 0.5;
// Enough history to find check-ins on older sessions without loading a whole file.
const SESSION_LOOKBACK = 30;

export type GenerateMonthlyResult =
  | { success: true; id: string; outcome: "created" | "updated" | "unchanged"; sessionsCount: number }
  | { success: false; error: string };

async function callModel(system: string, message: string, model: string, temperature: number) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: "system", content: system }, { role: "user", content: message }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter Chat Error: ${await response.text()}`);
  const data = await response.json();
  recordUsage({
    provider: "openrouter",
    model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    realCostUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
  });
  return String(data.choices?.[0]?.message?.content ?? "");
}

async function loadStudent(studentId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  const { data, error } = await db.rpc("get_student_organization_for_report", { target_student_id: studentId }).maybeSingle();
  if (error || !data) throw error ?? new Error("Siswa tidak ditemukan.");
  const organizationId = (data as { organization_id: string }).organization_id;
  await assertTenantOrganization(db, organizationId);
  return { db, user, organizationId };
}

export async function generateBpMonthlySummary(
  studentId: string,
  month: string,
  options: { model?: string; temperature?: number; language?: string; force?: boolean } = {},
): Promise<GenerateMonthlyResult> {
  return withUsageContext({ purpose: "bk_monthly", studentId }, async () => {
    try {
      if (!isValidMonthKey(month)) return { success: false, error: "Bulan tidak valid." };
      const { db, user, organizationId } = await loadStudent(studentId);

      const quota = await checkQuota("report", { studentId });
      if (!quota.ok) return { success: false, error: quota.message };

      const { startIso, endIso } = monthBounds(month);
      // Sessions up to the end of the month (most recent first). The month's own
      // sessions are the subject; older ones are only read for check-ins dated this month.
      const { data: rows, error: rowsError } = await db
        .from("bp_reports")
        .select("id, created_at, title, analysis")
        .eq("student_id", studentId)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(SESSION_LOOKBACK);
      if (rowsError) throw rowsError;
      const sessions = (rows ?? []) as BkSessionRow[];
      const monthSessions = sessions.filter((s) => s.created_at >= startIso);

      // No sessions: nothing to summarise and nothing to pay for.
      if (monthSessions.length === 0) return { success: false, error: "Tidak ada sesi bimbingan pada bulan ini." };

      const { data: existing } = await db
        .from("bp_monthly_summaries")
        .select("id, status, source_report_ids")
        .eq("student_id", studentId)
        .eq("period_month", monthStartDate(month))
        .maybeSingle();

      const currentIds = monthSessions.map((s) => s.id);
      if (existing?.status === "final") {
        return { success: false, error: "Rapor ini sudah final. Buka kembali sebagai draft terlebih dahulu bila ingin memperbaruinya." };
      }
      // Already up to date: do not spend tokens regenerating the same thing.
      if (existing && !options.force && !diffSources(existing.source_report_ids ?? [], currentIds).isStale) {
        return { success: true, id: existing.id, outcome: "unchanged", sessionsCount: monthSessions.length };
      }

      const language = normalizeAppLanguage(options.language);
      const checkins = extractMonthCheckins(sessions, startIso, endIso);
      const facts = deriveMonthFacts(monthSessions, checkins);
      const digest = buildSessionDigest(monthSessions, checkins);
      const model = options.model || DEFAULT_MODEL;
      const temperature = Math.min(Math.max(options.temperature ?? 0.3, 0), MAX_TEMPERATURE);

      const raw = await callModel(buildMonthlyPrompt(language, month, facts), `CATATAN SESI BIMBINGAN:\n${digest.text}`, model, temperature);
      const summary: BkMonthlySummaryData = sanitizeMonthlySummary(parseModelJson(raw, "BK monthly"), facts, month, language);

      const payload = {
        summary,
        sessions_count: monthSessions.length,
        source_report_ids: currentIds,
        model_used: model,
        generated_at: new Date().toISOString(),
      };

      if (existing) {
        // teacher_note is intentionally left alone: a regenerated draft keeps the counselor's own words.
        const { error } = await db.from("bp_monthly_summaries").update({ ...payload, generated_by: user.id, status: "draft" }).eq("id", existing.id);
        if (error) throw error;
        revalidatePath("/bk/monthly");
        return { success: true, id: existing.id, outcome: "updated", sessionsCount: monthSessions.length };
      }

      const { data: created, error } = await db
        .from("bp_monthly_summaries")
        .insert({ ...payload, organization_id: organizationId, student_id: studentId, period_month: monthStartDate(month), generated_by: user.id })
        .select("id")
        .single();
      if (error) {
        // Unique (student, month): someone else generated it between our check and insert.
        if ((error as any).code === "23505") return { success: false, error: "Rapor bulan ini baru saja dibuat oleh pengguna lain. Muat ulang halaman." };
        throw error;
      }
      revalidatePath("/bk/monthly");
      return { success: true, id: created.id, outcome: "created", sessionsCount: monthSessions.length };
    } catch (error: any) {
      console.error("BK monthly summary error:", error);
      if (error instanceof UnusableSummaryError) return { success: false, error: error.message };
      return { success: false, error: error?.message ?? "Rapor bulanan belum dapat dibuat." };
    }
  });
}

/**
 * Counselor edits: the overview wording, their own note, and draft/final. Marking
 * final freezes the text (regenerating is refused until it is reopened as a draft).
 */
export async function updateBpMonthlySummary(
  id: string,
  patch: { overview?: string; teacherNote?: string; status?: "draft" | "final" },
): Promise<{ success: true; status: "draft" | "final" } | { success: false; error: string }> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Silakan masuk kembali.");

    const { data: row, error: readError } = await db
      .from("bp_monthly_summaries")
      .select("id, organization_id, status, summary, teacher_note")
      .eq("id", id)
      .maybeSingle();
    if (readError || !row) throw readError ?? new Error("Rapor tidak ditemukan.");
    await assertTenantOrganization(db, row.organization_id);

    if (row.status === "final" && patch.status !== "draft") {
      return { success: false, error: "Rapor sudah final. Buka kembali sebagai draft untuk mengubahnya." };
    }

    const update: Record<string, unknown> = {};
    const summary = { ...(row.summary as Record<string, any>) };
    if (patch.overview !== undefined) {
      const overview = patch.overview.trim();
      if (overview.length < 20) return { success: false, error: "Gambaran bulan ini terlalu singkat." };
      if (overview.length > 2000) return { success: false, error: "Gambaran bulan ini terlalu panjang (maksimal 2000 karakter)." };
      summary.overview = overview;
      update.summary = summary;
    }
    if (patch.teacherNote !== undefined) {
      if (patch.teacherNote.length > 4000) return { success: false, error: "Catatan guru terlalu panjang (maksimal 4000 karakter)." };
      update.teacher_note = patch.teacherNote.trim();
    }
    if (patch.status !== undefined) {
      if (patch.status !== "draft" && patch.status !== "final") return { success: false, error: "Status tidak valid." };
      update.status = patch.status;
    }
    if (Object.keys(update).length === 0) return { success: true, status: row.status };

    const { data, error } = await db.from("bp_monthly_summaries").update(update).eq("id", id).select("status").maybeSingle();
    if (error) throw error;
    // RLS turns a forbidden update into zero rows rather than an error.
    if (!data) return { success: false, error: "Perubahan ditolak. Anda tidak memiliki akses ke rapor ini." };

    revalidatePath(`/bk/monthly/${id}`);
    revalidatePath("/bk/monthly");
    return { success: true, status: data.status };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Perubahan belum dapat disimpan." };
  }
}
