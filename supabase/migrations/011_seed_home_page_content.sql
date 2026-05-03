-- 011_seed_home_page_content.sql
-- Phase 9 — Home page real content. Replaces all existing page_sections rows
-- for page_slug='home' (the placeholder hero+paragraphs from migration 007)
-- with the production 9-section flow:
--   10  hero
--   20  founder_block        (eyebrow + headline above founder card)
--   30  stats_block
--   40  service_cards        ("What we do" — 6 capability cards)
--   50  service_cards        ("Who we serve" — 4 audience cards)
--   60  process_steps        (Understand / Analyse / Model / Advise)
--   70  text_image           (Strategic Network)
--   80  quote                (Founder pull quote)
--   90  cta_block            (Have a mandate?)
--
-- Field-name notes:
--   * process_steps renderer reads `heading`. The user's content used `headline`
--     for this section; renderer aliases `headline` → `heading` since Phase 9,
--     but we write the canonical `heading` here for forward consistency.
--   * Nested CTA shapes (`cta`, `cta_primary`, `primary_cta`, etc.) are accepted
--     by the renderers as aliases, but we write the canonical flat shape
--     (`cta_label`/`cta_href`, `cta_primary_label`/`cta_primary_href`,
--     `cta_secondary_label`/`cta_secondary_href`) for forward consistency.
--   * `eyebrow` / section `headline` / `footer_cta_label` / `footer_cta_href`
--     are new fields surfaced in service_cards, process_steps, text_image, and
--     founder_block as of Phase 9.
--
-- Also updates site_settings.settings JSONB with contact_email, admin_email,
-- and office_location_text.

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'home';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'hero', '{
  "badge_text": "PACEMAKERS BUSINESS CONSULTANTS",
  "headline": "Advisory from Structure to Exit",
  "subtitle": "Senior-led corporate finance, valuation, and transaction advisory for family offices, investors, and developers across Saudi Arabia and the GCC.",
  "cta_label": "Start a Conversation",
  "cta_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  founder_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'founder_block', '{
  "eyebrow": "LED BY THE FOUNDER",
  "headline": "Every mandate is led personally by Ahmad Din.",
  "name": "Ahmad Din",
  "credentials_line": "ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan",
  "photo_url": "",
  "bio_html": "<p>At most boutique firms, the founder closes the engagement and hands the work to a junior team. PaceMakers operates differently. When you engage us, Ahmad leads the financial structuring, modeling, valuation, and advisory work directly — drawing on twelve years of experience on mandates including multi-billion riyal real estate portfolios, ACWA Power''s Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects.</p><p>This is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, every recommendation.</p>",
  "cta_primary_label": "About Ahmad",
  "cta_primary_href": "/about",
  "cta_secondary_label": "",
  "cta_secondary_href": "",
  "layout": "image_left"
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  stats_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'stats_block', '{
  "intro": "A track record built on institutional discipline.",
  "stats": [
    { "value": "100+", "label": "Valuations Delivered" },
    { "value": "SAR 20B+", "label": "Real Estate NAV Modeled" },
    { "value": "SAR 300M+", "label": "Capital Deployed via Equity Research" },
    { "value": "9+", "label": "Industries Covered" }
  ]
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  service_cards — "What we do"
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'service_cards', '{
  "eyebrow": "WHAT WE DO",
  "headline": "Built for transactions that need to hold up under scrutiny.",
  "intro": "Six core capabilities, applied to the moments that matter most — capital raises, acquisitions, structuring decisions, and exits. Each engagement is led by Ahmad and built on lender-grade modeling discipline.",
  "cards": [
    { "number": "01", "title": "Financial Modeling", "description": "Lender-grade operating, valuation, and project finance models — IRR, DSCR, debt sizing, and debt sculpting built to institutional standard.", "link": "/services/financial-modeling" },
    { "number": "02", "title": "Business Valuation", "description": "Independent valuations using DCF, trading comparables, and transaction multiples for fundraising, M&A, joint ventures, and shareholder transactions.", "link": "/services/business-valuation" },
    { "number": "03", "title": "M&A Advisory", "description": "Buy-side and sell-side support: target screening, structuring, valuation, negotiation support, and integration analysis through to close.", "link": "/services/mergers-acquisitions" },
    { "number": "04", "title": "Real Estate Modeling", "description": "Mixed-use development modeling — phased construction, installment-based revenue, debt waterfalls, IRR optimization, and DSCR-compliant lender models.", "link": "/services/real-estate-modeling" },
    { "number": "05", "title": "Project Finance", "description": "Tariff calculation, debt sizing, debt sculpting, and CFADS modeling for energy, infrastructure, and PPP transactions.", "link": "/services/project-finance" },
    { "number": "06", "title": "Investment Memorandums", "description": "Investor-ready pitch decks, business plans, and information memorandums — the documentation capital actually closes on.", "link": "/services/investment-memorandums" }
  ],
  "footer_cta_label": "View all services",
  "footer_cta_href": "/services"
}'::jsonb, '{}'::jsonb, 40, true);

