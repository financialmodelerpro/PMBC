-- 026_storage_buckets.sql
-- Public-read storage buckets for the Media Library and collection images.
-- Uploads/deletes happen server-side through /api/admin/media using the service
-- role (which bypasses storage RLS), so only public read access is configured
-- here. Idempotent.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cms-assets', 'cms-assets', true),
  ('article-covers', 'article-covers', true),
  ('case-study-images', 'case-study-images', true),
  ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Allow anonymous/public read of objects in these buckets.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'PMBC public read cms buckets'
  ) THEN
    CREATE POLICY "PMBC public read cms buckets"
      ON storage.objects FOR SELECT
      USING (bucket_id IN ('cms-assets', 'article-covers', 'case-study-images', 'team-photos'));
  END IF;
END $$;

COMMIT;
