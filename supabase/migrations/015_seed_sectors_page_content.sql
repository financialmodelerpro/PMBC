-- 015_seed_sectors_page_content.sql
-- Phase 9 — Sectors page real content. Replaces all existing page_sections rows
-- for page_slug='sectors' (the Phase 6 smoke sector_grid) with the production
-- 4-section flow:
--   10  hero
--   20  sector_grid    (Nine sectors mapped to PMBC's established track record)
--   30  text_image     (Why sector depth matters)
--   40  cta_block
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
-- icon_name values are keys from src/lib/cms/sectorIcons.tsx. Sectors map to the
-- track record in CLAUDE.md §15 reminder #3, plus the family-office audience the
-- firm serves.
--
-- Mirrors scripts/seed-sectors-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'sectors';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('sectors', 'hero', '{
  "badge_text": "SECTOR COVERAGE",
  "headline": "Sectors we know from the inside.",
  "subtitle": "We do not cover every industry. We cover the ones where we have modeled the assets, valued the deals, and structured the capital, across Saudi Arabia, the GCC, and worldwide mandates.",
  "cta_label": "Discuss Your Sector",
  "cta_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  sector_grid
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('sectors', 'sector_grid', '{
  "eyebrow": "WHERE WE WORK",
  "heading": "Nine sectors, underwritten firsthand.",
  "intro": "Each represents mandates we have delivered, not a capability statement. The depth comes from having sat with the numbers, the lenders, and the operators in each.",
  "sectors": [
    {
      "icon_name": "building2",
      "title": "Real Estate & Development",
      "description": "Mixed-use, residential, commercial, and hospitality developments. Feasibility, phased construction modeling, debt waterfalls, and lender-grade structuring. Over SAR 20 billion in real estate NAV modeled."
    },
    {
      "icon_name": "zap",
      "title": "Energy & Renewables",
      "description": "Power, renewable infrastructure, and biofuel projects. Tariff calculation, debt sizing, debt sculpting, and CFADS modeling, including ACWA Power''s Central Asia renewable portfolio."
    },
    {
      "icon_name": "droplet",
      "title": "Oil & Gas",
      "description": "Upstream and downstream mandates, including Saudi Aramco-backed industrial projects. Valuation, project finance, and transaction support."
    },
    {
      "icon_name": "wrench",
      "title": "Industrial Services",
      "description": "Service businesses across the industrial value chain. Valuation, M&A, and CFO-level financial structuring for owners and acquirers."
    },
    {
      "icon_name": "hammer",
      "title": "Construction & Contracting",
      "description": "Contractors and developers. Project feasibility, working-capital modeling, and capital-raising support for build programs."
    },
    {
      "icon_name": "server",
      "title": "Data Centers & Digital Infrastructure",
      "description": "Hyperscale and colocation assets. Demand modeling, capital structuring, and valuation for a fast-moving asset class."
    },
    {
      "icon_name": "trees",
      "title": "Waste Management & Environment",
      "description": "Waste, recycling, and environmental services. Valuation and transaction advisory for an increasingly institutional sector."
    },
    {
      "icon_name": "factory",
      "title": "Manufacturing & Heavy Industry",
      "description": "Plants, processing, and heavy industry. Independent valuation, due diligence support, and acquisition modeling."
    },
    {
      "icon_name": "banknote",
      "title": "Family Offices & Private Capital",
      "description": "Single-family and multi-family offices. Opportunity evaluation, portfolio-level analysis, and investment structuring across asset classes."
    }
  ]
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  text_image
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('sectors', 'text_image', '{
  "eyebrow": "WHY IT MATTERS",
  "heading": "Sector fluency changes the model.",
  "body_html": "<p>A discount rate, a construction schedule, a tariff curve, an offtake assumption: each carries sector-specific judgment that a generalist model quietly gets wrong. We build from the assumptions that actually drive value in your industry, then pressure-test them against how the deal will be read by a board, a lender, or an investment committee.</p><p>That is the difference between a model that calculates and a model that convinces.</p>",
  "image_url": "",
  "image_alt": "Sector-specific financial modeling at PaceMakers",
  "image_caption": "",
  "image_position": "right",
  "cta_label": "How we work",
  "cta_href": "/approach"
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('sectors', 'cta_block', '{
  "headline": "Working on a mandate in one of these sectors?",
  "subhead": "Tell us about the asset or the transaction. We will tell you candidly whether it is a fit for our bench.",
  "cta_primary_label": "Start a Conversation",
  "cta_primary_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 40, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'sectors';

COMMIT;
