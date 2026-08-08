-- scripts/migrations/20260808_usage_daily_by_org_rpc.sql
--
-- Adds usage_daily_by_org() — same shape as usage_daily() (see
-- 20260807_usage_daily_char_count.sql) but grouped by organization_id too,
-- so /super-admin/usage can show which org is driving each day's OpenRouter/
-- ElevenLabs spend instead of only a platform-wide total. usage_daily()
-- itself is left untouched (still platform-wide, p_org-filterable) since the
-- existing "Perbandingan Harian" chart depends on that exact shape.
--
-- Run this whole file once in the Supabase SQL Editor.

DROP FUNCTION IF EXISTS public.usage_daily_by_org(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.usage_daily_by_org(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS TABLE (
  day             DATE,
  organization_id UUID,
  provider        TEXT,
  cost_idr        NUMERIC,
  cost_usd        NUMERIC,
  char_count      BIGINT,
  event_count     BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    date_trunc('day', e.created_at)::date AS day,
    e.organization_id,
    e.provider,
    COALESCE(SUM(e.cost_idr), 0) AS cost_idr,
    COALESCE(SUM(e.cost_usd), 0) AS cost_usd,
    COALESCE(SUM(e.char_count), 0) AS char_count,
    COUNT(*) AS event_count
  FROM public.ai_usage_events e
  WHERE e.created_at >= p_from
    AND e.created_at <  p_to
  GROUP BY date_trunc('day', e.created_at)::date, e.organization_id, e.provider
  ORDER BY day ASC;
$$;

GRANT EXECUTE ON FUNCTION public.usage_daily_by_org(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
