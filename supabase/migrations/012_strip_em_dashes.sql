-- 012_strip_em_dashes.sql
-- Strip em dashes (U+2014) from all PMBC content per the Content Style Rule
-- in CLAUDE.md. Replacements are context-specific (comma, colon, period, or
-- parenthesis) per the rule, so each row is rewritten explicitly rather than
-- by blanket regex.
--
-- En dashes (U+2013) are preserved inside numeric ranges (e.g. "3-5 weeks",
-- "2017-2024" written with en dash). The rule allows that exception.
--
-- Affected rows:
--   * cms_pages.meta_title         (12 rows: " - " brand suffix becomes " | ")
--   * email_templates.subject      (2 rows: contact_notification, contact_acknowledgement)
--   * cms_content (service_*)      (11 rows across 9 service detail namespaces)
--   * page_sections (page_slug=home)  (7 rows across 9 sections)
--
-- Idempotent. Each UPDATE matches on the OLD em-dash text; running the
-- migration twice is a no-op because the second run finds nothing to update.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1a. cms_pages.meta_title: replace " — PaceMakers Business Consultants"
--     suffix with " | PaceMakers Business Consultants". Uses literal replace
--     rather than regex.
-- ---------------------------------------------------------------------------
UPDATE cms_pages
SET meta_title = REPLACE(
  meta_title,
  ' — PaceMakers Business Consultants',
  ' | PaceMakers Business Consultants'
)
WHERE meta_title LIKE '% — PaceMakers Business Consultants';

-- 1b. Home meta_title carries " — Advisory from Structure to Exit" (em dash
--     in the middle, not as the brand suffix). Convert to pipe.
UPDATE cms_pages
SET meta_title = REPLACE(
  meta_title,
  'PaceMakers Business Consultants — Advisory from Structure to Exit',
  'PaceMakers Business Consultants | Advisory from Structure to Exit'
)
WHERE slug = 'home'
  AND meta_title = 'PaceMakers Business Consultants — Advisory from Structure to Exit';

-- ---------------------------------------------------------------------------
-- 2. email_templates.subject
-- ---------------------------------------------------------------------------
UPDATE email_templates
SET subject = 'New contact submission: {{name}}'
WHERE template_key = 'contact_notification'
  AND subject = 'New contact submission — {{name}}';

UPDATE email_templates
SET subject = 'Thank you for reaching out | PaceMakers Business Consultants'
WHERE template_key = 'contact_acknowledgement'
  AND subject = 'Thank you for reaching out — PaceMakers Business Consultants';

-- ---------------------------------------------------------------------------
-- 3. cms_content (service_*): per-key targeted rewrites
-- ---------------------------------------------------------------------------

-- service_financial-modeling.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'the model is meant to inform — not to a generic template.',
  'the model is meant to inform, not to a generic template.'
)
WHERE section = 'service_financial-modeling' AND key = 'full_description';

-- service_financial-modeling.target_audience_text
UPDATE cms_content
SET value = REPLACE(
  value,
  'supports a real decision — not a polished spreadsheet.',
  'supports a real decision, not a polished spreadsheet.'
)
WHERE section = 'service_financial-modeling' AND key = 'target_audience_text';

-- service_business-valuation.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'comparable transactions and trading multiples — and explains, in writing,',
  'comparable transactions and trading multiples, and explains, in writing,'
)
WHERE section = 'service_business-valuation' AND key = 'full_description';

-- service_financial-due-diligence.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'reconciling the trial balance to the audited statements — we surface',
  'reconciling the trial balance to the audited statements. We surface'
)
WHERE section = 'service_financial-due-diligence' AND key = 'full_description';

-- service_transaction-advisory.full_description (two em dashes in this row)
UPDATE cms_content
SET value = REPLACE(
  value,
  'We sit on the deal team — not adjacent to it — and own',
  'We sit on the deal team, not adjacent to it, and own'
)
WHERE section = 'service_transaction-advisory' AND key = 'full_description';

-- service_transaction-advisory.timeline_text (em dash; en dash in "3-9 months" preserved)
UPDATE cms_content
SET value = REPLACE(
  value,
  'Engagement length tracks the deal — typically',
  'Engagement length tracks the deal: typically'
)
WHERE section = 'service_transaction-advisory' AND key = 'timeline_text';

-- service_transaction-advisory.target_audience_text
UPDATE cms_content
SET value = REPLACE(
  value,
  'embedded in the deal — not a vendor running a process',
  'embedded in the deal, not a vendor running a process'
)
WHERE section = 'service_transaction-advisory' AND key = 'target_audience_text';

-- service_mergers-acquisitions.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'well-prepared processes — not auctions optimised for headline volume.',
  'well-prepared processes, not auctions optimised for headline volume.'
)
WHERE section = 'service_mergers-acquisitions' AND key = 'full_description';

-- service_project-finance.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'lender-modelling standards from day one — not converted from a corporate template.',
  'lender-modelling standards from day one, not converted from a corporate template.'
)
WHERE section = 'service_project-finance' AND key = 'full_description';

