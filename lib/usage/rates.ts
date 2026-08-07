/**
 * lib/usage/rates.ts
 *
 * Provider cost rates in IDR. Used to compute `cost_idr` at log time so usage
 * rows carry an actual cost — this is the ONLY rate table the app actually
 * reads at runtime. There's also a seeded `ai_usage_rates` DB table
 * (scripts/migrations/20260711_saas_billing_usage.sql) intended as a rate
 * history/audit trail, but no code path queries it — it's not a live source
 * of truth, just documentation. Keep both in sync when re-pricing so the DB
 * table doesn't silently go stale and mislead anyone reading it directly.
 */

export type UsageProvider = 'openrouter' | 'elevenlabs';

interface Rate {
  inputPerMTokIdr?: number;   // per 1,000,000 input tokens
  outputPerMTokIdr?: number;  // per 1,000,000 output tokens
  per1kCharsIdr?: number;     // per 1,000 characters (TTS)
}

// Keyed by model string.
//
// google/gemini-3-flash-preview and openai/text-embedding-3-small are
// verified against OpenRouter's published per-token USD pricing ($0.50/M
// input + $3.00/M output, and $0.02/M respectively) converted at ~Rp17,950/US$
// — matches IDR_PER_USD below to within 0.1%, so these don't drift.
//
// flash-v2.5 (ElevenLabs) was originally priced far too low (898/1k chars) —
// reconciled 2026-08 against actual ElevenLabs billing (all-time cost was
// undercounted by ~35%, i.e. showing ~$34 against a real ~$46 spend) to
// 1215/1k chars. See scripts/migrations/20260805_correct_elevenlabs_rate.sql
// for the one-time historical backfill this required. If it drifts again,
// re-derive from your actual ElevenLabs invoice total rather than guessing —
// ElevenLabs bills in "credits" (~0.5-1 credit/char for Flash models) at a
// $/credit rate that depends on your plan tier, not a flat published rate.
const RATES: Record<string, Rate> = {
  'google/gemini-3-flash-preview': { inputPerMTokIdr: 8975, outputPerMTokIdr: 53850 },
  'openai/text-embedding-3-small': { inputPerMTokIdr: 359 },
  'flash-v2.5': { per1kCharsIdr: 1215 },
};

// Approximate conversion used only for the platform-admin usage dashboard's
// "≈ $X.XX" display — the app never bills or stores costs in USD, this just
// converts the already-computed cost_idr for readability against OpenRouter/
// ElevenLabs' own USD-denominated pricing pages. Update if it drifts far
// from the real rate; it doesn't affect any stored cost figure.
export const IDR_PER_USD = 17_927;

export function idrToUsd(idr: number | null | undefined): number {
  return (idr ?? 0) / IDR_PER_USD;
}

// eleven_flash_v2_5 bills exactly 1 character for every 4 raw text characters
// sent — verified 2026-08 by pulling 100 real /v1/history items and comparing
// each entry's text.length against its character_count_change_to/from delta
// (the account's actual billed-character counter): the ratio was 4.00-4.03x
// across every sample, and summing character-stats over the same time window
// matched the billed total, not the raw text total. Our own char_count column
// stores raw text.length (what we send, matching how per1kCharsIdr above was
// fit against real invoice totals — cost tracking is unaffected), so this
// divisor exists only to convert that into an ElevenLabs-comparable "billed
// characters" figure for the live-check reconciliation panel.
export const ELEVENLABS_FLASH_V25_BILLED_CHAR_DIVISOR = 4;

export function computeCostIdr(
  _provider: UsageProvider,
  model: string | null | undefined,
  usage: { inputTokens?: number; outputTokens?: number; charCount?: number },
): number {
  const rate = (model && RATES[model]) || {};
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  const chars = usage.charCount ?? 0;

  const cost =
    (inTok / 1_000_000) * (rate.inputPerMTokIdr ?? 0) +
    (outTok / 1_000_000) * (rate.outputPerMTokIdr ?? 0) +
    (chars / 1_000) * (rate.per1kCharsIdr ?? 0);

  // Round to 4 dp to match the NUMERIC(14,4) column.
  return Math.round(cost * 10_000) / 10_000;
}
