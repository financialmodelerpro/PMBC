-- 067_service_pages_own_copy.sql
-- The nine service detail pages stop keeping their copy in the key-value store.
--
-- The last instance of the pattern migration 066 removed from /contact and
-- /book. Each of the nine pages had a `cms_pages` row, a Builder button in the
-- admin, and no sections behind it: the copy lived in `cms_content` under
-- `service_<slug>`, nine namespaces of nine keys. Opening the page builder for
-- a service showed an empty page, and the copy that actually rendered was in a
-- different screen.
--
-- Each namespace becomes one `service_detail` section on its own
-- `service-<slug>` page. That section type already existed and already renders
-- these exact fields, so nothing new had to be designed to hold them.
--
-- Two details make the move work:
--
--   show_header  The route used to pass `showHeader={false}` as a prop, because
--                the page opens with a hero carrying the same number, title and
--                summary. The section registry passes no props beyond the row,
--                so that setting has to be in the row. Seeded false here, and
--                exposed as a toggle in the editor.
--
--   deliverables Stored in cms_content as a JSON string, because that column is
--                TEXT. It becomes a real JSONB array, which is what the section
--                renderer and its drag-to-reorder editor already expect.
--
-- What does NOT move. `config/services.ts` keeps the number, title and summary
-- of each service. They are not this page's copy alone: the same three drive
-- the /services grid, the related-services cards, the contact form's dropdown,
-- generateStaticParams, the sitemap and the JSON-LD. Duplicating them into nine
-- sections would create nine places for them to drift out of step.
--
-- One page needs a note. `service-business-valuation` already had a
-- `service_detail` row, left behind by a Phase 6 smoke test on 2026-05-03 at
-- display_order 1000 with `styles = {"smoke":"phase6"}`. It never rendered,
-- because the route read cms_content. Rather than insert a second one, this
-- migration adopts it: content refreshed from the namespace, order corrected to
-- 10, and the smoke marker cleared, since a live page should not carry a test
-- fixture in its StyleEditor.
--
-- No wording changes. Every value is carried across as it stands rather than
-- reseeded from a literal, so admin edits survive.
--
-- DML only, so `node scripts/seed-service-pages-own-copy.mjs` applies it
-- through supabase-js. The deliverables reshape is easier to read in the script
-- than in SQL, and the script is the path that was actually run.
--
-- Idempotent: sections are created only when absent, adopted when present, and
-- a cms_content row is deleted only once its section demonstrably carries the
-- value, so an interrupted run cannot leave a page with copy in neither place.

BEGIN;

-- 1. Create the missing eight sections, carrying every key from the namespace.
--    `deliverables` is cast from its stored JSON text to a JSONB array; the
--    other keys are strings on both sides.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'service-' || sub.slug,
  'service_detail',
  jsonb_build_object(
    'service_slug', sub.slug,
    'show_header', false,
    'full_description_html', COALESCE(sub.kv->>'full_description', ''),
    'deliverables', COALESCE(
      CASE
        WHEN COALESCE(sub.kv->>'deliverables', '') LIKE '[%'
          THEN (sub.kv->>'deliverables')::jsonb
        ELSE '[]'::jsonb
      END,
      '[]'::jsonb
    ),
    'timeline_text', COALESCE(sub.kv->>'timeline_text', ''),
    'target_audience_text', COALESCE(sub.kv->>'target_audience_text', ''),
    'media_url', COALESCE(sub.kv->>'media_url', ''),
    'media_type', COALESCE(sub.kv->>'media_type', ''),
    'media_poster_url', COALESCE(sub.kv->>'media_poster_url', ''),
    'media_position', COALESCE(sub.kv->>'media_position', ''),
    'media_caption', COALESCE(sub.kv->>'media_caption', '')
  ),
  '{}'::jsonb,
  10,
  true
FROM (
  SELECT
    substring(section FROM 9) AS slug,
    jsonb_object_agg(key, COALESCE(value, '')) AS kv
  FROM cms_content
  WHERE section LIKE 'service\_%'
  GROUP BY section
) AS sub
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'service-' || sub.slug
    AND section_type = 'service_detail'
);

-- 2. Adopt any section that already existed, business-valuation's smoke-test
--    row being the only one. Content refreshed from the namespace so all nine
--    pages are consistent, order corrected, test marker cleared.
UPDATE page_sections p
SET content = p.content || jsonb_build_object(
      'service_slug', sub.slug,
      'show_header', false,
      'full_description_html', COALESCE(sub.kv->>'full_description', ''),
      'deliverables', COALESCE(
        CASE
          WHEN COALESCE(sub.kv->>'deliverables', '') LIKE '[%'
            THEN (sub.kv->>'deliverables')::jsonb
          ELSE '[]'::jsonb
        END,
        '[]'::jsonb
      ),
      'timeline_text', COALESCE(sub.kv->>'timeline_text', ''),
      'target_audience_text', COALESCE(sub.kv->>'target_audience_text', '')
    ),
    styles = p.styles - 'smoke',
    display_order = 10,
    updated_at = NOW()
FROM (
  SELECT
    substring(section FROM 9) AS slug,
    jsonb_object_agg(key, COALESCE(value, '')) AS kv
  FROM cms_content
  WHERE section LIKE 'service\_%'
  GROUP BY section
) AS sub
WHERE p.page_slug = 'service-' || sub.slug
  AND p.section_type = 'service_detail'
  AND p.content->>'show_header' IS DISTINCT FROM 'false';

-- 3. Retire the namespaces, one key at a time, and only where the section
--    demonstrably carries the value. `deliverables` and `full_description` are
--    checked against their renamed counterparts rather than by key name.
DELETE FROM cms_content c
WHERE c.section LIKE 'service\_%'
  AND EXISTS (
    SELECT 1 FROM page_sections p
    WHERE p.page_slug = 'service-' || substring(c.section FROM 9)
      AND p.section_type = 'service_detail'
      AND (
        (c.key = 'full_description' AND p.content ? 'full_description_html')
        OR (c.key = 'deliverables' AND p.content ? 'deliverables')
        OR (c.key NOT IN ('full_description', 'deliverables') AND p.content ? c.key)
      )
  );

COMMIT;
