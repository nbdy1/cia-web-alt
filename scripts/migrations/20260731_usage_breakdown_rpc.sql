-- scripts/migrations/20260731_usage_breakdown_rpc.sql
--
-- Fixes a data-accuracy bug on /super-admin/usage: the "Biaya per fungsi"
-- panel re-summed `ai_usage_events` client-side after a `.limit(10000)` fetch
-- (further silently capped by PostgREST's project "Max Rows" setting, default
-- 1000, with no ORDER BY — so the sum was a partial, non-deterministic subset
-- of the month's events). Meanwhile the 6-month trend chart read from
-- `usage_counters`, an unbounded trigger-maintained rollup of the SAME table
-- — so the two panels showed different totals for the same period even
-- though they're both ultimately derived from `ai_usage_events`.
--
-- This adds a GROUP BY aggregation RPC so the sum happens in Postgres (no row
-- cap, no client-side truncation) — used for both the purpose/provider
-- breakdown and the token/character totals panels. SECURITY INVOKER (the
-- default) so it runs as the calling platform admin and is naturally
-- constrained by the existing RLS policy on ai_usage_events
-- ("read org or all usage" — platform admins see all rows, org admins only
-- their own org), same as every other query on this page.
--
-- Run this whole file once in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.usage_breakdown(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ,
  p_org  UUID DEFAULT NULL
)
RETURNS TABLE (
  purpose       TEXT,
  provider      TEXT,
  cost_idr      NUMERIC,
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

NOTIFY pgrst, 'reload schema';
