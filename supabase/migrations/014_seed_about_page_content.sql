-- 014_seed_about_page_content.sql
-- Phase 9 — About page real content. Replaces all existing page_sections rows
-- for page_slug='about' (the Phase 6 smoke-seed founder_block + text_image) with
-- the production 7-section flow:
--   10  hero
--   20  text_image     (The firm — "A boutique by design")
--   30  stats_block    (Track record)
--   40  founder_block  (Ahmad Din, detailed bio, link out to FMP for full bio)
--   50  quote          (Firm philosophy)
--   60  text_image     (Network reach — Sky Gulf / Lynkers, cross-link to /network)
--   70  cta_block      (Have a mandate?)
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
-- Facts are grounded in content already established in the repo; the full
-- professional bio is linked out to Financial Modeler Pro, not duplicated here
-- (cross-property rule, CLAUDE.md §13).
--
-- Mirrors scripts/seed-about-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'about';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'hero', '{
  "badge_text": "ABOUT PACEMAKERS",
  "headline": "A boutique built around senior judgment.",
  "subtitle": "PaceMakers Business Consultants is a corporate finance and transaction advisory firm serving family offices, investors, and developers across Saudi Arabia, the GCC, and worldwide. Founded in 2017, we run deliberately small, so the partner who wins the mandate is the partner who delivers it.",
  "cta_label": "Start a Conversation",
  "cta_href": "/contact",
  "cta_secondary_label": "Our Approach",
  "cta_secondary_href": "/approach",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  text_image  (The firm)
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'text_image', '{
  "eyebrow": "THE FIRM",
  "heading": "A boutique by design.",
  "body_html": "<p>PaceMakers is deliberately small. Every engagement is led by a senior who has personally underwritten transactions on the buy-side, the sell-side, and the lender-side. We do not run a leverage model where the work cascades to first-year analysts once the engagement letter is signed.</p><p>That structure is a choice, not a limitation. It lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee. The result is work that holds up under scrutiny, and clients who come back.</p>",
  "image_url": "",
  "image_alt": "PaceMakers Business Consultants",
  "image_caption": "",
  "image_position": "right",
  "cta_label": "See how we work",
  "cta_href": "/approach"
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  stats_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'stats_block', '{
  "intro": "A track record built on institutional discipline, across real estate, energy, infrastructure, and industrial mandates.",
  "stats": [
    { "value": "100+", "label": "Valuations Delivered" },
    { "value": "SAR 20B+", "label": "Real Estate NAV Modeled" },
    { "value": "SAR 300M+", "label": "Capital Deployed via Equity Research" },
    { "value": "9+", "label": "Industries Covered" }
  ]
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  founder_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'founder_block', '{
  "eyebrow": "THE FOUNDER",
  "headline": "Led by Ahmad Din.",
  "name": "Ahmad Din",
  "credentials_line": "ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan",
  "photo_url": "",
  "bio_html": "<p>Ahmad founded PaceMakers to bring senior, analytically grounded advisory to the mandates that larger firms either skip or under-staff. Over twelve years in corporate finance, his work has spanned multi-billion riyal real estate portfolios, ACWA Power''s Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects, alongside transactions in biofuel, oil and gas, waste management, data centers, construction, and industrial services across Saudi Arabia and the GCC.</p><p>He is an ACCA Member (UK) and FMVA-certified, and he leads the financial structuring, modeling, valuation, and advisory work on every PaceMakers engagement personally. For the full professional bio, including platforms, prior firms, and selected mandates, see his page on Financial Modeler Pro.</p>",
  "cta_primary_label": "Full bio on Financial Modeler Pro",
  "cta_primary_href": "https://www.financialmodelerpro.com/about/ahmad-din",
  "cta_secondary_label": "Start a Conversation",
  "cta_secondary_href": "/contact",
  "layout": "image_left"
}'::jsonb, '{}'::jsonb, 40, true);

-- 50  quote
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'quote', '{
  "quote_text": "Capital allocators do not buy headcount. They buy judgment, the kind that comes from having sat on every side of the table. That is what we offer, and it is the only thing we offer.",
  "attribution_name": "Ahmad Din",
  "attribution_role": "Founder, PaceMakers Business Consultants",
  "attribution_photo_url": "",
  "alignment": "center"
}'::jsonb, '{}'::jsonb, 50, true);

-- 60  text_image  (Network reach)
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'text_image', '{
  "eyebrow": "REACH WITHOUT THE OVERHEAD",
  "heading": "Boutique focus, regional presence.",
  "body_html": "<p>A boutique does not have to mean a narrow one. PaceMakers is supported by a focused network across the Gulf. Sky Gulf, headquartered in Al Khobar, brings industrial and project-execution depth in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in the firm, provides Bahrain market access and capital-markets insight.</p><p>The combination gives clients a senior bench with regional reach, without the cost structure of a tier-one firm.</p>",
  "image_url": "",
  "image_alt": "PaceMakers strategic network across the GCC",
  "image_caption": "",
  "image_position": "left",
  "cta_label": "Meet the network",
  "cta_href": "/network"
}'::jsonb, '{}'::jsonb, 60, true);

-- 70  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('about', 'cta_block', '{
  "headline": "Have a mandate to discuss?",
  "subhead": "Whether you are raising capital, evaluating an acquisition, structuring a development, or preparing for an exit, we would be glad to have a conversation.",
  "cta_primary_label": "Start a Conversation",
  "cta_primary_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 70, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'about';

COMMIT;
