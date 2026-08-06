-- scripts/migrations/20260805_correct_elevenlabs_rate.sql
--
-- Fixes a real cost-tracking bug: the ElevenLabs "flash-v2.5" rate in
-- lib/usage/rates.ts (used by computeCostIdr() at log time, see that file's
-- header comment for how it was verified) was set to 898 IDR/1,000 chars —
-- reconciling against actual ElevenLabs billing showed this undercounted
-- real spend by ~35% (app showed ~$34 all-time where the real ElevenLabs
-- bill was ~$46). The corrected rate is 1215 IDR/1,000 chars, already
-- updated in code so every NEW event logs the right cost. This migration
-- backfills the HISTORICAL rows that were logged under the old, wrong rate,
-- so "sepanjang waktu" (all-time) totals on /super-admin/usage actually
-- reconcile against what was really spent.
--
-- OpenRouter rates were NOT changed — cross-checked against OpenRouter's own
-- published per-token USD pricing and found accurate to within 0.1% (see
-- lib/usage/rates.ts comment), so no backfill is needed there.
--
-- Run this whole file once in the Supabase SQL Editor.

-- 1. Audit-trail row in ai_usage_rates. NOTE: this table is not read by the
--    app at runtime (lib/usage/rates.ts's hardcoded RATES constant is the
--    only thing computeCostIdr() actually consults) — this insert is purely
--    so anyone reading the DB table directly sees the current correct rate
--    instead of a stale one.
INSERT INTO public.ai_usage_rates (provider, model, input_per_mtok_idr, output_per_mtok_idr, per_1k_chars_idr, effective_from)
VALUES ('elevenlabs', 'flash-v2.5', 0, 0, 1215, NOW())
ON CONFLICT (provider, model, effective_from) DO NOTHING;

-- 2. Rescale every historical ElevenLabs TTS event from the old rate to the
--    corrected one. Multiplying by the ratio (rather than recomputing from
--    char_count fresh) preserves any per-row rounding quirks from whatever
--    rate was actually in effect when each row was logged, while still
--    landing everything on the same corrected basis.
UPDATE public.ai_usage_events
SET cost_idr = ROUND(cost_idr * (1215.0 / 898.0), 4)
WHERE provider = 'elevenlabs' AND purpose = 'tts';

-- 3. usage_counters.cost_idr is a trigger-maintained rollup that only ever
--    increments on INSERT into ai_usage_events (see bump_usage_counters() in
--    scripts/migrations/20260711_saas_billing_usage.sql) — step 2's UPDATE
--    doesn't cascade to it. Recompute it from scratch per org/month instead
--    of patching a delta, so this also self-heals any other historical
--    drift between the two tables, not just this specific bug.
UPDATE public.usage_counters uc
SET cost_idr = sub.total_cost
FROM (
  SELECT organization_id, date_trunc('month', created_at)::date AS period_start,
         COALESCE(SUM(cost_idr), 0) AS total_cost
  FROM public.ai_usage_events
  GROUP BY organization_id, date_trunc('month', created_at)::date
) sub
WHERE uc.organization_id = sub.organization_id
  AND uc.period_start = sub.period_start;

NOTIFY pgrst, 'reload schema';