-- service_investment-memorandums.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'people who have been on the receiving end — we know what gets read,',
  'people who have been on the receiving end. We know what gets read,'
)
WHERE section = 'service_investment-memorandums' AND key = 'full_description';

-- service_cfo-advisory.full_description
UPDATE cms_content
SET value = REPLACE(
  value,
  'the cadence the business actually needs — not a templated weekly checklist.',
  'the cadence the business actually needs, not a templated weekly checklist.'
)
WHERE section = 'service_cfo-advisory' AND key = 'full_description';

-- ---------------------------------------------------------------------------
-- 4. page_sections (page_slug='home'): per-section targeted JSONB rewrites.
--    Casts content to text, runs REPLACE, casts back to jsonb. Each WHERE
--    matches a unique fragment so we only update the intended row.
-- ---------------------------------------------------------------------------

-- 20 founder_block.bio_html (em dash inside HTML)
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'advisory work directly — drawing on twelve years',
  'advisory work directly, drawing on twelve years'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'founder_block'
  AND display_order = 20;

-- 40 service_cards "What we do": intro + cards 01, 04, 06
UPDATE page_sections
SET content = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        content::text,
        'the moments that matter most — capital raises,',
        'the moments that matter most: capital raises,'
      ),
      'project finance models — IRR, DSCR, debt sizing, and debt sculpting',
      'project finance models. IRR, DSCR, debt sizing, and debt sculpting'
    ),
    'Mixed-use development modeling — phased construction,',
    'Mixed-use development modeling: phased construction,'
  ),
  'business plans, and information memorandums — the documentation capital actually closes on.',
  'business plans, and information memorandums. The documentation capital actually closes on.'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'service_cards'
  AND display_order = 40;

-- 50 service_cards "Who we serve": Investment Offices description
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'and due diligence support — supplementing in-house teams',
  'and due diligence support, supplementing in-house teams'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'service_cards'
  AND display_order = 50;

-- 60 process_steps: Understand + Advise descriptions
UPDATE page_sections
SET content = REPLACE(
  REPLACE(
    content::text,
    'the audience the output must convince — board, lender, sponsor, or investor.',
    'the audience the output must convince: board, lender, sponsor, or investor.'
  ),
  'capital-raising or transaction support — through to close.',
  'capital-raising or transaction support, through to close.'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'process_steps'
  AND display_order = 60;

-- 70 text_image: body_html
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'a senior bench with regional presence — without the overhead of a tier-one firm.',
  'a senior bench with regional presence, without the overhead of a tier-one firm.'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'text_image'
  AND display_order = 70;

-- 80 quote: quote_text
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'A good financial model is not just a calculation — it''s a communication tool.',
  'A good financial model is not just a calculation. It''s a communication tool.'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'quote'
  AND display_order = 80;

-- 90 cta_block: subhead
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'or preparing for an exit — we''d be glad to have a conversation.',
  'or preparing for an exit, we''d be glad to have a conversation.'
)::jsonb
WHERE page_slug = 'home'
  AND section_type = 'cta_block'
  AND display_order = 90;

-- ---------------------------------------------------------------------------
-- 5. page_sections rows tagged styles.smoke = 'phase6' (the Phase 6 smoke
--    seed that became starter content for /approach, /sectors, /about,
--    /financial-modeler-pro, /service-business-valuation).
-- ---------------------------------------------------------------------------

-- approach/process_steps "Advise" description
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'negotiation support — not just a deliverable, an opinion.',
  'negotiation support. Not just a deliverable, an opinion.'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'approach' AND section_type = 'process_steps';

-- sectors/sector_grid Data centers description
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'Hyperscale and enterprise builds — power, cooling, fit-out, and tenancy underwriting.',
  'Hyperscale and enterprise builds: power, cooling, fit-out, and tenancy underwriting.'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'sectors' AND section_type = 'sector_grid';

-- about/founder_block bio_html (two em dashes wrapping a parenthetical)
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'For the full professional bio — including platforms, prior firms, and selected mandates — see his page on Financial Modeler Pro.',
  'For the full professional bio (including platforms, prior firms, and selected mandates), see his page on Financial Modeler Pro.'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'about' AND section_type = 'founder_block';

-- about/text_image body_html
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'fewer, deeper mandates — and clients who come back.',
  'fewer, deeper mandates, and clients who come back.'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'about' AND section_type = 'text_image';

-- financial-modeler-pro/fmp_intro description_html
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'flagship platform — a learning environment, model library, and analyst toolkit',
  'flagship platform: a learning environment, model library, and analyst toolkit'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'financial-modeler-pro' AND section_type = 'fmp_intro';

-- service-business-valuation/service_detail full_description_html
UPDATE page_sections
SET content = REPLACE(
  content::text,
  'comparable transactions and trading multiples — and explains, in writing,',
  'comparable transactions and trading multiples, and explains, in writing,'
)::jsonb
WHERE styles->>'smoke' = 'phase6' AND page_slug = 'service-business-valuation' AND section_type = 'service_detail';

-- Bump cms_pages.updated_at for any pages whose meta_title changed.
UPDATE cms_pages SET updated_at = NOW() WHERE meta_title LIKE '% | PaceMakers Business Consultants';

COMMIT;
