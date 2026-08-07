-- scripts/migrations/20260807_usage_daily_char_count.sql
--
-- Adds char_count to usage_daily() so /super-admin/usage can compare our
-- own tracked ElevenLabs character counts against ElevenLabs' own daily
-- numbers from /v1/usage/character-stats — a rate-independent check (raw
-- characters, not derived cost) that also doesn't need the `user_read`
-- permission that /v1/user/subscription requires (see
-- app/actions/usage-live-check.ts).
--
-- Run this whole file once in the Supabase SQL Editor.

-- CREATE OR REPLACE can't change a function's return row type — drop first.
DROP FUNCTION IF EXISTS public.usage_daily(timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.usage_daily(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ,
  p_org  UUID DEFAULT NULL
)
RETURNS TABLE (
  day         DATE,
  provider    TEXT,
  cost_idr    NUMERIC,
  cost_usd    NUMERIC,
  char_count  BIGINT,
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
    COALESCE(SUM(e.char_count), 0) AS char_count,
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
