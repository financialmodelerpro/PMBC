-- 027_site_pages_nav.sql
-- Navigation menu items (admin: /admin/pages, "Pages & Nav").
--
-- Mirrors FMP's `site_pages` table, which is the source of truth for the public
-- navbar. Before this migration PMBC drove the navbar from a single
-- cms_content row, (header_settings, nav_items), holding a JSON array. That row
-- was edited from /admin/header-settings.
--
-- This migration promotes the nav to first-class rows so each item can be
-- reordered, hidden, and audited individually, matching the other managed
-- collections (021-025). The seed below is taken verbatim from the current
-- (header_settings, nav_items) value when present, so the rendered navbar is
-- unchanged; if that row is missing or malformed it falls back to the same six
-- items hardcoded in DEFAULT_HEADER_CONFIG (src/lib/cms/headerSettings.ts).
--
-- The legacy cms_content row is intentionally LEFT IN PLACE, not dropped:
-- fetchHeaderConfig() still reads it as a fallback if site_pages is empty or
-- unreachable, so a partially-applied migration can never produce a navbar with
-- no links. /admin/header-settings no longer edits nav items.
--
-- Idempotent: safe to re-run. The seed only inserts when the table is empty.

BEGIN;

CREATE TABLE IF NOT EXISTS site_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_pages_order
  ON site_pages(visible, display_order);

ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;

-- Seed from the existing cms_content nav_items JSON array, preserving order.
INSERT INTO site_pages (label, href, display_order, visible)
SELECT
  item->>'label',
  item->>'href',
  (ord - 1)::int,
  true
FROM cms_content c
CROSS JOIN LATERAL jsonb_array_elements(c.value::jsonb) WITH ORDINALITY AS t(item, ord)
WHERE c.section = 'header_settings'
  AND c.key = 'nav_items'
  AND c.value IS NOT NULL
  AND jsonb_typeof(c.value::jsonb) = 'array'
  AND COALESCE(item->>'label', '') <> ''
  AND COALESCE(item->>'href', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM site_pages);

-- Fallback seed: only if the JSON row was absent or produced nothing.
INSERT INTO site_pages (label, href, display_order, visible)
SELECT v.label, v.href, v.ord, true
FROM (VALUES
  ('Services', '/services', 0),
  ('Sectors', '/sectors', 1),
  ('Approach', '/approach', 2),
  ('Network', '/network', 3),
  ('About', '/about', 4),
  ('Contact', '/contact', 5)
) AS v(label, href, ord)
WHERE NOT EXISTS (SELECT 1 FROM site_pages);

COMMIT;
