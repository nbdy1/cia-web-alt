-- Add report title for better report discoverability in history views.
ALTER TABLE public.reports
ADD COLUMN IF NOT EXISTS title text;

-- Optional backfill for legacy rows
UPDATE public.reports
SET title = 'Laporan Perkembangan'
WHERE title IS NULL;
