-- 075_tools_links.sql
-- Links into the free tools: one in the footer, one on the Business Valuation
-- service page.
--
-- APPLY ONLY AFTER THE TOOLS ROUTES ARE LIVE ON PRODUCTION.
-- Preview deployments share the production database, so running this while
-- /tools exists only on a preview branch would put a footer link on the live
-- site that opens a 404. 074 has no such constraint.
--
-- 1. FOOTER
-- "Free Tools" -> /tools, in the Firm column, placed after Financial Modeler Pro.
-- The whole list lives in one cms_content row as JSON text (migration 054), so
-- this appends to it rather than replacing it, and only when no link with the
-- id `tools` is already there. An operator's edits and ordering are kept. The
-- same link is in DEFAULT_FOOTER_LINKS for a database without the row.
--
-- 2. SERVICE PAGE
-- A `cta_block` on service-business-valuation at order 20, directly after the
-- service detail and before the page's closing enquiry CTA, which is route code.
-- Navy, the block's default, so it separates the white detail section from the
-- white enquiry band below it. Inserted only when the page has no cta_block.
--
-- A nav item is deliberately not added. It waits for the second tool.
--
-- DML only: `npm run seed-tools-links` applies it. Idempotent.

BEGIN;

UPDATE cms_content
SET value = (
      SELECT jsonb_agg(elem ORDER BY ord)::text
      FROM (
        SELECT elem, ord::numeric AS ord
        FROM jsonb_array_elements(value::jsonb) WITH ORDINALITY AS t(elem, ord)
        UNION ALL
        SELECT
          jsonb_build_object('id', 'tools', 'label', 'Free Tools', 'href', '/tools', 'column', 'firm', 'visible', true),
          COALESCE(
            (SELECT ord + 0.5 FROM jsonb_array_elements(value::jsonb) WITH ORDINALITY AS f(e, ord) WHERE e->>'id' = 'fmp'),
            jsonb_array_length(value::jsonb) + 1
          )
      ) AS merged
    ),
    updated_at = NOW()
WHERE section = 'footer_settings'
  AND key = 'links'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(value::jsonb) AS e WHERE e->>'id' = 'tools'
  );

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'service-business-valuation',
  'cta_block',
  jsonb_build_object(
    'eyebrow', 'Free tool',
    'headline', 'Try our free valuation tool',
    'subhead', '<p>An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country. About ten minutes, with a report you can keep.</p>',
    'cta_primary_label', 'Open the valuation tool',
    'cta_primary_href', '/tools/business-valuation',
    'cta_secondary_label', '',
    'cta_secondary_href', ''
  ),
  '{}'::jsonb,
  20,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'service-business-valuation' AND section_type = 'cta_block'
);

COMMIT;
