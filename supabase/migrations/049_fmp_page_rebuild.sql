-- 049_fmp_page_rebuild.sql
-- Rebuild the Financial Modeler Pro page in full, for its new home at /fmp.
--
-- THE URL MOVED, THE CMS SLUG DID NOT
-- The page is served at /fmp from this migration onward, with a 301 from
-- /financial-modeler-pro in next.config.ts. `cms_pages.slug` stays
-- `financial-modeler-pro`, so the row keeps its id, its is_system flag and its
-- history; only the route changed, and `lib/cms/pageRoutes.ts` records the
-- mapping so the page-builder preview follows.
--
-- The three sub-pages under /financial-modeler-pro (modeling-hub, refm,
-- training-hub) are untouched. Their code and the FMP API integration behind
-- them stay live, but nothing links to them and they are out of the sitemap.
-- The redirect matches the exact parent path only, so they still resolve.
--
-- SEVEN SECTIONS
--   10  hero                 the platform arm, with the capability line
--   15  founder_credentials  eight capability tags as pills
--   20  prose_checklist      what FMP is, prose beside a six-item checklist
--   30  service_cards        who it is built for, six audiences
--   40  feature_cards        Modeling Hub and Training Hub, six bullets each
--   50  feature_cards        the two certification paths, with real figures
--   60  cta_block            out to financialmodelerpro.com
--
-- Two section types are new: `prose_checklist` and `feature_cards`. Neither
-- existed because nothing before this needed prose beside a checklist, or a
-- card carrying metadata chips, a bullet list and its own call to action.
--
-- THE COPY IS PMBC'S OWN
-- This page does not call FMP's API. It is PMBC describing its platform arm to
-- PMBC's audience, which is a different job from describing the product, and it
-- is edited in the page builder like any other page.
--
-- THE FIGURES ARE FMP'S, READ FROM THE LIVE SITE ON 2026-08-11
--   3SFM  "3-Statement Financial Modeling"  17 Sessions, 6 Hours, Beginner
--   BVM   "Business Valuation Modeling"      6 Lessons,  3 Hours, Intermediate
--
-- Where FMP's own sources disagreed, the published figure won. Its `courses`
-- table holds 18 and 7 lesson rows while its certificate copy and its public
-- training page both say 17 and 6, and its `courses.title` column reads
-- "Business Valuation Methods" while the rendered page reads "Business
-- Valuation Modeling". A reader can check the page, not the column.
--
-- DML only, so `node scripts/seed-fmp-page-rebuild.mjs` applies it. Named
-- `-rebuild` because scripts/seed-fmp-page.mjs is already the executable record
-- of migration 018 and applied pairs are never edited here.
--
-- Cannot duplicate rows: it deletes this page's sections and reinserts, so a
-- re-run restores this copy over later edits to this page.

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'financial-modeler-pro';

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES

('financial-modeler-pro', 'hero', jsonb_build_object(
  'badge_text', 'THE PLATFORM ARM OF PACEMAKERS',
  'headline', 'Where financial modeling meets real-world execution',
  'subtitle', 'Built by a practitioner with twelve years on multi-billion riyal deals, now available as free certification training and institutional-grade modeling tools.',
  'cta_label', 'Visit Financial Modeler Pro',
  'cta_href', 'https://www.financialmodelerpro.com',
  'cta_secondary_label', 'Speak to the firm',
  'cta_secondary_href', '/contact'
), '{}'::jsonb, 10, true),

('financial-modeler-pro', 'founder_credentials', jsonb_build_object(
  'heading', '',
  'intro', '',
  'display', 'pills',
  'items', jsonb_build_array(
    'Real Estate Models', 'Business Valuation', 'Project Finance', 'Renewable Energy',
    'FP&A', 'Capital Structuring', 'Debt Sizing', 'M&A Advisory'
  )
), '{}'::jsonb, 15, true),

