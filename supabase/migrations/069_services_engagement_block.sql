-- 069_services_engagement_block.sql
-- How an engagement runs, on /services, between the nine cards and the closing
-- call to action.
--
-- The page said what the firm does and then asked for the enquiry. What it did
-- not say is how the work is actually run, which is the question a prospective
-- client has between reading the list and deciding to write. This block answers
-- it in four claims: who scopes the mandate, how the model is built, where the
-- documents come from, and what happens to the model after delivery.
--
-- Section type. `paragraphs`, which is eyebrow, heading and prose at a readable
-- measure, and is what this block is. The alternatives were each wrong in a
-- specific way: `prose_checklist` would have left an empty 45% column beside
-- the text, `process_steps` would have forced four sentences of prose into four
-- numbered steps they were not written as, `text_image` needs an image and
-- draws an empty gold frame without one, and `cta_block` is a call to action on
-- a page that already ends with one.
--
-- `paragraphs` had no eyebrow field until now. One was added in the same change
-- as this migration, on the same contract as the optional heading before it: a
-- section without the key renders exactly as it did, and `SectionIntro` has
-- always accepted an eyebrow. That is a smaller change than a new section type
-- whose only difference from this one would be a label above the heading.
--
-- Position. display_order 27, between the card grid at 25 and the closing call
-- to action at 30.
--
-- The banding follows on its own, because the alternation is computed over the
-- section list rather than stored per section: navy hero, cream video, white
-- grid, cream engagement block, white call to action. The block inserts itself
-- into the rhythm and flips the call to action from cream to white, which is
-- still a correct alternation and is asserted by
-- `scripts/verify-page-rhythm.mjs`.
--
-- Copy is seeded here rather than written into a component so it stays editable
-- in the page builder, like every other string on this page since migration
-- 068.
--
-- DML only, so `node scripts/seed-services-engagement-block.mjs` applies it
-- through supabase-js.
--
-- Idempotent: guarded on no `paragraphs` section already existing on this page,
-- so a re-run cannot add a second copy or overwrite wording edited since.

BEGIN;

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'services',
  'paragraphs',
  jsonb_build_object(
    'eyebrow', 'HOW AN ENGAGEMENT RUNS',
    'heading', 'Scoped by the partner who delivers it.',
    'align',   'left',
    'html',    '<p>Every mandate is scoped by the partner who will do the work, so nothing is handed to a different team afterwards. The model is built with you and revised as assumptions change, rather than delivered once and defended. Every document is generated from the approved model rather than rekeyed, so the numbers cannot drift. And the model stays live through the transaction, updated as diligence findings land and lender terms firm up.</p>'
  ),
  '{}'::jsonb,
  27,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'services' AND section_type = 'paragraphs'
);

COMMIT;