-- 50  service_cards — "Who we serve"
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'service_cards', '{
  "eyebrow": "WHO WE SERVE",
  "headline": "Capital allocators who buy advisory on judgment, not headcount.",
  "cards": [
    { "number": "", "title": "Family Offices", "description": "Investment structuring, opportunity evaluation, and portfolio-level financial analysis for single-family and multi-family offices in KSA and the GCC.", "link": "" },
    { "number": "", "title": "Investment Offices", "description": "Deal-level modeling, valuation, and due diligence support — supplementing in-house teams on selective mandates.", "link": "" },
    { "number": "", "title": "Real Estate Developers", "description": "Feasibility, mixed-use modeling, lender-grade financial structuring, and capital-raising support across residential, commercial, and hospitality.", "link": "" },
    { "number": "", "title": "Corporates & Sponsors", "description": "M&A, valuation, project finance, and investor documentation for strategic transactions and capital events.", "link": "" }
  ]
}'::jsonb, '{}'::jsonb, 50, true);

-- 60  process_steps
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'process_steps', '{
  "eyebrow": "HOW WE WORK",
  "heading": "A four-step engagement model, built around clarity.",
  "steps": [
    { "number": "01", "title": "Understand", "description": "We start by understanding the mandate, the decision it must support, and the audience the output must convince — board, lender, sponsor, or investor." },
    { "number": "02", "title": "Analyse", "description": "Commercial diligence, sector benchmarking, and structural review. Numbers don''t exist in a vacuum; we make sure the inputs reflect reality." },
    { "number": "03", "title": "Model", "description": "Lender-grade construction. Every assumption visible, every output traceable, every line defensible under scrutiny." },
    { "number": "04", "title": "Advise", "description": "Recommendations, structuring options, and capital-raising or transaction support — through to close." }
  ],
  "footer_cta_label": "Read more about our approach",
  "footer_cta_href": "/approach"
}'::jsonb, '{}'::jsonb, 60, true);

-- 70  text_image — Strategic Network
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'text_image', '{
  "eyebrow": "STRATEGIC NETWORK",
  "heading": "A focused network across the Gulf.",
  "body_html": "<p>PaceMakers is supported by two long-standing relationships that extend our reach across the GCC. Sky Gulf, headquartered in Al Khobar, brings industrial and project execution depth in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in PaceMakers, provides Bahrain market access and capital-markets insight.</p><p>Together, the network gives clients a senior bench with regional presence — without the overhead of a tier-one firm.</p>",
  "image_url": "",
  "image_alt": "PaceMakers strategic network across the GCC",
  "image_position": "right",
  "cta_label": "Meet the network",
  "cta_href": "/network"
}'::jsonb, '{}'::jsonb, 70, true);

-- 80  quote
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'quote', '{
  "quote_text": "A good financial model is not just a calculation — it''s a communication tool. Every assumption should be visible, every output should be traceable, and the final product should be something you''d be proud to present to a board or an investor committee without reformatting.",
  "attribution_name": "Ahmad Din",
  "attribution_role": "Founder, PaceMakers Business Consultants",
  "attribution_photo_url": "",
  "alignment": "center"
}'::jsonb, '{}'::jsonb, 80, true);

-- 90  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('home', 'cta_block', '{
  "headline": "Have a mandate to discuss?",
  "subhead": "Whether you''re raising capital, evaluating an acquisition, structuring a development, or preparing for an exit — we''d be glad to have a conversation.",
  "cta_primary_label": "Start a Conversation",
  "cta_primary_href": "/contact",
  "cta_secondary_label": "Email Ahmad Directly",
  "cta_secondary_href": "mailto:info@pacemakersglobal.com",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 90, true);

-- Bump the cms_pages.updated_at so admin "last updated" reflects this change.
UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'home';

-- site_settings: merge in real contact details. Idempotent: existing keys are
-- overwritten by the new values, other keys (whatsapp_number, social_linkedin)
-- are preserved.
UPDATE site_settings
SET settings = settings || jsonb_build_object(
  'contact_email', 'info@pacemakersglobal.com',
  'admin_email', 'meetahmadch@gmail.com',
  'office_location_text', 'Lahore, Pakistan · Riyadh, KSA'
),
updated_at = NOW()
WHERE id = 1;

COMMIT;
