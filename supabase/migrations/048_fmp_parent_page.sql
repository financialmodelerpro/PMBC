-- 048_fmp_parent_page.sql
-- Rebuild /financial-modeler-pro as a proper overview of PMBC's platform arm.
--
-- WHAT WAS THERE
-- Four sections that said, in three different ways, that FMP exists and that
-- PMBC built it: a hero, an fmp_intro block, a text_image on the relationship,
-- and a closing CTA. It never described what the platform actually does, and it
-- had nowhere to send a reader next.
--
-- WHAT REPLACES IT
-- Nine sections that walk the reader from why the platform exists to what is
-- in it and out to the platform itself:
--
--   10  hero                   the platform arm, stated plainly
--   20  paragraphs             why Financial Modeler Pro exists
--   30  service_cards          the three areas, each LINKING to its own page
--   40  paragraphs             the Modeling Hub, the focus of the platform
--   50  paragraphs             Real Estate Financial Modeling
--   60  paragraphs             the Training Hub, briefly
--   70  founder_credentials    who it is built for
--   80  paragraphs             how it connects to the advisory practice
--   90  cta_block              out to financialmodelerpro.com
--
-- THIS COPY IS PMBC'S OWN, AUTHORED HERE
-- The three sub-pages under /financial-modeler-pro fetch their body content
-- from FMP's public feed at request time. This page does not, and deliberately:
-- it is PMBC talking about its own platform arm to PMBC's own audience, which
-- is a different job from describing the product. It is ordinary CMS content
-- and is edited in the page builder like any other page.
--
-- The card links point at PMBC's own sub-pages rather than at FMP, so a reader
-- stays on the credibility document until they choose to leave. The single
-- deliberate exit is the closing CTA.
--
-- NO TRACK RECORD CLAIMS
-- Nothing here restates the firm's mandate count or the partner's career
-- figures. Migration 044 separated those two deliberately and this page is
-- about neither.
--
-- DML only, so `node scripts/seed-fmp-parent-page.mjs` applies it through
-- supabase-js. Idempotent: it deletes this page's sections and reinserts, so a
-- re-run restores this copy over later edits to this page. Nothing else is
-- touched.

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'financial-modeler-pro';

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES

('financial-modeler-pro', 'hero', jsonb_build_object(
  'badge_text', 'THE PLATFORM ARM',
  'headline', 'Financial Modeler Pro',
  'subtitle', 'The software and training arm of PaceMakers Business Consultants. The same modeling discipline we bring to a mandate, built into a platform that anyone can use.',
  'cta_label', 'Explore the Modeling Hub',
  'cta_href', '/financial-modeler-pro/modeling-hub',
  'cta_secondary_label', 'Visit the platform',
  'cta_secondary_href', 'https://www.financialmodelerpro.com'
), '{}'::jsonb, 10, true),

('financial-modeler-pro', 'paragraphs', jsonb_build_object(
  'heading', 'Why it exists.',
  'align', 'left',
  'html', '<p>Advisory work does not scale. A mandate takes the partner''s time, and the firm takes on a limited number each year by design. That leaves a large number of people who need the same analytical rigor and will never be a PaceMakers client: an analyst at a developer, a family office reviewing its own numbers, a founder preparing for a first institutional round.</p><p>Financial Modeler Pro exists for them. It takes the frameworks the firm uses on live transactions and makes them usable directly, as structured tools rather than as a consulting engagement. The distinction matters: it is not a course about modeling and it is not a template library. It is the working method, made operable.</p>'
), '{}'::jsonb, 20, true),

('financial-modeler-pro', 'service_cards', jsonb_build_object(
  'eyebrow', 'WHAT IS ON THE PLATFORM',
  'headline', 'Three areas, one standard of work.',
  'intro', 'Each has its own page here, with the current detail read live from the platform.',
  'cards', jsonb_build_array(
    jsonb_build_object(
      'number', '01',
      'title', 'Modeling Hub',
      'description', 'The core of the platform. Guided modeling workflows for valuation, project finance, leveraged transactions and FP and A, each producing a formula-linked Excel workbook and a presentation-ready PDF.',
      'link', '/financial-modeler-pro/modeling-hub'
    ),
    jsonb_build_object(
      'number', '02',
      'title', 'Real Estate Financial Modeling',
      'description', 'Development feasibility for multi-asset projects, from land acquisition and construction draws through financing structures to investor returns and exit.',
      'link', '/financial-modeler-pro/refm'
    ),
    jsonb_build_object(
      'number', '03',
      'title', 'Training Hub',
      'description', 'Assessed certification for financial modeling, with verifiable certificates. Free, and built on the same material as the rest of the platform.',
      'link', '/financial-modeler-pro/training-hub'
    )
  )
), '{}'::jsonb, 30, true),

