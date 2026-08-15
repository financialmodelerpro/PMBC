-- 063_fmp_page_pass.sql
--
-- A content pass over /fmp, from reading the page as a prospect rather than
-- section by section in the builder.
--
--   1. The intro said the Modeling Hub was launching soon. Its own card two
--      sections later said Live now.
--   2. The intro was four paragraphs of platform marketing before anything
--      PMBC-specific, and never answered the question a prospect actually has.
--   3. "What you get" had lost two of its six items and one title read as a
--      half-finished edit.
--   4. The hero pointed at the platform and at the firm at the same time.
--   5. The certification section restated the Training Hub card above it.
--
-- DML only, no DDL, so `node scripts/seed-fmp-page-pass.mjs` applies it through
-- supabase-js. This file is the record; the script is the executable.
--
-- NOT SAFE ON RE-RUN in one respect: it deletes the certification section. The
-- full removed content is recorded below so it can be put back by hand. Every
-- other statement is an UPDATE against a known key and merely restores this
-- wording over anything edited since.
--
-- ---------------------------------------------------------------------------
-- 1 and 2. The intro
-- ---------------------------------------------------------------------------
-- It ran four paragraphs and was FMP's own product copy: "professional-grade",
-- "institutional-grade", "investor-ready", "gives you both the knowledge and
-- the tools in one place". Nothing in it was untrue and nothing in it was
-- PaceMakers speaking. A reader on a corporate finance firm's website, looking
-- at a page about a software platform, has one question, and the page did not
-- answer it until the very last block: why does an advisory firm carry a
-- platform at all, and what does it mean for me.
--
-- The closing block answered it well, that you start on the platform and come
-- to the firm when it stops being a modeling question, but a reader only got
-- there after the whole page. That answer now opens the section instead, in its
-- own words rather than the closing block's, so the two do not become the
-- home page's founder-card problem in a different place. The closing block
-- keeps the offer and gives up the rationale.
--
-- The status contradiction goes with it. The card says "Live now" in its meta
-- and "Real Estate Financial Modeling is live now, with business valuation and
-- equity research in build" in its description, and the closing block says the
-- Modeling Hub is open. The intro said "launching soon". The card is right, so
-- the intro now says what the card says.
--
-- Four paragraphs down to two.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'html',
    '<p style="text-align: justify;">Financial Modeler Pro is the platform arm of PaceMakers. A Training Hub certifies the modeling method free of charge, and a Modeling Hub runs it: Real Estate Financial Modeling is live now, with business valuation and equity research in build.</p>'
    '<p style="text-align: justify;">An advisory firm carrying a software platform needs explaining. Much of what a client first asks for is a modeling question, and a modeling question is better answered by a tool than by an engagement letter. The platform answers those, at no cost and without a conversation. What it cannot answer is the judgment underneath: which structure to take to a lender, what a business is worth to this buyer rather than to any buyer, whether a term sheet is worth signing. That is the firm&rsquo;s work.</p>',
-- ---------------------------------------------------------------------------
-- 3. "What you get", restored to six
-- ---------------------------------------------------------------------------
-- Migration 049 seeded six items. The page was edited live in the builder on
-- 2026-08-11 and came out of it with four: "Monthly or annual periods" and
-- "Free certification" were gone, and the export item's title had been changed
-- from "Formula-linked Excel and investor PDF export" to "Structured Excel and
-- investor PDF export" while its description was rewritten around the word
-- "structured" too. That reads as an edit interrupted partway.
--
-- "Formula-linked" is also the accurate claim and the one the rest of the page
-- makes: the Modeling Hub card's own note says the workbook exports
-- formula-linked. "Structured" said less and disagreed with the card. The title
-- goes back, and the description keeps the better half of each version: the
-- formulas-intact claim from the original, the traceability wording from the
-- edit.
--
-- "Free certification" returns even though migration 063 also cuts the
-- certification section. A one-line item in a summary list ahead of the cards is
-- not the same as a whole section restating a card that has already made the
-- point in six bullets.
  'items', jsonb_build_array(
    jsonb_build_object('title', 'Multi-discipline modeling', 'description', 'Real estate development, business valuation, project finance, FP&A and corporate finance, each with its own workflow rather than one generic template.'),
    jsonb_build_object('title', 'Structured workflows', 'description', 'A model is built module by module in a fixed order, so nothing is left undefined and no assumption is buried in a cell nobody opens.'),
    jsonb_build_object('title', 'Monthly or annual periods', 'description', 'Choose the periodicity the transaction actually needs. Monthly for construction draws and cash sweeps, annual for long-horizon valuation.'),
    jsonb_build_object('title', 'Formula-linked Excel and investor PDF export', 'description', 'The workbook exports with its formulas intact rather than as pasted values, so every figure shows the basis it was calculated on, alongside a clean PDF report ready to circulate.'),
    jsonb_build_object('title', 'Free certification', 'description', 'Both certification paths are free, with no subscription and no paywall, and the certificate carries a unique ID that anyone can verify.'),
    jsonb_build_object('title', 'Built by a practitioner, not a software company', 'description', 'Every module reflects how a deal was actually structured. When a live mandate exposes a structure the tools handle badly, the tools change.')
  )
),
updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro' AND section_type = 'prose_checklist' AND display_order = 20;

