-- 034_seed_founder_profile.sql
-- Founder profile page at /about/ahmad-din, plus the home founder card update.
--
-- Mirrors the structure of FMP's /about/ahmad-din (verified against the real
-- source at app/about/ahmad-din/page.tsx, not only against a description), then
-- translates the content into PMBC's own visual system and positioning. FMP's
-- page is one hardcoded route reading a `team` section off its home page; PMBC
-- splits the same material into nine CMS sections so every block is editable in
-- the page builder.
--
-- Section map for page_slug 'about-ahmad-din':
--   10  founder_hero          portrait, name, two-line title, credentials, CTAs
--   20  paragraphs            Background
--   30  paragraphs            Why PaceMakers
--   40  founder_credentials   Experience and Background   (display: numbered)
--   50  founder_credentials   Expertise Areas             (display: pills)
--   60  founder_credentials   Industry Focus              (display: cards)
--   70  paragraphs            Market Focus
--   80  quote                 Modeling Philosophy
--   90  paragraphs            Personal
--
-- Also repoints the home founder_block CTA from /about to /about/ahmad-din and
-- gives it the proof-point list and LinkedIn CTA that FMP's home founder card
-- carries.
--
-- DML only, no DDL, so `node scripts/seed-founder-profile.mjs` applies it
-- through supabase-js. This file is the record; the script is the executable.
-- Same pairing as migrations 014 to 020.
--
-- !! DESTRUCTIVE ON RE-RUN. DO NOT RE-APPLY ONCE THIS PAGE IS BEING EDITED. !!
--
-- "Idempotent" here means it cannot duplicate rows. It does NOT mean it is safe
-- to re-run: the DELETE below drops every section on this page and the INSERTs
-- put the ORIGINAL seed copy back, so any wording edited through the admin since
-- is silently replaced. That happened on 2026-08-02, when re-applying this file
-- in the SQL editor reverted admin edits to Background. Nothing of substance was
-- lost that time, and it will not always be so.
--
-- Re-run this only to rebuild the page from scratch on a fresh database. To
-- change live copy, edit it in the page builder.
--
-- (This note was added after the fact. The statements below are untouched: an
-- applied migration's behaviour is never edited, only its documentation.)
--
-- Two fields are seeded EMPTY on purpose and need a human:
--   * founder_hero.photo_url      Ahmad's portrait. Renders a gold-framed
--                                 monogram until set. Upload via /admin/media
--                                 (bucket team-photos), then set it in the page
--                                 builder.
--   * the LinkedIn and booking hrefs. A founder profile is a credibility
--     document, so a CTA pointing at a guessed URL is worse than no CTA. Both
--     render only when they have a label AND an href.

BEGIN;

-- Page metadata.
INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
VALUES (
  'about-ahmad-din',
  'Ahmad Din',
  'Ahmad Din | Founder | PaceMakers Business Consultants',
  'Ahmad Din, ACCA Member (UK) and FMVA certified, founder of PaceMakers Business Consultants. Over 12 years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan.',
  'published',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  status = EXCLUDED.status,
  is_system = EXCLUDED.is_system,
  updated_at = NOW();

-- Clear any prior seed of this page so re-running cannot duplicate sections.
DELETE FROM page_sections WHERE page_slug = 'about-ahmad-din';

-- 10. Founder hero.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'founder_hero', 10, true,
  jsonb_build_object(
    'eyebrow', 'Founder',
    'name', 'Ahmad Din',
    'title_primary', 'Corporate Finance and Transaction Advisory Specialist',
    'title_accent', 'Financial Modeling Expert',
    'credentials_line', 'ACCA | FMVA | 12+ Years Experience',
    'intro', 'Founder of PaceMakers Business Consultants. 12+ years in corporate finance and transaction advisory across KSA and Pakistan. ACCA Member (UK) and FMVA certified. Building institutional discipline into every mandate.',
    'photo_url', '',
    'cta_primary_label', 'Connect on LinkedIn',
    'cta_primary_href', '',
    'cta_secondary_label', 'Book a Meeting',
    'cta_secondary_href', ''
  )
);

-- 20. Background.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'paragraphs', 20, true,
  jsonb_build_object(
    'heading', 'Background',
    'html',
      '<p>Ahmad Din is a Corporate Finance and Transaction Advisory Specialist with over 12 years of experience advising sponsors, investment groups, and operating companies across Saudi Arabia, the GCC, and Pakistan.</p>'
      '<p>As Senior Manager of Corporate Finance at Synergistic Financial Advisors, Ahmad serves as lead financial advisor to Dallah Investment (KSA), one of the Kingdom&rsquo;s prominent investment groups. He has led the financial structuring, modeling, and evaluation of multi-billion riyal mixed-use real estate developments across the Dallah portfolio, projects spanning residential towers, commercial districts, hospitality components, and retail destinations. His work integrates phased development planning, installment-based revenue structures, construction cash flow management, debt waterfalls, IRR optimization, and DSCR-compliant lender modeling to support capital raising, joint venture structuring, and disciplined capital deployment across Dallah&rsquo;s multi-asset real estate portfolio.</p>'
      '<p>His renewable energy and infrastructure work includes building comprehensive FP&amp;A operating models for ACWA Power&rsquo;s Central Asia region projects (solar and wind), automating monthly reporting cycles including forecast-year financials, construction cash flows, budget vs. actual variance analysis, IRR tracking, DSCR monitoring, and CFADS calculations. He brings deep expertise in tariff calculation, debt sizing, and debt sculpting for project finance structures across energy and infrastructure sectors. Ahmad has also developed PPP bid frameworks for electric bus fleet projects submitted to the Government of Punjab and Government of Sindh, incorporating Capex structuring, tariff modeling, subsidy analysis, and lifecycle cost economics. In KSA, he independently structured the financial model and feasibility framework for a greenfield biofuel plant, securing project financing from Wa&rsquo;ed, the entrepreneurship arm of Saudi Aramco.</p>'
      '<p>Beyond real estate, energy, and infrastructure, Ahmad has delivered financial due diligence engagements, business valuations (DCF, trading comparables, transaction multiples), and full investment documentation, including feasibility studies, business plans, investment memorandums, and investor pitch decks, across hospitality, healthcare, education, fintech, and industrial sectors to support fundraising, M&amp;A, and exit strategies.</p>'
      '<p>He has trained and mentored over 35 professionals in financial modeling and valuation throughout his career, strengthening advisory capabilities across client mandates.</p>'
      '<p>In 2017, Ahmad established PaceMakers Business Consultants as a sole proprietorship, which he grew and restructured as a Limited Liability Partnership (LLP) in 2023, registered under SECP Section 7 of the LLP Act, 2017. Financial Modeler Pro is the flagship platform of PaceMakers Business Consultants LLP.</p>'
  )
);

