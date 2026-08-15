-- 059_team_page.sql
--
-- Puts /team into the site.
--
-- The route, the `team_members` table (023), the admin editor and the sitemap
-- entry have all existed since Phase 10. What was missing was any content, and
-- any way for a reader to reach the page. This migration supplies the first and
-- opens the second, in three parts:
--
--   1. The founding partner's card, derived from the founder profile.
--   2. The footer's Team link, turned on.
--   3. A Pages & Nav row for /team, placed just before Contact.
--
-- DML only, no DDL, so `node scripts/seed-team-page.mjs` applies it through
-- supabase-js. This file is the record; the script is the executable. Same
-- pairing as migrations 014 to 020 and 038 onwards.
--
-- SAFE ON RE-RUN. Unlike 034, 048 and 049, nothing here deletes. Each of the
-- three parts is guarded and skips work already done: the card is inserted only
-- when no member of that name exists, the footer link is only flipped on, and
-- the nav row is only added when absent. Re-running will not overwrite a card an
-- operator has since edited, will not duplicate the nav row, and will not undo a
-- link an operator has deliberately hidden again.
--
-- WHY THE CARD IS DERIVED RATHER THAN TYPED
-- Every field on it except the role already exists on the founder_hero section
-- of /about/ahmad-din, seeded by 034 and edited in the page builder since.
-- Typing those strings a second time creates two copies of one fact, and the
-- copy nobody is looking at is the one that goes stale. So the INSERT below is
-- an INSERT ... SELECT over `page_sections`, reading whatever that section holds
-- at the moment it runs. That also means it picks up the portrait, which 034
-- seeded empty on purpose and which has been uploaded since.
--
-- The one field that is not derived is the role, set to 'Founding Partner'.
-- There is no equivalent string on the profile: its `title_primary` is
-- 'Corporate Finance and Transaction Advisory Specialist', which describes the
-- practitioner rather than his standing in the firm. A team page is about the
-- second. It is a normal editable field afterwards, like every other.
--
-- The bio is taken from the hero's `intro`, which is the short paragraph, not
-- the full Background prose further down that page. That is the point of the
-- card: it carries enough to place the person and links through for the rest.
--
-- WHY THE VISIBILITY OF THIS PAGE IS NOT AN OPERATOR SWITCH
-- The footer link ships visible and the nav row ships visible, but /team is
-- withheld from both while `team_members` has no published row. That gate lives
-- in src/lib/public/collectionGates.ts and mirrors what the sitemap has done
-- since 2026-08-13: whether a page has content is a fact about the data, so it
-- is read from the data. Hiding a link by hand and remembering to unhide it is
-- the step this repository has already had to undo twice.
--
-- Both switches still work and still win. The gate can only take a link away.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The founding partner's card.
-- ---------------------------------------------------------------------------
-- Guarded on the name rather than on the table being empty, so this stays
-- correct if other members were added first.
INSERT INTO team_members (name, role, credentials, bio, photo, display_order, visible)
SELECT
  ps.content->>'name',
  'Founding Partner',
  NULLIF(ps.content->>'credentials_line', ''),
  -- `intro` is stored as plain text on the hero and rendered as rich text on the
  -- card, so it is wrapped in a paragraph. Without this the sanitiser emits a
  -- bare text node and `.pmbc-prose p` never applies, which loses the spacing.
  CASE
    WHEN COALESCE(ps.content->>'intro', '') = '' THEN NULL
    ELSE '<p>' || (ps.content->>'intro') || '</p>'
  END,
  NULLIF(ps.content->>'photo_url', ''),
  0,
  true
FROM page_sections ps
WHERE ps.page_slug = 'about-ahmad-din'
  AND ps.section_type = 'founder_hero'
  AND COALESCE(ps.content->>'name', '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE lower(btrim(tm.name)) = lower(btrim(ps.content->>'name'))
  )
LIMIT 1;

-- ---------------------------------------------------------------------------
-- 2. The footer's Team link.
-- ---------------------------------------------------------------------------
-- 054 seeded this entry with visible=false, because the collection was empty and
-- a link onto an empty state is a weaker impression than no link. The gate now
-- makes that decision on the data, so the stored value goes to true and stops
-- being a thing anyone has to remember.
--
-- Rebuilt with ordinality so the array keeps its stored order. Case Studies and
-- Insights are untouched and stay hidden: both are still empty and neither is
-- gated, so their links remain a deliberate operator choice.
UPDATE cms_content
SET
  value = (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'id' = 'team' THEN jsonb_set(elem, '{visible}', 'true'::jsonb)
        ELSE elem
      END
      ORDER BY ord
    )::text
    FROM jsonb_array_elements(cms_content.value::jsonb) WITH ORDINALITY AS t(elem, ord)
  ),
  updated_at = NOW()
WHERE section = 'footer_settings'
  AND key = 'links'
  AND COALESCE(value, '') <> ''
  AND value::jsonb @> '[{"id": "team"}]'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. The navbar row.
-- ---------------------------------------------------------------------------
-- Placed one step ahead of Contact, which is the last item in the menu, so the
-- order reads Services, Sectors, Network, Financial Modeler Pro, Team, Contact.
-- Taking Contact's slot minus one avoids renumbering every row after it, which
-- would be several writes to achieve the same reading order.
--
-- `can_toggle` is left at its default of true (migration 033), so this row can
-- be hidden in Pages & Nav like any other. It is not pinned: /team is a page the
-- firm may reasonably decide not to advertise, unlike /contact.
INSERT INTO site_pages (label, href, display_order, visible)
SELECT
  'Team',
  '/team',
  COALESCE(
    (SELECT display_order - 1 FROM site_pages WHERE href = '/contact' LIMIT 1),
    (SELECT COALESCE(MAX(display_order), 0) + 10 FROM site_pages)
  ),
  true
WHERE NOT EXISTS (SELECT 1 FROM site_pages WHERE href = '/team');

COMMIT;
