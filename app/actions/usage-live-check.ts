/**
 * app/actions/usage-live-check.ts
 *
 * Server actions that ask OpenRouter / ElevenLabs directly "how much have we
 * really spent", for /super-admin/usage's live reconciliation panel — a
 * second, independent source of truth to compare our own ai_usage_events
 * tracking against, so drift (like the ElevenLabs rate bug fixed in
 * 20260805_correct_elevenlabs_rate.sql) is visible instead of silent.
 *
 * OpenRouter's `/key` endpoint reports real usage for the calling API key —
 * today/this-week/this-month/all-time, in USD — with no special permissions
 * needed beyond the key itself.
 *
 * ElevenLabs: `/v1/user/subscription` (and `/v1/user`) need the `user_read`
 * permission, which our key doesn't have and getting it granted didn't
 * change anything — those endpoints kept 403ing even after a permissions
 * update, because `user_read` is a distinct scope from "workspace
 * analytics"/usage reporting. `/v1/usage/character-stats` is a DIFFERENT
 * endpoint that works with our existing key (verified live) and returns
 * real daily character counts — which is actually a *better* fit here than
 * the subscription endpoint's cycle total: it's a rate-independent check
 * (raw characters, not cost) directly comparable day-by-day against our own
 * tracked char_count, the same way the OpenRouter panel compares $.
 */
"use server";

export type LiveUsageResult =
  | { ok: true; usageDaily: number; usageWeekly: number; usageMonthly: number; usageAllTime: number }
  | { ok: false; error: string };

export async function getOpenRouterLiveUsage(): Promise<LiveUsageResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY tidak diset di server." };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `OpenRouter API error ${res.status}` };
    }
    const json = await res.json();
    const d = json?.data ?? {};
    return {
      ok: true,
      usageDaily: Number(d.usage_daily ?? 0),
      usageWeekly: Number(d.usage_weekly ?? 0),
      usageMonthly: Number(d.usage_monthly ?? 0),
      usageAllTime: Number(d.usage ?? 0),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Gagal menghubungi OpenRouter." };
  }
}

export type ElevenLabsLiveUsageResult =
  | { ok: true; charsDaily: number; charsWeekly: number; charsMonthly: number }
  | { ok: false; error: string };

// UTC-midnight day boundaries, matching how usage_daily() buckets our own
// ai_usage_events (date_trunc('day', created_at)) and how ElevenLabs itself
// timestamps character-stats buckets (verified live — both land on UTC
// midnight), so summing by day-string equality lines up exactly.
function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function utcWeekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}
function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getElevenLabsLiveUsage(): Promise<ElevenLabsLiveUsageResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, error: "ELEVENLABS_API_KEY tidak diset di server." };

  const now = new Date();
  // 35 days comfortably covers "this week" even when it spans into the
  // previous month (e.g. week starts on the last Monday of last month) —
  // days before whatever boundary we actually need are just ignored below.
  const startUnix = now.getTime() - 35 * 24 * 3600 * 1000;
  const endUnix = now.getTime();

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/usage/character-stats?start_unix=${startUnix}&end_unix=${endUnix}&breakdown_type=none`,
      { headers: { "xi-api-key": key }, cache: "no-store" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.detail?.message ?? `ElevenLabs API error ${res.status}`;
      return { ok: false, error: message };
    }
    const json = await res.json();
    const time: number[] = json?.time ?? [];
    const all: number[] = json?.usage?.All ?? [];

    const todayMs = utcDayStart(now).getTime();
    const weekStartMs = utcWeekStart(now).getTime();
    const monthStartMs = utcMonthStart(now).getTime();

    let charsDaily = 0, charsWeekly = 0, charsMonthly = 0;
    for (let i = 0; i < time.length; i++) {
      const bucketMs = time[i];
      const chars = Number(all[i] ?? 0);
      if (bucketMs >= monthStartMs) charsMonthly += chars;
      if (bucketMs >= weekStartMs) charsWeekly += chars;
      if (bucketMs === todayMs) charsDaily += chars;
    }

    return { ok: true, charsDaily, charsWeekly, charsMonthly };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Gagal menghubungi ElevenLabs." };
  }
}
