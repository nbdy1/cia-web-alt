/**
 * lib/bk-monthly.ts
 *
 * Pure logic for the Mode BK "Rapor bulanan" (monthly counselling summary):
 * month boundaries in the school's time zone, what is sent to the AI, which facts
 * are computed in code instead of trusted to the AI, and how stored AI output is
 * sanitised. No I/O, so it is unit tested (tests/bk-monthly.test.ts).
 *
 * Design principles baked in here:
 *  - Cost: the AI only ever sees a short digest of notes that already exist (never
 *    full transcripts, no retrieval), capped in size. Zero sessions = zero AI calls.
 *  - Safety: session counts, dates, "needs immediate attention" flags and follow-up
 *    tallies are derived deterministically. The AI writes prose, not facts.
 *  - Fairness: a "trend" is never claimed from a single session.
 */
import { dateKeyInZone } from "@/lib/requirement-rules";

export type MonthKey = string; // "YYYY-MM", in Asia/Jakarta
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const APP_UTC_OFFSET = "+07:00";

export function isValidMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/** The calendar month (school time zone) an instant falls in. */
export function monthKeyFromIso(value: string | number | Date): MonthKey | null {
  const key = dateKeyInZone(value);
  return key ? key.slice(0, 7) : null;
}

export function monthStartDate(key: MonthKey): string {
  return `${key}-01`;
}

function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export const nextMonthKey = (key: MonthKey) => shiftMonth(key, 1);
export const previousMonthKey = (key: MonthKey) => shiftMonth(key, -1);

/** [start, end) of a month as UTC instants, for database range filters. */
export function monthBounds(key: MonthKey): { startIso: string; endIso: string } {
  return {
    startIso: new Date(`${key}-01T00:00:00${APP_UTC_OFFSET}`).toISOString(),
    endIso: new Date(`${nextMonthKey(key)}-01T00:00:00${APP_UTC_OFFSET}`).toISOString(),
  };
}

/** Most recent months first, starting with the month containing `todayKey`. */
export function recentMonthKeys(todayKey: string, count: number): MonthKey[] {
  const current = todayKey.slice(0, 7);
  return Array.from({ length: Math.max(0, count) }, (_, i) => shiftMonth(current, -i));
}

/**
 * Which month a teacher most likely wants a rapor for: right after a month ends
 * (first week) that is the month that just finished, otherwise the current one.
 */
export function defaultReportMonth(todayKey: string): MonthKey {
  const day = Number(todayKey.slice(8, 10));
  const current = todayKey.slice(0, 7);
  return day <= 7 ? previousMonthKey(current) : current;
}

export function monthLabel(key: MonthKey, locale: string): string {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", month: "long", year: "numeric" });
}

// ─── Reading session notes ───────────────────────────────────────────────────

export type BkSessionRow = { id: string; created_at: string; title?: string | null; analysis: unknown };

export function parseAnalysis(raw: unknown): Record<string, any> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
}

