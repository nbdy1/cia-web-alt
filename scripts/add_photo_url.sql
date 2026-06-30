-- Migration: add photo_url column to students table + storage policies
-- Run this once in your Supabase SQL editor.
--
-- Prerequisites:
--   Go to Supabase → Storage → New bucket
--   Name: student-photos   Public: YES   (toggle on)

-- 1. Add the column
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN students.photo_url IS
  'Public URL of the student photo stored in the student-photos Supabase Storage bucket.';

-- 2. Storage RLS policies for the student-photos bucket
--    (Supabase Storage uses the storage.objects table)

-- Allow authenticated users to upload / replace photos
CREATE POLICY "Authenticated users can upload student photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- Allow authenticated users to update (overwrite) existing photos
CREATE POLICY "Authenticated users can update student photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-photos');

-- Allow everyone to read photos (needed for public <img> display)
CREATE POLICY "Public can read student photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'student-photos');
