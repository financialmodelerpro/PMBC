-- 037_sync_founder_photo.sql
-- Copy the founder portrait from the profile page's hero onto the founder cards.
--
-- `founder_hero` (on /about/ahmad-din) and `founder_block` (on / and /about) each
-- store their own `photo_url` in page_sections.content. That is deliberate: a
-- section owns its content, and the same pattern lets a card use a different
-- crop from the profile hero if anyone ever wants one. There is no shared
-- founder-photo source in branding_config, site_settings or team_members, and
-- none was intended.
--
-- The consequence is that uploading a portrait through the page builder sets it
-- on one section only. When the real photograph was added to the profile hero on
-- 2026-08-02, both founder cards kept rendering the "AD" monogram fallback.
-- This copies it across once.
--
-- Deliberately NOT hardcoding the URL. It is read from whichever founder_hero
-- carries one, so:
--   * a rebuild against a different Supabase project picks up that project's
--     own storage URL rather than this one's, which would 404,
--   * and on a fresh database where no portrait has been uploaded yet, the
--     subquery returns no row and the statement is a no-op rather than writing
--     a broken path.
--
-- Only fills cards whose photo_url is empty or absent, so a card deliberately
-- given a different image is never overwritten.
--
-- DML only, so `node scripts/sync-founder-photo.mjs` applies it through
-- supabase-js. Idempotent: a second run finds nothing empty left to fill.

BEGIN;

UPDATE page_sections AS tgt
SET content = jsonb_set(tgt.content, '{photo_url}', to_jsonb(src.url), true),
    updated_at = NOW()
FROM (
  SELECT content->>'photo_url' AS url
  FROM page_sections
  WHERE section_type = 'founder_hero'
    AND COALESCE(content->>'photo_url', '') <> ''
  ORDER BY updated_at DESC
  LIMIT 1
) AS src
WHERE tgt.section_type = 'founder_block'
  AND COALESCE(tgt.content->>'photo_url', '') = '';

COMMIT;
