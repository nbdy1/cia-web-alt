"use server";

/**
 * app/actions/parent-updates.ts
 *
 * Writes AI DRAFTS for the parent dashboard into parent_contents (status
 * 'pending'). Nothing here is visible to a parent: the student's musyrif must
 * approve it first (app/actions/parent-review.ts).
 *
 * Per saved report:
 *   1. update cards   (1-2: "kabar baik" and/or "sedang didampingi")
 *   2. the month's summary (with trend labels computed in code)
 *   3. the character profile, when none exists yet or every 4th report
 * The AI only sees a digest of structured results (lib/parent.ts), never the
 * interview transcript or Mode BK notes. Generation is best-effort: a failure
 * never blocks saving the report.
 */
import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireOrganizationAdmin } from "@/lib/server/require-admin";
import { recordUsage, withUsageContext } from "@/lib/usage/usage-tracker";
import { parseModelJson } from "@/lib/ai/assessment-helpers";
import { monthBounds, monthKeyFromIso } from "@/lib/bk-monthly";
import {
  CARDS_SYSTEM_PROMPT,
  buildCardsUserMessage,
  buildPeriodUserMessage,
  computeTrends,
  detectSensitive,
  digestReportForParent,
  dominantAspect,
  firstName,
  monthLabel,
  periodSystemPrompt,
  sanitizeCards,
  sanitizePeriod,
  type AnyContent,
  type Aspect,
  type ContentType,
  type UpdateKind,
} from "@/lib/parent";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "google/gemini-3-flash-preview";
const HISTORY_REPORTS = 6;
const PROFILE_EVERY_N_REPORTS = 4;

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function callModel(system: string, message: string): Promise<unknown> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [{ role: "system", content: system }, { role: "user", content: message }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter error: ${await response.text()}`);
  const data = await response.json();
  recordUsage({
    provider: "openrouter",
    model: MODEL,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    realCostUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
  });
  return parseModelJson(String(data.choices?.[0]?.message?.content ?? ""), "parent-draft");
}

type Slot = {
  organization_id: string;
  student_id: string;
  content_type: ContentType;
  kind?: UpdateKind | null;
  aspect?: Aspect | null;
  report_id?: string | null;
  period_key?: string | null;
};

function slotQuery(slot: Slot, statuses: string[]) {
  let q = admin
    .from("parent_contents")
    .select("id, status, chain_id, version")
    .eq("student_id", slot.student_id)
    .eq("content_type", slot.content_type)
    .in("status", statuses);
  q = slot.kind ? q.eq("kind", slot.kind) : q.is("kind", null);
  q = slot.report_id ? q.eq("report_id", slot.report_id) : q.is("report_id", null);
  q = slot.period_key ? q.eq("period_key", slot.period_key) : q.is("period_key", null);
  return q.limit(1).maybeSingle();
}

/** Creates or refreshes the OPEN draft for a slot. Published rows are never touched. */
async function putDraft(slot: Slot, content: AnyContent, flags: { sensitive: boolean; reason: string | null }) {
  const { data: open } = await slotQuery(slot, ["pending", "held"]);
  if (open) {
    const { error } = await admin
      .from("parent_contents")
      .update({ draft: content, content, sensitive: flags.sensitive, sensitive_reason: flags.reason, aspect: slot.aspect ?? null, model_used: MODEL })
      .eq("id", open.id);
    if (error) throw error;
    return open.id as string;
  }
  const { data: published } = await slotQuery(slot, ["published"]);
  const { data, error } = await admin
    .from("parent_contents")
    .insert({
      organization_id: slot.organization_id,
      student_id: slot.student_id,
      content_type: slot.content_type,
      kind: slot.kind ?? null,
      aspect: slot.aspect ?? null,
      report_id: slot.report_id ?? null,
      period_key: slot.period_key ?? null,
      chain_id: published?.chain_id ?? undefined,
      version: published ? published.version + 1 : 1,
      draft: content,
      content,
      sensitive: flags.sensitive,
      sensitive_reason: flags.reason,
      model_used: MODEL,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Gagal menyimpan draf.");
  await admin.from("parent_content_audit").insert({
    content_id: data.id,
    organization_id: slot.organization_id,
    action: "generated",
    changes: { model: MODEL },
  });
  return data.id as string;
}

/**
 * Drafts for one saved report. `forceProfile` regenerates the character profile
 * (a new, unapproved version; the approved one stays visible until approval).
 */
export async function generateParentDraftsForReport(
  reportId: string,
  opts: { forceProfile?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id, student_id, organization_id, created_at")
      .eq("id", reportId)
      .single();
    if (reportError || !report) throw reportError ?? new Error("Laporan tidak ditemukan.");

    return await withUsageContext({ purpose: "profile_summary", studentId: report.student_id }, async () => {
      const { data: student } = await admin.from("students").select("name").eq("id", report.student_id).single();
      if (!student) throw new Error("Santri tidak ditemukan.");
      const nick = firstName(student.name);

      const { data: recent } = await admin
        .from("reports")
        .select("id, title, created_at, treatment_plan")
        .eq("student_id", report.student_id)
        .lte("created_at", report.created_at)
        .order("created_at", { ascending: false })
        .limit(HISTORY_REPORTS);
      if (!recent || recent.length === 0) throw new Error("Belum ada laporan.");
      const chronological = [...recent].reverse();
      const digests = chronological.map((r, i) => digestReportForParent(r, i));
      const latestDigest = digests[digests.length - 1];
      const errors: string[] = [];

      // 1. Update cards
      let sensitive = detectSensitive(latestDigest);
      try {
        const aspect = dominantAspect(recent[0].treatment_plan);
        const cards = sanitizeCards(await callModel(CARDS_SYSTEM_PROMPT, buildCardsUserMessage(nick, digests.slice(-3))), aspect);
        if (cards.sensitive && !sensitive.sensitive) sensitive = { sensitive: true, reason: cards.reason ?? "Ditandai sensitif oleh AI." };
        for (const card of cards.cards) {
          await putDraft(
            { organization_id: report.organization_id, student_id: report.student_id, content_type: "update", kind: card.kind, aspect: card.aspect, report_id: report.id },
            card.content,
            sensitive,
          );
        }
      } catch (e: any) {
        errors.push(`kartu: ${e.message}`);
      }

      // 2 + 3. Monthly summary (+ profile)
      try {
        const monthKey = monthKeyFromIso(report.created_at)!;
        const bounds = monthBounds(monthKey);
        const { data: allReports } = await admin
          .from("reports")
          .select("created_at, treatment_plan")
          .eq("student_id", report.student_id)
          .lt("created_at", bounds.endIso)
          .order("created_at", { ascending: false })
          .limit(40);

        const [{ data: existingProfile }, { count }, { data: homes }] = await Promise.all([
          admin.from("parent_contents").select("id").eq("student_id", report.student_id).eq("content_type", "profile").limit(1).maybeSingle(),
          admin.from("reports").select("id", { count: "exact", head: true }).eq("student_id", report.student_id),
          admin.from("parent_home_profiles").select("interests, habits, important_notes").eq("student_id", report.student_id),
        ]);
        const withProfile = !!opts.forceProfile || !existingProfile || (count ?? 0) % PROFILE_EVERY_N_REPORTS === 0;
        const homeNotes = (homes ?? [])
          .map((h: any) => [h.interests && `Minat: ${h.interests}`, h.habits && `Kebiasaan: ${h.habits}`, h.important_notes && `Penting: ${h.important_notes}`].filter(Boolean).join("; "))
          .filter(Boolean)
          .join("\n");

        const period = sanitizePeriod(
          await callModel(periodSystemPrompt(withProfile), buildPeriodUserMessage(nick, monthLabel(monthKey), digests, homeNotes)),
        );
        const trends = computeTrends(allReports ?? [], bounds);
        await putDraft(
          { organization_id: report.organization_id, student_id: report.student_id, content_type: "summary", period_key: monthKey },
          { ...period.summary, trends },
          sensitive,
        );
        if (withProfile && period.profile) {
          await putDraft(
            { organization_id: report.organization_id, student_id: report.student_id, content_type: "profile" },
            period.profile,
            sensitive,
          );
        }
      } catch (e: any) {
        errors.push(`ringkasan: ${e.message}`);
      }

      if (errors.length > 0) console.error("[parent-drafts]", errors.join(" | "));
      return errors.length === 2 ? { success: false, error: errors.join(" | ") } : { success: true };
    });
  } catch (error: any) {
    console.error("[parent-drafts] generation failed:", error);
    return { success: false, error: error?.message ?? "Gagal membuat draf untuk orang tua." };
  }
}

/** Admin: issue a new pairing code. Existing links stay; the old code stops working. */
export async function rotateParentCode(studentId: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const { data: s } = await admin.from("students").select("organization_id").eq("id", studentId).single();
    if (!s) throw new Error("Santri tidak ditemukan.");
    await requireOrganizationAdmin(s.organization_id);
    const { data: code, error: codeError } = await admin.rpc("generate_parent_code");
    if (codeError || !code) throw codeError ?? new Error("Gagal membuat kode.");
    const { error } = await admin.from("students").update({ parent_code: code }).eq("id", studentId);
    if (error) throw error;
    revalidatePath("/admin/orang-tua");
    return { success: true, code: code as string };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Gagal." };
  }
}