-- 30. Why PaceMakers. Adapted from FMP's "Why Financial Modeler Pro" and
-- retuned for PMBC's advisory positioning rather than a platform pitch.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'paragraphs', 30, true,
  jsonb_build_object(
    'heading', 'Why PaceMakers',
    'html',
      '<p>Ahmad founded PaceMakers because he saw a gap in how sophisticated capital is served in the GCC.</p>'
      '<p>The top-tier advisory firms bring institutional discipline but often at senior-in-name-only pricing. Boutique shops promise senior attention but frequently deliver junior work behind the founder&rsquo;s business card. Family offices, developers, and investors who need serious financial analysis often had to choose between the two.</p>'
      '<p>PaceMakers exists to close that gap. Every mandate is led personally by Ahmad, drawing on twelve years of experience on multi-billion riyal transactions. There is no junior handoff, no template rollout, no lowest-common-denominator model. Clients get institutional analysis with senior judgment on every line.</p>'
      '<p>The firm stays deliberately small. That is a feature, not a limitation. A boutique that only takes the mandates it can lead directly is a boutique that stays credible.</p>'
  )
);

-- 40. Experience and Background, numbered.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'founder_credentials', 40, true,
  jsonb_build_object(
    'heading', 'Experience & Background',
    'intro', '',
    'display', 'numbered',
    'items', jsonb_build_array(
      '12+ years in Corporate Finance & Advisory',
      'Experience across KSA, GCC & Pakistan',
      'Lender-grade models: IRR, DSCR, Debt Sizing, Debt Sculpting',
      'Real estate, energy, infrastructure & industrial sectors',
      'Transaction advisory & investment support',
      'Mergers & Acquisitions Advisory',
      'FP&A Operating Models & Automated Reporting',
      'Tariff Calculation & Project Finance Structuring',
      'Financial Due Diligence & Business Valuation',
      'Feasibility Studies, Business Plans & Investor Pitch Decks'
    )
  )
);