export function clip(value: unknown, max: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function strings(value: unknown, limit: number, max: number): string[] {
  return Array.isArray(value) ? value.map((item) => clip(item, max)).filter(Boolean).slice(0, limit) : [];
}

export type BkCheckin = { sessionTitle: string; outcome: "done" | "not_done"; reflection: string; date: string };

/** Follow-up check-ins dated inside the month, on ANY of the student's recent sessions. */
export function extractMonthCheckins(sessions: BkSessionRow[], startIso: string, endIso: string): BkCheckin[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const out: BkCheckin[] = [];
  for (const session of sessions) {
    const analysis = parseAnalysis(session.analysis);
    const checkins: any[] = Array.isArray(analysis.follow_up_checkins) ? analysis.follow_up_checkins : [];
    for (const checkin of checkins) {
      const at = checkin?.created_at ? new Date(checkin.created_at).getTime() : NaN;
      if (!Number.isFinite(at) || at < start || at >= end) continue;
      out.push({
        sessionTitle: clip(session.title, 80),
        outcome: checkin?.outcome === "done" ? "done" : "not_done",
        reflection: clip(checkin?.reflection, 220),
        date: dateKeyInZone(at) ?? "",
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Deterministic facts ─────────────────────────────────────────────────────

export type BkMonthFacts = {
  sessionsCount: number;
  sessionDates: string[];
  /** Sessions the counselor flagged as needing immediate attention, copied verbatim (clipped). */
  safetyFlags: Array<{ date: string; note: string }>;
  followUps: { done: number; notDone: number };
};

/** Counts, dates and safety flags come from the data, never from the AI. */
export function deriveMonthFacts(monthSessions: BkSessionRow[], checkins: BkCheckin[]): BkMonthFacts {
  const ordered = [...monthSessions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const safetyFlags: BkMonthFacts["safetyFlags"] = [];
  for (const session of ordered) {
    const analysis = parseAnalysis(session.analysis);
    if (analysis.needs_immediate_attention === true) {
      safetyFlags.push({ date: dateKeyInZone(session.created_at) ?? "", note: clip(analysis.safety_note, 400) });
    }
  }
  return {
    sessionsCount: ordered.length,
    sessionDates: ordered.map((s) => dateKeyInZone(s.created_at) ?? "").filter(Boolean),
    safetyFlags,
    followUps: {
      done: checkins.filter((c) => c.outcome === "done").length,
      notDone: checkins.filter((c) => c.outcome === "not_done").length,
    },
  };
}

// ─── What the AI sees ────────────────────────────────────────────────────────

export const MAX_DIGEST_SESSIONS = 10;

/**
 * A compact, bounded text of the month's notes. Uses each session's already
 * written analysis (not the transcript), so the input stays small however long the
 * conversations were. Oldest first so the AI can see how the month unfolded.
 */
export function buildSessionDigest(
  monthSessions: BkSessionRow[],
  checkins: BkCheckin[],
  maxSessions: number = MAX_DIGEST_SESSIONS,
): { text: string; included: number; omitted: number } {
  const ordered = [...monthSessions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const omitted = Math.max(0, ordered.length - maxSessions);
  const used = ordered.slice(omitted); // keep the most recent when over the cap

  const blocks = used.map((session, index) => {
    const a = parseAnalysis(session.analysis);
    const lines = [
      `Sesi ${index + 1 + omitted} (${dateKeyInZone(session.created_at) ?? "?"}) — ${clip(session.title, 100)}`,
      a.summary ? `Ringkasan: ${clip(a.summary, 450)}` : null,
      strings(a.presenting_concerns, 3, 160).length ? `Perhatian: ${strings(a.presenting_concerns, 3, 160).join("; ")}` : null,
      strings(a.strengths, 3, 140).length ? `Kekuatan: ${strings(a.strengths, 3, 140).join("; ")}` : null,
      strings(a.goals, 3, 140).length ? `Tujuan: ${strings(a.goals, 3, 140).join("; ")}` : null,
      strings(a.recommended_actions, 3, 160).length ? `Langkah guru: ${strings(a.recommended_actions, 3, 160).join("; ")}` : null,
      strings(a.student_actions, 2, 140).length ? `Langkah siswa: ${strings(a.student_actions, 2, 140).join("; ")}` : null,
      a.parent_communication ? `Orang tua: ${clip(a.parent_communication, 220)}` : null,
      a.follow_up ? `Tindak lanjut: ${clip(a.follow_up, 220)}` : null,
      a.needs_immediate_attention === true ? "CATATAN KESELAMATAN: sesi ini ditandai perlu perhatian segera." : null,
    ].filter(Boolean);
    return lines.join("\n");
  });

  const checkinLines = checkins.slice(0, 8).map((c) => `${c.date} — ${c.outcome === "done" ? "Sudah dicoba" : "Belum sempat"}${c.reflection ? `: ${c.reflection}` : ""} (sesi: ${c.sessionTitle})`);
  const text = [
    ...blocks,
    checkinLines.length ? `TINDAK LANJUT YANG TERCATAT BULAN INI:\n${checkinLines.join("\n")}` : null,
    omitted > 0 ? `(${omitted} sesi lebih awal pada bulan ini tidak disertakan karena batas ringkasan.)` : null,
  ].filter(Boolean).join("\n\n");
  return { text, included: used.length, omitted };
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

export function buildMonthlyPrompt(language: "id" | "en", period: string, facts: { sessionsCount: number; followUps: { done: number; notDone: number } }) {
  const languageLine =
    language === "en"
      ? "Write every user-facing field in warm, professional English."
      : "Tulis seluruh isi dalam Bahasa Indonesia yang hangat dan profesional.";
  return `Anda membantu guru Bimbingan dan Konseling (BK) sekolah menyusun RAPOR BULANAN BK untuk satu peserta didik, dari catatan sesi bimbingan yang SUDAH ditulis (periode ${period}). Ini adalah ringkasan perkembangan layanan bimbingan, BUKAN penilaian CMS dan BUKAN diagnosis.

${languageLine}

ATURAN:
- Gunakan HANYA informasi pada CATATAN SESI di bawah. Jangan menambah fakta, kejadian, atau nama. Bila informasi tidak ada, kosongkan bagiannya.
- Hangat, empatik, tidak menghakimi. Jangan melabeli peserta didik secara permanen dan jangan memberi diagnosis medis/psikologis.
- Kelompokkan topik ke bidang bimbingan: "pribadi", "sosial", "belajar", "karier" — hanya bidang yang benar-benar muncul pada catatan.
- "progress" hanya berisi perkembangan yang didukung catatan (termasuk hasil tindak lanjut yang tercatat). Jangan melebih-lebihkan.
- Pada bulan ini ada ${facts.sessionsCount} sesi dan ${facts.followUps.done + facts.followUps.notDone} catatan tindak lanjut. Bila hanya ada satu sesi tanpa tindak lanjut, jangan menyimpulkan tren: isi "trend" dengan "belum_cukup_data".
- "next_month_plan" realistis dan selaras dengan tindak lanjut yang sudah tertulis.
- Bila ada CATATAN KESELAMATAN, sebutkan secara netral bahwa ada hal yang memerlukan perhatian dan tindak lanjut sesuai prosedur sekolah; jangan menambah detail yang tidak tertulis.

BALAS HANYA JSON:
{
  "overview": "gambaran bulan ini, 3-5 kalimat",
  "areas": [{"area": "pribadi | sosial | belajar | karier", "note": "inti topik pada bidang ini"}],
  "progress": ["perkembangan yang terlihat"],
  "ongoing_concerns": ["hal yang masih perlu perhatian"],
  "strengths": ["kekuatan yang dapat diandalkan"],
  "actions_taken": ["langkah yang sudah dilakukan guru/siswa"],
  "next_month_plan": ["rencana bimbingan bulan depan"],
  "parent_collaboration": "kolaborasi dengan orang tua bila ada, atau string kosong",
  "trend": "membaik | stabil | perlu_dipantau | belum_cukup_data"
}`;
}

// ─── Stored summary shape ────────────────────────────────────────────────────

export const BK_AREAS = ["pribadi", "sosial", "belajar", "karier"] as const;
export type BkArea = (typeof BK_AREAS)[number];
export const BK_TRENDS = ["membaik", "stabil", "perlu_dipantau", "belum_cukup_data"] as const;
export type BkTrend = (typeof BK_TRENDS)[number];

export type BkMonthlySummaryData = {
  version: 1;
  period: MonthKey;
  language: "id" | "en";
  facts: BkMonthFacts;
  overview: string;
  areas: Array<{ area: BkArea; note: string }>;
  progress: string[];
  ongoing_concerns: string[];
  strengths: string[];
  actions_taken: string[];
  next_month_plan: string[];
  parent_collaboration: string;
  trend: BkTrend;
};

export class UnusableSummaryError extends Error {}

/**
 * Turns raw model JSON into the stored shape: clamps lengths, restricts enums, and
 * enforces rules the AI must not decide (no trend from a single session; facts
 * always from the data). Throws when the output has no usable overview so junk is
 * never saved.
 */
export function sanitizeMonthlySummary(
  raw: unknown,
  facts: BkMonthFacts,
  period: MonthKey,
  language: "id" | "en",
): BkMonthlySummaryData {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const overview = clip(obj.overview, 1500);
  if (overview.length < 20) throw new UnusableSummaryError("Hasil ringkasan dari AI tidak lengkap. Silakan coba lagi.");

  const seen = new Set<string>();
  const areas: BkMonthlySummaryData["areas"] = [];
  for (const item of Array.isArray(obj.areas) ? obj.areas : []) {
    const area = String(item?.area ?? "").toLowerCase() as BkArea;
    if (!BK_AREAS.includes(area) || seen.has(area)) continue;
    seen.add(area);
    areas.push({ area, note: clip(item?.note, 300) });
  }

  const requestedTrend = String(obj.trend ?? "") as BkTrend;
  const hasBasisForTrend = facts.sessionsCount >= 2 || facts.followUps.done + facts.followUps.notDone > 0;
  const trend: BkTrend = hasBasisForTrend && BK_TRENDS.includes(requestedTrend) ? requestedTrend : "belum_cukup_data";

  return {
    version: 1,
    period,
    language,
    facts,
    overview,
    areas: areas.slice(0, 4),
    progress: strings(obj.progress, 6, 300),
    ongoing_concerns: strings(obj.ongoing_concerns, 6, 300),
    strengths: strings(obj.strengths, 6, 300),
    actions_taken: strings(obj.actions_taken, 6, 300),
    next_month_plan: strings(obj.next_month_plan, 6, 300),
    parent_collaboration: clip(obj.parent_collaboration, 500),
    trend,
  };
}

// ─── Freshness / state ───────────────────────────────────────────────────────

export type SummaryState = "missing" | "draft" | "final" | "outdated";

/** `outdated` = sessions exist that the stored summary was not built from. */
export function diffSources(storedIds: string[], currentIds: string[]): { newCount: number; isStale: boolean } {
  const stored = new Set(storedIds);
  const newCount = currentIds.filter((id) => !stored.has(id)).length;
  const removed = storedIds.filter((id) => !currentIds.includes(id)).length;
  return { newCount, isStale: newCount > 0 || removed > 0 };
}

export function summaryState(
  existing: { status: string; source_report_ids: string[] } | null | undefined,
  currentIds: string[],
): SummaryState {
  if (!existing) return "missing";
  if (existing.status === "final") return "final";
  return diffSources(existing.source_report_ids ?? [], currentIds).isStale ? "outdated" : "draft";
}

/** Students worth summarising by default: more than one session, or a safety flag. */
export function isSuggestedForSummary(sessionsCount: number, hasSafetyFlag: boolean, checkinCount = 0): boolean {
  return sessionsCount >= 2 || hasSafetyFlag || checkinCount > 0;
}
