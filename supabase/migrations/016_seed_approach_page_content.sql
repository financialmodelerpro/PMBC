-- 016_seed_approach_page_content.sql
-- Phase 9 — Approach page real content. Replaces all existing page_sections rows
-- for page_slug='approach' (the Phase 6 smoke process_steps + quote + cta_block)
-- with the production 5-section flow:
--   10  hero
--   20  process_steps  (Understand / Analyse / Model / Advise, in depth)
--   30  text_image     (What stays constant — senior judgment, no black boxes)
--   40  quote          (Engagement principle)
--   50  cta_block
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
-- "Analyse" uses the British spelling used for the canonical methodology
-- throughout the repo.
--
-- Mirrors scripts/seed-approach-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'approach';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('approach', 'hero', '{
  "badge_text": "OUR APPROACH",
  "headline": "How we engage.",
  "subtitle": "Understand. Analyse. Model. Advise. Senior-led from the first call to the final recommendation, with no black-box deliverables and no junior pass-throughs.",
  "cta_label": "Start a Conversation",
  "cta_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  process_steps
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('approach', 'process_steps', '{
  "eyebrow": "THE ENGAGEMENT MODEL",
  "heading": "A four-step model, built around the decision you are making.",
  "intro": "The same discipline applies whether the mandate is a valuation, a development model, or a full transaction. The output changes; the rigor does not.",
  "steps": [
    {
      "number": "01",
      "title": "Understand",
      "description": "We begin with the decision the work must support and the audience it must convince: a board, a lender, a sponsor, or an investment committee. The mandate is scoped around that, not around a template."
    },
    {
      "number": "02",
      "title": "Analyse",
      "description": "Commercial diligence, sector benchmarking, and a structural review of the transaction. We interrogate the inputs before we build, because a precise model on the wrong assumptions is just confident error."
    },
    {
      "number": "03",
      "title": "Model",
      "description": "Lender-grade construction. Every assumption visible and sourced, every output traceable to its driver, every line defensible under scrutiny. No black boxes, no hidden plugs."
    },
    {
      "number": "04",
      "title": "Advise",
      "description": "Clear recommendations, structuring options, and the capital-raising or transaction support to act on them, through to close. You get judgment, not just a file."
    }
  ]
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  text_image
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('approach', 'text_image', '{
  "eyebrow": "WHAT STAYS CONSTANT",
  "heading": "Senior judgment, start to finish.",
  "body_html": "<p>Every engagement is led personally by the partner who scoped it. There are no junior pass-throughs and no black-box deliverables you cannot interrogate. If a number moves, you will know which assumption moved it.</p><p>Three things hold across every mandate: the model is built to be read, not just run; the assumptions are honest about risk, not tuned to flatter; and the advice is the advice we would act on with our own capital.</p>",
  "image_url": "",
  "image_alt": "PaceMakers engagement principles",
  "image_caption": "",
  "image_position": "left",
  "cta_label": "View our services",
  "cta_href": "/services"
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  quote
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('approach', 'quote', '{
  "quote_text": "We would rather tell you a deal does not work than hand you a model that says it does. Credibility is the only asset we cannot rebuild.",
  "attribution_name": "Ahmad Din",
  "attribution_role": "Founder, PaceMakers Business Consultants",
  "attribution_photo_url": "",
  "alignment": "center"
}'::jsonb, '{}'::jsonb, 40, true);

-- 50  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('approach', 'cta_block', '{
  "headline": "Ready to put the approach to work?",
  "subhead": "Bring us the mandate. We will walk you through exactly how we would scope, model, and advise on it before you commit to anything.",
  "cta_primary_label": "Start a Conversation",
  "cta_primary_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 50, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'approach';

COMMIT;