-- ---------------------------------------------------------------------------
-- 4. The hero asks once
-- ---------------------------------------------------------------------------
-- It offered "Visit Financial Modeler Pro" and "Speak to the firm" side by side,
-- which is the reader's first decision on the page and points them in opposite
-- directions before they know what either means. The platform link stays, since
-- this is the platform's page and the closing block is where the firm asks.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'cta_secondary_label', '',
  'cta_secondary_href', ''
),
updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro' AND section_type = 'hero' AND display_order = 10;

-- ---------------------------------------------------------------------------
-- 5. Certification folded into the card that already made the point
-- ---------------------------------------------------------------------------
-- The section at display_order 50 said: certification is free, no subscription,
-- no paywall, assessed rather than attendance-based, certificate with a unique
-- ID an employer can verify online. The Training Hub card immediately above it
-- says all of that in its bullets ("No fees, no subscription and no paywall on
-- any course or certificate", "A verified certificate with a unique ID, QR code
-- and a permanent verification link") and in its note ("Employers and
-- institutions can verify any certificate online at any time"), and carries the
-- same CTA to the same page.
--
-- One phrase was doing work the card was not: "assessed rather than
-- attendance-based". The card describes the assessment mechanics without ever
-- making the positioning claim that follows from them. It folds into the card's
-- opening line, and the section goes.
--
-- The removed section, for the record:
--   eyebrow           CERTIFICATION
--   headline          Free professional certification.
--   subhead           Financial Modeler Pro runs its certification courses free,
--                     with no subscription and no paywall. Each path is assessed
--                     rather than attendance-based, and ends in a certificate
--                     carrying a unique ID that an employer or an institution
--                     can verify online.
--   cta_primary       Browse Free Courses -> https://app.financialmodelerpro.com/training
UPDATE page_sections
SET content = jsonb_set(
  content,
  '{cards,1,description}',
  to_jsonb('The method, taught and assessed rather than merely attended. Video sessions build the model with you, each one ending in a quiz you have to pass before the next unlocks, and the path finishes with a certification exam. Free, and it stays free.'::text)
),
updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro' AND section_type = 'feature_cards' AND display_order = 40;

DELETE FROM page_sections
WHERE page_slug = 'financial-modeler-pro' AND section_type = 'cta_block' AND display_order = 50;

-- ---------------------------------------------------------------------------
-- The closing block gives up the rationale and keeps the offer
-- ---------------------------------------------------------------------------
-- Its headline was the sentence this pass moved to the top of the page, so
-- leaving it would have traded one repetition for another. It now makes the ask
-- and nothing else, and asks once: the platform is linked from the hero and from
-- both cards already, so the firm is what is left to offer.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'headline', 'Start on the platform. Bring us the rest.',
  'subhead', 'Registration is free and both certification paths cost nothing. A mandate begins where the modeling leaves off.',
  'cta_primary_label', 'Speak to the firm',
  'cta_primary_href', '/contact',
  'cta_secondary_label', '',
  'cta_secondary_href', ''
),
updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro' AND section_type = 'cta_block' AND display_order = 60;