('financial-modeler-pro', 'prose_checklist', jsonb_build_object(
  'eyebrow', 'THE PLATFORM',
  'heading', 'What is Financial Modeler Pro.',
  'list_heading', 'What you get',
  'html', '<p>Financial Modeler Pro is the software and training arm of PaceMakers Business Consultants. It takes the modeling frameworks the firm uses on live transactions and makes them directly usable, as structured tools rather than as a consulting engagement.</p><p>It runs as two halves that share one standard of work. The <strong>Training Hub</strong> teaches the method: assessed video courses that end in a verified certificate, free and without a paywall. The <strong>Modeling Hub</strong> is the method in software: guided workflows that build a complete model module by module, from project setup through revenue, costs and financing to returns.</p><p>Every model on the platform is structured for real-world use rather than for a classroom. Assumptions are flagged where they are made and stay traceable to the outputs they drive, so a reviewer can follow any number back to its source. What comes out is a formula-linked Excel workbook that can be taken apart and rebuilt, and an investor-ready PDF that can go to a lender, a board or an investment committee without reformatting.</p>',
  'items', jsonb_build_array(
    jsonb_build_object('title', 'Multi-discipline modeling', 'description', 'Real estate development, business valuation, project finance, FP&A and corporate finance, each with its own workflow rather than one generic template.'),
    jsonb_build_object('title', 'Structured workflows', 'description', 'A model is built module by module in a fixed order, so nothing is left undefined and no assumption is buried in a cell nobody opens.'),
    jsonb_build_object('title', 'Monthly or annual periods', 'description', 'Choose the periodicity the transaction actually needs. Monthly for construction draws and cash sweeps, annual for long-horizon valuation.'),
    jsonb_build_object('title', 'Formula-linked Excel and investor PDF export', 'description', 'The workbook exports with its formulas intact, not as pasted values, alongside a clean PDF report ready to circulate.'),
    jsonb_build_object('title', 'Free certification', 'description', 'Both certification paths are free, with no subscription and no paywall, and the certificate carries a unique ID that anyone can verify.'),
    jsonb_build_object('title', 'Built by a practitioner, not a software company', 'description', 'Every module reflects how a deal was actually structured. When a live mandate exposes a structure the tools handle badly, the tools change.')
  )
), '{}'::jsonb, 20, true),

('financial-modeler-pro', 'service_cards', jsonb_build_object(
  'eyebrow', 'WHO IT IS FOR',
  'headline', 'Built for the people who have to defend the numbers.',
  'intro', 'The platform assumes a working knowledge of finance and no patience for a course that never reaches a model.',
  'cards', jsonb_build_array(
    jsonb_build_object('number', '01', 'title', 'Financial Analysts', 'link', '', 'description', 'Build a complete, balanced model without starting from an empty workbook every time. The structure, the schedules and the checks are already in place, so the work goes into the assumptions rather than into wiring up the mechanics.'),
    jsonb_build_object('number', '02', 'title', 'Investment Professionals', 'link', '', 'description', 'Screen and underwrite opportunities on a consistent basis. Scenario analysis compares cases side by side, and the IC presentation builder turns the result into a deck whose figures stay linked to the model behind it.'),
    jsonb_build_object('number', '03', 'title', 'Real Estate Developers', 'link', '', 'description', 'Model a phased, multi-asset development properly: mixed unit programmes, construction drawn against a facility with interest capitalised during the build, instalment revenue, and an equity waterfall that survives a lender review.'),
    jsonb_build_object('number', '04', 'title', 'Family Offices', 'link', '', 'description', 'Review your own holdings rather than outsourcing the review. Test a sponsor case yourself, see which assumptions carry the return, and hold an independent view before committing capital.'),
    jsonb_build_object('number', '05', 'title', 'Lenders and Banks', 'link', '', 'description', 'Interrogate a borrower model on your own terms. DSCR, debt sizing, sculpting and covenant headroom are computed explicitly, so a credit team can stress the case rather than accept a sponsor summary.'),
    jsonb_build_object('number', '06', 'title', 'Students and Aspiring Analysts', 'link', '', 'description', 'Learn the method that firms actually use, then prove it. Both certification paths are free, assessed rather than attendance-based, and end in a certificate an employer can verify online.')
  )
), '{}'::jsonb, 30, true),

('financial-modeler-pro', 'feature_cards', jsonb_build_object(
  'eyebrow', 'THE TWO HALVES',
  'heading', 'Two platforms. One destination.',
  'intro', 'One teaches the method and one runs it. Both are free to start and both open on the Financial Modeler Pro site.',
  'cards', jsonb_build_array(
    jsonb_build_object(
      'title', 'Modeling Hub',
      'code', 'BUILD',
      'description', 'The modeling engine. A guided workflow takes a model from project setup through to investor returns, one module at a time, with every calculation traceable to the input that drives it. Real Estate Financial Modeling is live now, with business valuation and equity research in build.',
      'meta', jsonb_build_array('Live now', 'Free to start'),
      'bullets', jsonb_build_array(
        'Project setup covering structure, land allocation, costs and financing',
        'Revenue modelling across unit sales, hospitality and retail, with cohort-based collection',
        'Operating expense, payroll and fixed-cost schedules across the operating window',
        'A full three-statement output: P&L, cash flow and balance sheet, linked and balanced',
        'Returns analysis with IRR, NPV, MoIC, DSCR, equity multiples and stabilised yield',
        'Scenario analysis and an IC presentation builder whose figures stay linked to the model'
      ),
      'note', 'Exports to a formula-linked Excel workbook and an investor-ready PDF.',
      'cta_label', 'Explore Modeling Hub',
      'cta_href', 'https://app.financialmodelerpro.com/modeling'
    ),
    jsonb_build_object(
      'title', 'Training Hub',
      'code', 'LEARN',
      'description', 'The method, taught and assessed. Video sessions build the model with you, each one ending in a quiz you have to pass before the next unlocks, and the path finishes with a certification exam. Free, and it stays free.',
      'meta', jsonb_build_array('2 certification paths', '100% free'),
      'bullets', jsonb_build_array(
        'Two paths: 3-Statement Financial Modeling and Business Valuation Modeling',
        'Sessions delivered on the platform, each ending in an assessment',
        'A 70% pass mark on each session before the next one unlocks',
        'A final certification exam covering the whole path',
        'A verified certificate with a unique ID, QR code and a permanent verification link',
        'No fees, no subscription and no paywall on any course or certificate'
      ),
      'note', 'Employers and institutions can verify any certificate online at any time.',
      'cta_label', 'Browse Free Courses',
      'cta_href', 'https://app.financialmodelerpro.com/training'
    )
  )
), '{}'::jsonb, 40, true),

