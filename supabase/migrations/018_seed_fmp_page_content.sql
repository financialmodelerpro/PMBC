-- 018_seed_fmp_page_content.sql
-- Phase 9 — Financial Modeler Pro page real content. Replaces all existing
-- page_sections rows for page_slug='financial-modeler-pro' (the Phase 6 smoke
-- fmp_intro) with the production 4-section flow:
--   10  hero
--   20  fmp_intro      (The platform)
--   30  text_image     (The relationship between PMBC and FMP)
--   40  cta_block      (Visit Financial Modeler Pro)
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
-- Per the cross-property rule (CLAUDE.md §13), the primary CTAs link to
-- https://www.financialmodelerpro.com.
--
-- Mirrors scripts/seed-fmp-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'financial-modeler-pro';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('financial-modeler-pro', 'hero', '{
  "badge_text": "FINANCIAL MODELER PRO",
  "headline": "The platform built by practitioners.",
  "subtitle": "Financial Modeler Pro is PaceMakers'' flagship platform: a learning environment, model library, and analyst toolkit built from the same engagement experience that drives the advisory practice.",
  "cta_label": "Visit Financial Modeler Pro",
  "cta_href": "https://www.financialmodelerpro.com",
  "cta_secondary_label": "About PaceMakers",
  "cta_secondary_href": "/about",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  fmp_intro
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('financial-modeler-pro', 'fmp_intro', '{
  "heading": "Institutional modeling, made learnable.",
  "description_html": "<p>The advisory practice produces a steady stream of models, methods, and hard-won lessons. Financial Modeler Pro is where that knowledge is turned into something others can use: templates, structured learning, and tools built to the same standard we apply on live mandates.</p>",
  "feature_points": [
    "Institutional-grade model templates",
    "Structured learning tracks for analysts",
    "Real, engagement-derived case studies",
    "Built and maintained by working practitioners"
  ],
  "cta_label": "Visit Financial Modeler Pro",
  "cta_href": "https://www.financialmodelerpro.com",
  "logo_url": ""
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  text_image
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('financial-modeler-pro', 'text_image', '{
  "eyebrow": "THE RELATIONSHIP",
  "heading": "One firm, two ways to work with us.",
  "body_html": "<p>PaceMakers is the advisory practice: senior-led mandates in corporate finance, valuation, and transactions. Financial Modeler Pro is the platform: the templates, training, and tools that come out of that work, made available to a wider audience of analysts and teams.</p><p>If you want the work done for you, that is PaceMakers. If you want to build the capability in-house, that is Financial Modeler Pro. The standard behind both is the same.</p>",
  "image_url": "",
  "image_alt": "Financial Modeler Pro, the PaceMakers platform",
  "image_caption": "",
  "image_position": "left",
  "cta_label": "Explore the platform",
  "cta_href": "https://www.financialmodelerpro.com"
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('financial-modeler-pro', 'cta_block', '{
  "headline": "See what the platform can do.",
  "subhead": "Financial Modeler Pro puts institutional-grade modeling within reach. Explore the templates, the learning tracks, and the toolkit.",
  "cta_primary_label": "Visit Financial Modeler Pro",
  "cta_primary_href": "https://www.financialmodelerpro.com",
  "cta_secondary_label": "Talk to PaceMakers",
  "cta_secondary_href": "/contact",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 40, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'financial-modeler-pro';

COMMIT;
