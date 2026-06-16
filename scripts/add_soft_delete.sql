-- Migration: soft-delete support for students and profiles
-- Run once in Supabase SQL editor.
--
-- Instead of permanently deleting santri or ustadz records (which would
-- cascade-delete their reports and assessment history), admins now "remove"
-- them: the record is hidden from active lists but preserved in the DB.
-- Removed records are viewable in the admin panel with their reason and date.

-- Students (santri)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_removed    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS removed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT;

-- Profiles (ustadz / admin accounts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_removed    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS removed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_reason TEXT;
