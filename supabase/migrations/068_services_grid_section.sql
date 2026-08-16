-- 068_services_grid_section.sql
-- The /services card grid becomes a section, so the builder order is the page
-- order.
--
-- The grid was written into `src/app/(public)/services/page.tsx` and rendered
-- after `<SectionList>`, which meant it came last on the page no matter what
-- the page builder showed. An operator who added a closing `cta_block` and
-- dragged it below the grid got it above the grid, with no way to tell from the
-- admin why. The section list was not the page order, it was the page order
-- minus one block that was not in it.
--
-- The grid is now a `service_grid` section. Its place in the page is its row in
-- the builder, and it can be dragged like anything else.
--
-- Position. The page currently holds hero (10), media (20) and cta_block (30),
-- and renders hero, media, cta, grid. This seeds the grid at 25, which puts it
-- between the video and the closing call to action: the order the operator was
-- reaching for when they placed the cta_block last. **That is a deliberate
-- change to the live page**, not a like-for-like move, and it is the change the
-- bug report asked for.
--
-- One consequence worth stating. The bands re-phase, because the alternation is
-- computed over the section list. Before: navy hero, cream video, white cta,
-- then a hardcoded white grid, so two white bands touched. After: navy, cream,
-- white grid, cream cta. The rhythm is correct for the first time on this page,
-- and `scripts/verify-page-rhythm.mjs` asserts it.
--
-- The cards themselves are not seeded into the section. They come from the
-- managed `services` collection, falling back to `src/config/services.ts`,
-- because the same nine feed each detail page's related-services cards, the
-- contact form's dropdown, the sitemap and the JSON-LD. What the section owns
-- is the copy above them, carried across at the wording the route file held.
--
-- DML only, so `node scripts/seed-services-grid-section.mjs` applies it through
-- supabase-js.
--
-- Idempotent: guarded on the section not already existing, so a re-run cannot
-- add a second grid or overwrite copy edited in the builder since.

BEGIN;

INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'services',
  'service_grid',
  jsonb_build_object(
    'eyebrow', 'Practice Areas',
    'heading', 'Nine disciplines, one standard of work',
    'intro',   'Each engagement is led directly by the partner, modelled to institutional standards, and delivered with the documentation a board, lender, or investor will accept without rework.'
  ),
  '{}'::jsonb,
  25,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'services' AND section_type = 'service_grid'
);

COMMIT;
