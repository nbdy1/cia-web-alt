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
 * ElevenLabs requires the `user_read` permission on the API key to read
 * subscription/usage info (`/v1/user/subscription`); the key this app uses
 * for TTS may not have that scope, so this gracefully reports "unavailable"
 * rather than failing — see the `ok: false` branch.
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
  | { ok: true; charactersUsed: number; charactersLimit: number | null }
  | { ok: false; error: string };

export async function getElevenLabsLiveUsage(): Promise<ElevenLabsLiveUsageResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, error: "ELEVENLABS_API_KEY tidak diset di server." };

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.detail?.message ?? `ElevenLabs API error ${res.status}`;
      // Most common case: the key lacks the `user_read` permission needed to
      // read subscription/usage info (it may be scoped TTS-only).
      return { ok: false, error: message };
    }
    const json = await res.json();
    return {
      ok: true,
      charactersUsed: Number(json.character_count ?? 0),
      charactersLimit: json.character_limit != null ? Number(json.character_limit) : null,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Gagal menghubungi ElevenLabs." };
  }
}
