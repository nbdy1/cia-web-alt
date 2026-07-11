-- Migration: organization branding (logo + primary color)
-- Run this once in your Supabase SQL editor.
--
-- Prerequisites:
--   Go to Supabase → Storage → New bucket
--   Name: org-logos   Public: YES   (toggle on)

BEGIN;

-- 1. Add the primary_color column. Defaults to emerald-500 so existing orgs
--    keep the current look until an admin picks a different color.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#10b981';

COMMENT ON COLUMN public.organizations.primary_color IS
  'Hex color (e.g. #10b981) used as the base of the app-wide --brand-* color scale for this organization.';

COMMENT ON COLUMN public.organizations.logo_url IS
  'Public URL of the organization logo stored in the org-logos Supabase Storage bucket.';

-- 2. Storage RLS policies for the org-logos bucket
--    (Supabase Storage uses the storage.objects table)

DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload org logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
CREATE POLICY "Authenticated users can update org logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Public can read org logos" ON storage.objects;
CREATE POLICY "Public can read org logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'org-logos');

COMMIT;
