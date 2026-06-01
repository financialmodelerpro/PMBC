-- 019_seed_services_page_content.sql
-- Phase 9 — Services overview intro. The /services route renders CMS
-- page_sections ABOVE a static, config-driven "Practice Areas" 9-card grid that
-- carries its own heading, so the only CMS section is a hero header. Replaces all
-- page_sections rows for page_slug='services'.
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
--
-- Mirrors scripts/seed-services-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'services';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('services', 'hero', '{
  "badge_text": "WHAT WE DO",
  "headline": "Corporate finance, end to end.",
  "subtitle": "From the first model to the final close: valuation, due diligence, M&A, project finance, and the documentation that gets a deal done. Each engagement is led directly by the partner.",
  "cta_label": "Start a Conversation",
  "cta_href": "/contact",
  "cta_secondary_label": "Our Approach",
  "cta_secondary_href": "/approach",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'services';

COMMIT;