('financial-modeler-pro', 'paragraphs', jsonb_build_object(
  'heading', 'The Modeling Hub is the platform.',
  'align', 'left',
  'html', '<p>Everything else on Financial Modeler Pro supports the Modeling Hub. It replaces the blank spreadsheet with a structured workflow: the model is built module by module, each assumption is flagged where it is made, and every calculation stays traceable to the input that drives it.</p><p>What comes out is the part that usually costs the most time. A fully formula-linked Excel workbook that can be taken apart and rebuilt, and a clean PDF that can go to a lender or an investment committee without reformatting. Most of the effort in a modeling exercise is not the analysis. It is the presentation of the analysis, and that is the part the Hub removes.</p><p><a href="/financial-modeler-pro/modeling-hub">See what the Modeling Hub covers</a>.</p>'
), '{}'::jsonb, 40, true),

('financial-modeler-pro', 'paragraphs', jsonb_build_object(
  'heading', 'Real estate, modeled properly.',
  'align', 'left',
  'html', '<p>Real Estate Financial Modeling is the platform''s deepest single discipline, and the one closest to the firm''s own mandate history. It handles what a general-purpose model cannot: a phased development with a mixed unit programme, construction drawn down against a facility with interest capitalised during the build, revenue arriving on instalment terms across residential, hospitality and retail at once, and an equity waterfall that has to survive a lender''s review.</p><p>It is the reason the firm''s real estate work is called Real Estate Financial Modeling rather than real estate modeling. The financial structure is the hard part.</p><p><a href="/financial-modeler-pro/refm">See the REFM platform</a>.</p>'
), '{}'::jsonb, 50, true),

('financial-modeler-pro', 'paragraphs', jsonb_build_object(
  'heading', 'Training, for the people who will do the work.',
  'align', 'left',
  'html', '<p>The Training Hub certifies financial modeling competence through assessed sessions rather than attendance. It is free, and it stays free. It exists because the firm would rather the analysts it works across the table from were good at this.</p><p><a href="/financial-modeler-pro/training-hub">See the Training Hub</a>.</p>'
), '{}'::jsonb, 60, true),

('financial-modeler-pro', 'founder_credentials', jsonb_build_object(
  'heading', 'Who it is built for',
  'intro', 'The platform assumes a working knowledge of finance and no patience for a course.',
  'display', 'cards',
  'items', jsonb_build_array(
    'Analysts and associates at developers, investors and advisory firms',
    'Family offices reviewing their own holdings rather than outsourcing the review',
    'Founders and CFOs preparing for a raise, a facility or a board',
    'Lenders and credit teams testing a sponsor''s numbers',
    'Students and career changers moving into corporate finance'
  )
), '{}'::jsonb, 70, true),

('financial-modeler-pro', 'paragraphs', jsonb_build_object(
  'heading', 'How it connects to the advisory practice.',
  'align', 'left',
  'html', '<p>The two are one firm, and the traffic runs both ways. The platform is built from advisory work: every module reflects how a transaction was actually structured, not how a textbook says it should be. When a mandate turns up a structure the tools handle badly, the tools change.</p><p>In the other direction, the platform is often where a client relationship starts. Someone uses the Hub, reaches the point where the question stops being a modeling question and becomes a judgment question, and gets in touch. That is the right order. Software is good at method. It is not good at telling you whether a deal is worth doing.</p><p>PaceMakers takes the mandates. Financial Modeler Pro takes everything that does not need a mandate. <a href="/contact">Speak to the firm</a> if the question has moved past the model.</p>'
), '{}'::jsonb, 80, true),

('financial-modeler-pro', 'cta_block', jsonb_build_object(
  'eyebrow', 'THE PLATFORM',
  'headline', 'Use the platform.',
  'subhead', 'Registration is free and the Modeling Hub is open. No mandate, no engagement letter, no call required.',
  'cta_primary_label', 'Go to Financial Modeler Pro',
  'cta_primary_href', 'https://www.financialmodelerpro.com',
  'cta_secondary_label', 'Speak to the firm',
  'cta_secondary_href', '/contact'
), '{}'::jsonb, 90, true);

-- Page metadata, so the overview describes itself rather than inheriting the
-- old one-line description.
UPDATE cms_pages
SET meta_title = 'Financial Modeler Pro | PaceMakers Business Consultants',
    meta_description = 'Financial Modeler Pro is the platform arm of PaceMakers Business Consultants: guided financial modeling workflows, real estate development feasibility, and free assessed certification.',
    updated_at = NOW()
WHERE slug = 'financial-modeler-pro';

COMMIT;
