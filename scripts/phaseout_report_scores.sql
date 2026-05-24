-- Phase out legacy score table now that the app relies on treatment_plan JSON.
-- Run manually in Supabase SQL editor.

BEGIN;

-- 1) Keep a backup snapshot before removal
CREATE TABLE IF NOT EXISTS public.report_scores_archive AS
SELECT *
FROM public.report_scores
WHERE false;

INSERT INTO public.report_scores_archive
SELECT *
FROM public.report_scores;

-- 2) Drop legacy table (use CASCADE if there are dependent objects)
DROP TABLE IF EXISTS public.report_scores;

COMMIT;
