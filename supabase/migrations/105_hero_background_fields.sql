-- 105_hero_background_fields.sql
--
-- Hero background image (2026-10-11, on the owner's instruction). Every hero
-- section (`hero` and `founder_hero`) gains three content keys, edited in the
-- page builder:
--
--   hero_bg_image    ''        image URL from the Media Library; empty = none
--   hero_bg_overlay  60        navy overlay opacity, 35 to 100
--   hero_bg_focal    'center'  'center' | 'top' | 'bottom'
--
-- This backfills the three keys with those defaults on every existing hero, so
-- the page builder shows them explicitly. No image is set on any hero: with
-- hero_bg_image empty the renderer draws nothing, and every page looks exactly
-- as it does today. The code treats an absent key the same as its default, so
-- this migration is tidiness, not a dependency.
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner.
--
-- SAFE TO APPLY: before or after the deploy that renders the image. Before it
-- the keys are stored and ignored; after it, an empty image renders nothing.
--
-- SAFE ON RE-RUN: existing values win (`defaults || content`), so a key an
-- operator has already set, including a chosen image, is never overwritten.
-- Nothing is deleted.
--
-- Check after applying (expect 15 rows today, every one with an empty image):
--   SELECT page_slug, section_type, content->>'hero_bg_image' AS image,
--          content->'hero_bg_overlay' AS overlay, content->>'hero_bg_focal' AS focal
--   FROM page_sections WHERE section_type IN ('hero', 'founder_hero')
--   ORDER BY page_slug;

BEGIN;

UPDATE page_sections
SET content = jsonb_build_object(
      'hero_bg_image', '',
      'hero_bg_overlay', 60,
      'hero_bg_focal', 'center'
    ) || content
WHERE section_type IN ('hero', 'founder_hero')
  AND NOT (content ? 'hero_bg_image' AND content ? 'hero_bg_overlay' AND content ? 'hero_bg_focal');

COMMIT;