-- 50. Expertise Areas, pills.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'founder_credentials', 50, true,
  jsonb_build_object(
    'heading', 'Expertise Areas',
    'intro', '',
    'display', 'pills',
    'items', jsonb_build_array(
      'Transaction Advisory & Financial Due Diligence',
      'Financial Modeling & Business Valuation (DCF, Comparables, Multiples)',
      'Real Estate & Mixed-Use Development Modeling',
      'Renewable Energy & Infrastructure PPP Modeling',
      'FP&A Operating Models & Automated Reporting',
      'Tariff Calculation, Debt Sizing & Debt Sculpting',
      'Mergers & Acquisitions Advisory',
      'Feasibility Analysis & Investment Appraisal',
      'Financial Planning & Analysis (FP&A)',
      'Investor Pitch Deck & Investment Memorandum Development'
    )
  )
);

-- 60. Industry Focus, cards.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'founder_credentials', 60, true,
  jsonb_build_object(
    'heading', 'Industry Focus',
    'intro', '',
    'display', 'cards',
    'items', jsonb_build_array(
      'Real Estate & Mixed-Use Development',
      'Renewable Energy (Solar, Wind, Biofuel)',
      'Construction & Infrastructure',
      'Public-Private Partnerships (PPP)',
      'Hospitality & Healthcare',
      'Mergers & Acquisitions'
    )
  )
);

-- 70. Market Focus.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'paragraphs', 70, true,
  jsonb_build_object(
    'heading', 'Market Focus',
    'html',
      '<p>Saudi Arabia &amp; GCC, with deep experience across KSA-based projects, institutional investors, and regional energy infrastructure. PaceMakers operates from Lahore with primary market focus on Riyadh, Jeddah, Dammam, and the wider GCC.</p>'
  )
);

-- 80. Modeling Philosophy.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'quote', 80, true,
  jsonb_build_object(
    'heading', 'Modeling Philosophy',
    'quote_text', 'A good financial model is not just a calculation, it&rsquo;s a communication tool. Every assumption should be visible, every output should be traceable, and the final product should be something you&rsquo;d be proud to present to a board or an investor committee without reformatting.',
    'attribution_name', 'Ahmad Din',
    'attribution_role', 'Founder, PaceMakers Business Consultants',
    'attribution_photo_url', '',
    'alignment', 'left'
  )
);

-- 90. Personal.
INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
VALUES (
  'about-ahmad-din', 'paragraphs', 90, true,
  jsonb_build_object(
    'heading', 'Personal',
    'html',
      '<p>Based in Lahore, Pakistan. When not building financial models or serving PaceMakers clients, Ahmad enjoys long drives with family, quality time with friends, and exploring good food.</p>'
  )
);

-- Home founder card: repoint the CTA at the new profile page and add the proof
-- points plus the LinkedIn CTA that FMP's home founder card carries.
UPDATE page_sections
SET content = content
  || jsonb_build_object(
       'cta_primary_label', 'Read Full Profile',
       'cta_primary_href', '/about/ahmad-din',
       'cta_secondary_label', 'Connect on LinkedIn',
       'cta_secondary_href', COALESCE(content->>'cta_secondary_href', ''),
       'credentials', jsonb_build_array(
         '12+ years in corporate finance and advisory',
         'Experience across KSA, GCC and Pakistan',
         'Lender-grade models: IRR, DSCR, debt sizing, debt sculpting',
         'Real estate, energy, infrastructure and industrial sectors',
         'Transaction advisory and investment support'
       )
     )
WHERE page_slug = 'home' AND section_type = 'founder_block';

COMMIT;
