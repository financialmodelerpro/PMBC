-- 066_page_owned_copy.sql
-- /contact and /book stop keeping their copy in the key-value store.
--
-- Both pages carried one CMS section, a hero, and twenty-one rows in
-- cms_content: thirteen under `contact` and eight under `booking`. Editing
-- either page meant working in two places, and /admin/content grew a group per
-- page that had nothing to do with the global keys it exists for.
--
-- The copy becomes section content. Two new section types carry it:
--
--   contact_body   the enquiry form panel and the direct-contact column
--   booking_body   the calendar band and the direct routes under it
--
-- One section per page body rather than one per visual block, because each
-- body is a single grid. Split into a section per column they would render as
-- stacked bands, which would be a layout rewrite rather than the move this is.
--
-- What deliberately does NOT move. Site Settings keeps the three published
-- addresses, the WhatsApp number, the office line and the Calendly URL. Those
-- are the firm's, not either page's: the footer publishes the same addresses,
-- and one booking URL serves every surface that offers a meeting. They are
-- settings, not copy, and this migration is about page copy.
--
-- After this, /admin/content holds only global keys: header, footer, contact
-- details, SEO defaults, and the nine service namespaces.
--
-- No wording changes. Each key is carried across at the value it holds now
-- rather than reseeded from a literal, so an edit made in the admin survives
-- the move. `form_response_note` is carried as the empty string migration 065
-- set it to, and the renderer keeps treating empty as hidden and absent as the
-- shipped sentence.
--
-- DML only, so `node scripts/seed-page-owned-copy.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent: the inserts are guarded on the section not already existing, and
-- the deletes on it existing and carrying the key being removed, so an
-- interrupted run cannot leave a page with its copy in neither place.

BEGIN;

-- 1. The contact body, built from the rows it replaces.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'contact',
  'contact_body',
  (
    SELECT jsonb_object_agg(key, to_jsonb(COALESCE(value, '')))
    FROM cms_content
    WHERE section = 'contact'
  ),
  '{}'::jsonb,
  20,
  true
WHERE EXISTS (SELECT 1 FROM cms_content WHERE section = 'contact')
  AND NOT EXISTS (
    SELECT 1 FROM page_sections
    WHERE page_slug = 'contact' AND section_type = 'contact_body'
  );

-- 2. The booking body, the same way.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'book',
  'booking_body',
  (
    SELECT jsonb_object_agg(key, to_jsonb(COALESCE(value, '')))
    FROM cms_content
    WHERE section = 'booking'
  ),
  '{}'::jsonb,
  20,
  true
WHERE EXISTS (SELECT 1 FROM cms_content WHERE section = 'booking')
  AND NOT EXISTS (
    SELECT 1 FROM page_sections
    WHERE page_slug = 'book' AND section_type = 'booking_body'
  );

-- 3. Retire the originals, one key at a time, and only where the new section
--    demonstrably carries that key. A row left behind would sit in
--    /admin/content inviting an edit the page no longer reads, and a row
--    deleted without its replacement would lose the wording outright.
DELETE FROM cms_content c
WHERE c.section = 'contact'
  AND EXISTS (
    SELECT 1 FROM page_sections p
    WHERE p.page_slug = 'contact'
      AND p.section_type = 'contact_body'
      AND p.content ? c.key
  );

DELETE FROM cms_content c
WHERE c.section = 'booking'
  AND EXISTS (
    SELECT 1 FROM page_sections p
    WHERE p.page_slug = 'book'
      AND p.section_type = 'booking_body'
      AND p.content ? c.key
  );

COMMIT;
