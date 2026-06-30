-- Migration: add photo_url column to students table
-- Run this once in your Supabase SQL editor or via the CLI.
--
-- After running this script you also need to:
--   1. Go to Supabase → Storage → Create a new bucket named  student-photos
--   2. Set the bucket to Public (so the app can display images without auth)
--   3. Optionally add an RLS policy so only authenticated users can upload:
--
--        CREATE POLICY "Authenticated users can upload"
--          ON storage.objects FOR INSERT
--          TO authenticated
--          WITH CHECK (bucket_id = 'student-photos');

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN students.photo_url IS
  'Public URL of the student photo stored in the student-photos Supabase Storage bucket.';
