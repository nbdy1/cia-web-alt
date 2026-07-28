-- Keep student photos publicly viewable through the public bucket/CDN without
-- allowing authenticated clients to list every object in the bucket.
-- Run this after confirming the student-photos bucket is set to Public.

DROP POLICY IF EXISTS "Public can read student photos" ON storage.objects;
