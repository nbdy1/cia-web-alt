-- Migration: add profile_summary to students
-- Run once in Supabase SQL editor.
--
-- This column stores an AI-generated 150–200 word character profile for each
-- student, synthesised from their report history. It is regenerated after every
-- new report is saved (see app/actions/save-assessment.ts → generateStudentProfile).
-- The profile is injected into both the interview prompt and the final analysis
-- prompt on the next assessment so the AI is informed by the student's history.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_summary TEXT;