('financial-modeler-pro', 'feature_cards', jsonb_build_object(
  'eyebrow', 'CERTIFICATION',
  'heading', 'Two paths, both free, both assessed.',
  'intro', 'Certification is earned on assessment rather than attendance. Each path ends in an exam and a certificate carrying a unique ID.',
  'cards', jsonb_build_array(
    jsonb_build_object(
      'title', '3-Statement Financial Modeling',
      'code', '3SFM',
      'description', 'The complete integrated model, built from zero: income statement, balance sheet and cash flow statement, linked and balanced. The foundation every other discipline on the platform assumes you have.',
      'meta', jsonb_build_array('17 Sessions', '6 Hours', 'Beginner'),
      'bullets', jsonb_build_array(
        'Build a fully integrated income statement, balance sheet and cash flow statement',
        'Model capex, depreciation, working capital and debt schedules',
        'Create revenue models with capacity planning and production forecasts',
        'Build COGS, payroll, overhead and tax models from scratch',
        'Link all three statements and balance the balance sheet',
        'Apply the Excel techniques used in investment banking and corporate finance'
      ),
      'note', 'Verified certificate with a unique ID on passing all 17 assessments and the final exam.',
      'cta_label', 'View the 3SFM course',
      'cta_href', 'https://app.financialmodelerpro.com/training/00000000-0000-0000-0000-0000000035f0'
    ),
    jsonb_build_object(
      'title', 'Business Valuation Modeling',
      'code', 'BVM',
      'description', 'The three core valuation methodologies used by investment bankers, corporate finance teams and equity researchers, built from scratch in Excel and presented as a professional football field chart.',
      'meta', jsonb_build_array('6 Lessons', '3 Hours', 'Intermediate'),
      'bullets', jsonb_build_array(
        'Apply DCF valuation using both FCFF and FCFE',
        'Build a rolling WACC model and reconcile FCFF against FCFE',
        'Construct a comparable companies valuation model',
        'Calculate and apply EV/EBITDA, P/E and EV/Revenue multiples',
        'Apply control premium and DLOM adjustments',
        'Build a football field chart showing the valuation range'
      ),
      'note', 'Verified certificate with a unique ID on passing all 6 lesson assessments and the final exam.',
      'cta_label', 'View the BVM course',
      'cta_href', 'https://app.financialmodelerpro.com/training/00000000-0000-0000-0000-00000000b600'
    )
  )
), '{}'::jsonb, 50, true),

('financial-modeler-pro', 'cta_block', jsonb_build_object(
  'eyebrow', 'GET STARTED',
  'headline', 'Start on the platform. Come to the firm when it stops being a modeling question.',
  'subhead', 'Registration is free, the Modeling Hub is open and both certification paths cost nothing. When the question moves past the model and becomes a judgment call, PaceMakers takes it from there.',
  'cta_primary_label', 'Go to Financial Modeler Pro',
  'cta_primary_href', 'https://www.financialmodelerpro.com',
  'cta_secondary_label', 'Speak to the firm',
  'cta_secondary_href', '/contact'
), '{}'::jsonb, 60, true);

UPDATE cms_pages
SET meta_title = 'Financial Modeler Pro | PaceMakers Business Consultants',
    meta_description = 'Financial Modeler Pro is the platform arm of PaceMakers Business Consultants: guided institutional-grade modeling workflows and free assessed certification in financial modeling and business valuation.',
    updated_at = NOW()
WHERE slug = 'financial-modeler-pro';

-- Navigation. Inserted before Contact so the firm's own pages stay leftmost and
-- the contact link keeps the last slot it has always had.
UPDATE site_pages SET display_order = display_order + 10
WHERE display_order >= (SELECT display_order FROM site_pages WHERE href = '/contact');

INSERT INTO site_pages (label, href, display_order, visible)
SELECT 'Financial Modeler Pro', '/fmp',
       COALESCE((SELECT MIN(display_order) - 10 FROM site_pages WHERE href = '/contact'), 60),
       true
WHERE NOT EXISTS (SELECT 1 FROM site_pages WHERE href IN ('/fmp', '/financial-modeler-pro'));

UPDATE site_pages
SET label = 'Financial Modeler Pro', href = '/fmp', visible = true, updated_at = NOW()
WHERE href = '/financial-modeler-pro';

COMMIT;
