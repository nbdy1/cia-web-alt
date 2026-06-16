-- Migration: student_scores table for manual ustadz score input
-- Run once in Supabase SQL editor.
--
-- Stores per-period subject scores entered manually by ustadz.
-- These are separate from AI-generated CIA assessments (reports table).
--
-- Subject groups: QCB (Quran/Bahasa), QMB, QSB — or whatever your school uses.
-- Score types (rows in the rapor table):
--   Hafalan        → Nilai Harian
--   Muhadharah     → Nilai Harian
--   Fast Respon (FR)               → Nilai Bulanan
--   Analitic Retrieval (AR)        → Nilai Bulanan
--   3 Pasang Fungsi Bahasa (3PFB)  → Nilai Akhir

CREATE TABLE IF NOT EXISTS public.student_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period        TEXT NOT NULL,          -- e.g. "Semester 1 2024/2025"
  subject       TEXT NOT NULL,          -- 'QCB' | 'QMB' | 'QSB'
  score_type    TEXT NOT NULL,          -- 'Hafalan' | 'Muhadharah' | 'FR' | 'AR' | '3PFB'
  nilai_harian  NUMERIC(5,2),           -- daily score (Hafalan, Muhadharah)
  nilai_bulanan NUMERIC(5,2),           -- monthly score (FR, AR)
  nilai_akhir   NUMERIC(5,2),           -- final score (3PFB)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, period, subject, score_type)  -- one row per cell
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_scores_updated_at ON public.student_scores;
CREATE TRIGGER student_scores_updated_at
  BEFORE UPDATE ON public.student_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Confirm profile_summary lives on students (not reports)
-- This column was added by add_profile_summary.sql — re-run safely with IF NOT EXISTS
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS profile_summary TEXT;
