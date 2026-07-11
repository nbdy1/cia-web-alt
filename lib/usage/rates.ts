/**
 * lib/usage/rates.ts
 *
 * Provider cost rates in IDR, mirroring the seeded `ai_usage_rates` table.
 * Used to compute `cost_idr` at log time so usage rows carry an actual cost.
 * Keep these in sync with scripts/migrations/20260711_saas_billing_usage.sql
 * (the DB table remains the canonical reference if you re-price).
 */

export type UsageProvider = 'openrouter' | 'elevenlabs';

interface Rate {
  inputPerMTokIdr?: number;   // per 1,000,000 input tokens
  outputPerMTokIdr?: number;  // per 1,000,000 output tokens
  per1kCharsIdr?: number;     // per 1,000 characters (TTS)
}

// Keyed by model string.
const RATES: Record<string, Rate> = {
  'google/gemini-3-flash-preview': { inputPerMTokIdr: 8975, outputPerMTokIdr: 53850 },
  'openai/text-embedding-3-small': { inputPerMTokIdr: 359 },
  'flash-v2.5': { per1kCharsIdr: 898 },
};

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
