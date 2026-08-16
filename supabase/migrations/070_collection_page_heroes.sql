-- 070_collection_page_heroes.sql
-- /team, /case-studies and /insights get CMS pages, so their heroes are edited
-- in the page builder like every other page's.
--
-- These three were the last routes whose opening copy lived only in a .tsx
-- file. Each rendered `PageHeroFallback` with three hardcoded strings, and each
-- had no `cms_pages` row at all, so they did not even appear in the page list:
-- there was nothing to open a builder onto. Changing an eyebrow meant a deploy.
--
-- Each gets a `cms_pages` row and one `hero` section carrying the eyebrow,
-- headline and subtitle it already showed.
--
-- The collections are untouched. The team cards still come from `team_members`,
-- the case study cards from `case_studies`, the articles from `articles`. Only
-- the page copy moves, which is the whole scope of this migration.
--
-- The code fallback stays. Each route now renders through `FirmPageBody`, which
-- shows `PageHeroFallback` when the page has no hero section and the CMS
-- sections when it does. A database that has not run this migration renders the
-- same page it renders today, which is the same guarantee the five firm pages
-- have had since Phase 7.
--
-- `hero` is visually identical to `PageHeroFallback` given the same three
-- strings: same 70vh frame, same gold hairline, same type scale, same scroll
-- chevron. That was checked rather than assumed, and it is why no new section
-- type was needed here.
--
-- The rows are marked is_system, like the other seventeen live routes. These
-- are real pages, and the admin delete button must not be able to remove the
-- row that supplies their metadata.
--
-- Two wording fixes on the team page, both requested and both alignments rather
-- than rewrites:
--
--   1. The hero said "Every mandate is led directly by a partner". The rest of
--      the site says partner-led: "Every mandate is won and led by the partner"
--      on /approach, "Every mandate at PaceMakers is partner-led" on /contact.
--      Critical Reminder 3b is the standing rule.
--
--   2. Ahmad's card said "across KSA and Pakistan". His own bio on home says
--      "across Saudi Arabia, the GCC, and Pakistan", which is both the fuller
--      truth and the phrasing the firm leads with (Critical Reminder 5: lead
--      with KSA and GCC). The card now matches.
--
-- Everything else is carried across at the wording it already had.
--
-- DML only, so `node scripts/seed-collection-page-heroes.mjs` applies it through
-- supabase-js.
--
-- Idempotent: pages and sections are inserted only when absent, and the bio
-- update is guarded on the old phrasing, so a re-run cannot overwrite an edit
-- made in the admin since.

BEGIN;

-- 1. The three page rows. Meta title and description carry the values the
--    routes held as `buildPageMetadata` fallbacks, so nothing changes and both
--    become editable.
INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
VALUES
  (
    'team',
    'Team',
    'Team | PaceMakers Business Consultants',
    'The people behind PaceMakers. Senior practitioners who lead every mandate directly.',
    'published',
    true
  ),
  (
    'case-studies',
    'Case Studies',
    'Case Studies | PaceMakers Business Consultants',
    'Selected engagements across sectors. Anonymized where client confidentiality requires.',
    'published',
    true
  ),
  (
    'insights',
    'Insights',
    'Insights | PaceMakers Business Consultants',
    'Perspectives on valuation, transactions, and corporate finance from the PaceMakers team.',
    'published',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- 2. One hero each, at the head of the page. Guarded on the page having no
--    sections at all rather than on the hero specifically, so an operator who
--    deleted it on purpose does not get it silently reinstated.
--
--    `subtitle` is stored as HTML because the hero renderer passes it through
--    RichText, the same as every other hero on the site.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  v.slug,
  'hero',
  jsonb_build_object(
    'badge_text', v.eyebrow,
    'headline',   v.headline,
    'subtitle',   '<p>' || v.tagline || '</p>',
    'tags',       '[]'::jsonb,
    'cta_label',  '',
    'cta_href',   '',
    'cta_secondary_label', '',
    'cta_secondary_href',  ''
  ),
  '{}'::jsonb,
  10,
  true
FROM (VALUES
  (
    'team',
    'Team',
    'The people behind the work',
    'PaceMakers is senior by design. Every mandate is partner-led, supported by a focused analytical bench.'
  ),
  (
    'case-studies',
    'Case Studies',
    'Proof of work, discreetly told',
    'Selected engagements across the sectors we serve. Some are anonymized where client confidentiality requires.'
  ),
  (
    'insights',
    'Insights',
    'Perspectives on the work',
    'Notes on valuation, transactions, and corporate finance from the people doing the modelling.'
  )
) AS v(slug, eyebrow, headline, tagline)
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = v.slug
);

-- 3. Ahmad's team card. Guarded on the old phrasing, so an edit made in the
--    admin since outranks this.
UPDATE team_members
SET bio = REPLACE(
      bio,
      'across KSA and Pakistan',
      'across Saudi Arabia, the GCC, and Pakistan'
    ),
    updated_at = NOW()
WHERE bio LIKE '%across KSA and Pakistan%';

COMMIT;
