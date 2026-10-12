-- 109_team_single_source.sql
--
-- One place for each team member (owner's instruction, 2026-10-12). Team &
-- Advisors becomes the only screen for a person: their details and their full
-- profile page's sections are edited together, and nothing is typed twice.
--
--   team_members.profile_slug   the CMS page that is this member's full
--                                profile (about-<name>, served at /team/<name>).
--                                Replaces matching cards to profiles by name.
--
-- From the deploy that reads this, the profile header takes its name, photo
-- and credentials line from the member record, and its title from the role
-- unless the page sets its own headline. The /team card's highlights are the
-- first three items of the profile list marked "Show on team card"
-- (content key show_on_card).
--
-- Data, for the three members today:
--   1. Link each member to their profile page.
--   2. Clear the header title on Kaleem Farooq's and Muhammad Shahjahan's
--      profiles where it only repeated their role, so the role shows from the
--      member record. The founding partner's headline is his own and stays.
--   3. Mark Shahjahan's "Selected experience" list as the card source.
--   4. Give Kaleem's profile a "Selected experience" list holding the three
--      highlights his card shows today (his experience_items), marked as the
--      card source, placed after the header.
-- The headers' stored name, photo and credentials values are left in place
-- and ignored: nothing is deleted.
--
-- DDL plus DML. HAND-RUN in the Supabase SQL editor by the owner.
--
-- SAFE TO APPLY: right after the deploy that reads profile_slug. Before that
-- deploy, the two cleared titles would show empty and Kaleem's new list would
-- already appear on his profile. After the deploy but before this runs, /team
-- and the profiles render as they do now (matched by name, highlights from
-- the member's own list), and each member's screen in Team & Advisors says
-- the profile becomes editable there once this is applied.
--
-- SAFE ON RE-RUN, never destructive: ADD COLUMN and the index use IF NOT
-- EXISTS, each update matches only rows not yet changed, and Kaleem's list is
-- inserted only while his profile has no list marked for the card.
--
-- Check after applying:
--   SELECT name, profile_slug FROM team_members ORDER BY display_order;
--   SELECT page_slug, display_order, content->>'heading' AS heading,
--          content->'show_on_card' AS on_card
--   FROM page_sections WHERE section_type = 'founder_credentials'
--     AND page_slug IN ('about-kaleem-farooq', 'about-muhammad-shahjahan')
--   ORDER BY page_slug, display_order;

BEGIN;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS profile_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS team_members_profile_slug_key
  ON team_members (profile_slug) WHERE profile_slug IS NOT NULL;

UPDATE team_members SET profile_slug = 'about-ahmad-din'
WHERE lower(trim(name)) = 'ahmad din' AND profile_slug IS NULL;

UPDATE team_members SET profile_slug = 'about-kaleem-farooq'
WHERE lower(trim(name)) = 'kaleem farooq' AND profile_slug IS NULL;

UPDATE team_members SET profile_slug = 'about-muhammad-shahjahan'
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%' AND profile_slug IS NULL;

UPDATE page_sections ps
SET content = jsonb_set(ps.content, '{title_primary}', '""'::jsonb)
FROM team_members tm
WHERE ps.page_slug IN ('about-kaleem-farooq', 'about-muhammad-shahjahan')
  AND ps.section_type = 'founder_hero'
  AND tm.profile_slug = ps.page_slug
  AND trim(ps.content->>'title_primary') = trim(tm.role);

UPDATE page_sections
SET content = content || '{"show_on_card": true}'::jsonb
WHERE page_slug = 'about-muhammad-shahjahan'
  AND section_type = 'founder_credentials'
  AND content->>'heading' = 'Selected experience'
  AND NOT (content ? 'show_on_card');

INSERT INTO page_sections (page_slug, section_type, display_order, visible, styles, content)
SELECT
  'about-kaleem-farooq',
  'founder_credentials',
  15,
  true,
  '{}'::jsonb,
  jsonb_build_object(
    'heading', 'Selected experience',
    'intro', '',
    'display', 'numbered',
    'items', to_jsonb(tm.experience_items),
    'show_on_card', true
  )
FROM team_members tm
WHERE lower(trim(tm.name)) = 'kaleem farooq'
  AND cardinality(tm.experience_items) > 0
  AND NOT EXISTS (
    SELECT 1 FROM page_sections
    WHERE page_slug = 'about-kaleem-farooq'
      AND section_type = 'founder_credentials'
      AND content->'show_on_card' = 'true'::jsonb
  );

COMMIT;
