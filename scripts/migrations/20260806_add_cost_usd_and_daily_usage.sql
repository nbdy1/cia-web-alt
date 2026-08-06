-- scripts/migrations/20260806_add_cost_usd_and_daily_usage.sql
--
-- Two things:
--
-- 1. Adds a `cost_usd` column to ai_usage_events/usage_counters, populated
--    going forward with OpenRouter's own real per-call USD cost when the app
--    has it (see resolveCost() in lib/usage/usage-tracker.ts) instead of
--    deriving USD from cost_idr at display time via a fixed exchange rate —
--    that reverse-conversion is what caused the OpenRouter/ElevenLabs
--    reconciliation drift fixed in 20260805_correct_elevenlabs_rate.sql.
--    Backfills existing rows so historical totals aren't NULL.
--
-- 2. Adds a usage_daily() RPC — per-day, per-provider cost — so
--    /super-admin/usage can chart the app's own tracked spend day by day
--    (for spotting anomalies / comparing against provider dashboards), same
--    server-side-aggregation approach as usage_breakdown() in
--    20260731_usage_breakdown_rpc.sql (no client-side row-cap risk).
--
-- Run this whole file once in the Supabase SQL Editor.

-- 1a. Schema
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0;
ALTER TABLE public.usage_counters  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(16,8) NOT NULL DEFAULT 0;

-- 1b. Backfill: derive cost_usd from cost_idr for rows logged before this
-- column existed, using the same Rp17,927/US$ approximation the dashboard
-- already used for display (lib/usage/rates.ts's IDR_PER_USD). This is only
-- as accurate as that approximation — it's a backfill, not a correction —
-- but it's better than leaving history at zero.
UPDATE public.ai_usage_events
SET cost_usd = ROUND(cost_idr / 17927.0, 8)
WHERE cost_usd = 0 AND cost_idr <> 0;

-- 1c. Trigger: sum cost_usd alongside cost_idr.
CREATE OR REPLACE FUNCTION public.bump_usage_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usage_counters AS uc
    (organization_id, period_start, reports_used, interview_turns, input_tokens, output_tokens, voice_chars, cost_idr, cost_usd)
  VALUES (
    NEW.organization_id,
    date_trunc('month', NEW.created_at)::date,
    CASE WHEN NEW.purpose = 'finalize'       THEN 1 ELSE 0 END,
    CASE WHEN NEW.purpose = 'interview_step' THEN 1 ELSE 0 END,
    COALESCE(NEW.input_tokens, 0),
    COALESCE(NEW.output_tokens, 0),
    COALESCE(NEW.char_count, 0),
    COALESCE(NEW.cost_idr, 0),
    COALESCE(NEW.cost_usd, 0)
  )
  ON CONFLICT (organization_id, period_start) DO UPDATE SET
    reports_used    = uc.reports_used    + EXCLUDED.reports_used,
    interview_turns = uc.interview_turns + EXCLUDED.interview_turns,
    input_tokens    = uc.input_tokens    + EXCLUDED.input_tokens,
    output_tokens   = uc.output_tokens   + EXCLUDED.output_tokens,
    voice_chars     = uc.voice_chars     + EXCLUDED.voice_chars,
    cost_idr        = uc.cost_idr        + EXCLUDED.cost_idr,
    cost_usd        = uc.cost_usd        + EXCLUDED.cost_usd,
    updated_at      = NOW();
  RETURN NEW;
END;
$$;

-- 1d. usage_counters.cost_usd was just backfilled column-by-column above via
-- the trigger's incremental model, which doesn't retroactively apply to rows
-- already summed before this migration — recompute from scratch so existing
-- monthly rollups pick up the backfilled cost_usd too.
UPDATE public.usage_counters uc
SET cost_usd = sub.total_cost_usd
FROM (
  SELECT organization_id, date_trunc('month', created_at)::date AS period_start,
         COALESCE(SUM(cost_usd), 0) AS total_cost_usd
  FROM public.ai_usage_events
  GROUP BY organization_id, date_trunc('month', created_at)::date
) sub
WHERE uc.organization_id = sub.organization_id
  AND uc.period_start = sub.period_start;

-- 1e. usage_breakdown(): also return cost_usd (same grouping as before).
-- Postgres won't let CREATE OR REPLACE change a function's return row type
-- (adding the cost_usd column counts as a change) — drop it first.
DROP FUNCTION IF EXISTS public.usage_breakdown(timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.usage_breakdown(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ,
  p_org  UUID DEFAULT NULL
)
RETURNS TABLE (
  purpose       TEXT,
  provider      TEXT,
  cost_idr      NUMERIC,
  cost_usd      NUMERIC,
  input_tokens  BIGINT,
  output_tokens BIGINT,
  char_count    BIGINT,
  event_count   BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    e.purpose,
    e.provider,
    COALESCE(SUM(e.cost_idr), 0)      AS cost_idr,
    COALESCE(SUM(e.cost_usd), 0)      AS cost_usd,
    COALESCE(SUM(e.input_tokens), 0)  AS input_tokens,
    COALESCE(SUM(e.output_tokens), 0) AS output_tokens,
    COALESCE(SUM(e.char_count), 0)    AS char_count,
    COUNT(*)                          AS event_count
  FROM public.ai_usage_events e
  WHERE e.created_at >= p_from
    AND e.created_at <  p_to
    AND (p_org IS NULL OR e.organization_id = p_org)
  GROUP BY e.purpose, e.provider
  ORDER BY cost_idr DESC;
$$;

GRANT EXECUTE ON FUNCTION public.usage_breakdown(timestamptz, timestamptz, uuid) TO authenticated;

-- 2. usage_daily(): per-day, per-provider cost — powers the new daily bar
-- chart on /super-admin/usage. SECURITY INVOKER (default), same RLS-backed
-- scoping as usage_breakdown(). Also dropped first — harmless if it doesn't
-- exist yet, but makes this migration safe to re-run after a partial failure.
DROP FUNCTION IF EXISTS public.usage_daily(timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.usage_daily(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ,
  p_org  UUID DEFAULT NULL
)
RETURNS TABLE (
  day       DATE,
  provider  TEXT,
  cost_idr  NUMERIC,
  cost_usd  NUMERIC,
  event_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    date_trunc('day', e.created_at)::date AS day,
    e.provider,
    COALESCE(SUM(e.cost_idr), 0) AS cost_idr,
    COALESCE(SUM(e.cost_usd), 0) AS cost_usd,
    COUNT(*) AS event_count
  FROM public.ai_usage_events e
  WHERE e.created_at >= p_from
    AND e.created_at <  p_to
    AND (p_org IS NULL OR e.organization_id = p_org)
  GROUP BY date_trunc('day', e.created_at)::date, e.provider
  ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.usage_daily(timestamptz, timestamptz, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
