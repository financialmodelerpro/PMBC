-- 074_tools_pages.sql
-- /tools and /tools/business-valuation get CMS pages, so their heroes and
-- metadata are edited in the page builder like every other page's.
--
-- WHAT THIS IS FOR
-- The free tools section (see CLAUDE.md "Free tools") renders a hub at /tools
-- and one page per tool at /tools/<slug>. The list of tools and each calculator
-- are code, driven by `src/config/tools.ts`: a calculator's copy is tied to its
-- logic, and the hub cards follow the registry so a new tool appears by entry
-- alone. The opening copy on both pages is ordinary page copy, so it belongs in
-- the page builder.
--
-- WHAT THIS SEEDS
--   cms_pages  `tools`                    served at /tools
--   cms_pages  `tool-business-valuation`  served at /tools/business-valuation
--   one `hero` section on each, at order 10, carrying the copy the routes ship
--   as their fallback, so applying this changes nothing a visitor sees.
--
-- Tool pages use a `tool-` prefix for the same reason service pages use
-- `service-`: the slug is not the URL. `publicPathForPageSlug` in
-- src/lib/cms/pageRoutes.ts maps one to the other.
--
-- SAFE TO APPLY BEFORE THE ROUTES SHIP
-- Nothing links to these rows. The only visible effect before the deploy is two
-- entries in the admin page list whose preview would 404 on the old build.
--
-- DML only: `npm run seed-tools-pages` applies it through supabase-js.
-- Idempotent: rows are inserted only when absent, and a hero only when the page
-- has no sections, so a re-run never overwrites an edit made in the admin.

BEGIN;

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
VALUES
  (
    'tools',
    'Free Tools',
    'Free Tools | PaceMakers Business Consultants',
    'Free corporate finance tools from PaceMakers. Indicative business valuation and investor readiness, built on the methods we use on mandates.',
    'published',
    true
  ),
  (
    'tool-business-valuation',
    'Business Valuation Tool',
    'Business Valuation Tool: DCF and Comparables | PaceMakers Business Consultants',
    'An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country.',
    'published',
    true
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  v.slug,
  'hero',
  jsonb_build_object(
    'badge_text', v.eyebrow,
    'headline',   v.headline,
    'subtitle',   '<p>' || v.tagline || '</p>',
    'tags',       '[]'::jsonb,
    'cta_label',  '',
    'cta_href',   '',
    'cta_secondary_label', '',
    'cta_secondary_href',  ''
  ),
  '{}'::jsonb,
  10,
  true
FROM (VALUES
  (
    'tools',
    'Free tools',
    'Tools for owners and investors',
    'Practical calculators built on the same methods we use on mandates. Indicative results in minutes, with a report you can keep.'
  ),
  (
    'tool-business-valuation',
    'Free tool',
    'Value your business with a DCF and comparables',
    'Enter three years of history and a five year forecast. The tool builds free cash flow, a cost of capital from Damodaran market data, and a comparables check, then shows where your value lands.'
  )
) AS v(slug, eyebrow, headline, tagline)
WHERE NOT EXISTS (SELECT 1 FROM page_sections WHERE page_slug = v.slug);

COMMIT;
