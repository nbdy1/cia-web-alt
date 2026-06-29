-- scripts/migrations/add-model-used.sql

-- Add the model_used column to the reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Backfill existing records with the baseline legacy model string
UPDATE reports
SET model_used = 'google/gemini-3-flash-preview'
WHERE model_used IS NULL;
