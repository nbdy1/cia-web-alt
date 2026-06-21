-- Migration: rename `batch` column to `nis` (Nomor Induk Santri)
-- Run this in Supabase SQL Editor once before deploying the updated code.
--
-- This preserves all existing data — existing `batch` values will appear
-- in the new `nis` column. If you want to clear them out instead, add:
--   UPDATE students SET nis = NULL;
-- after the rename.

ALTER TABLE students RENAME COLUMN batch TO nis;
