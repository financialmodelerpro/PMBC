-- 101_team_profile_type.sql
-- Compact team profiles (2026-10-11, on the owner's instruction): a team card
-- is either "full" (its member has a detailed profile page, and the card keeps
-- today's treatment with "Read the full profile") or "compact" (no profile
-- page; the card itself carries the short bio, a "Selected experience" list
-- and an "Expertise" list). Ahmad Din and Kaleem Farooq are full; Muhammad
-- Shahjahan, added after this is applied, is the first compact profile.
--
--   profile_type      'full' or 'compact', default 'compact', so a member
--                     added in the admin is compact unless a profile page is
--                     built for them
--   experience_items  "Selected experience", one short line per item
--   expertise_items   "Expertise", one short line per item, shown as pills
--
-- Choosing "full" cannot create a profile page: that still needs a route, a
-- line in pageRoutes.ts and a line in PROFILE_PAGE_SLUGS. A full member with no
-- page renders as a plain card with no profile link.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: before or after the deploy that reads these columns. Before
-- the deploy, the columns are stored and ignored, and /team looks exactly as it
-- does now. After the deploy but before this is applied, the code treats every
-- member with a profile page as full and every other member as a plain card,
-- which is today's /team, and the admin shows the new fields read only with a
-- notice naming this migration.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, the check is dropped before it is
-- added, and the update sets the same value on a re-run. Nothing is deleted.
--
-- Check after applying (expect Ahmad Din full, Kaleem Farooq full):
--   SELECT name, profile_type, experience_items, expertise_items
--   FROM team_members ORDER BY display_order;

BEGIN;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'compact';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS experience_items TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS expertise_items TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_profile_type_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_profile_type_check
  CHECK (profile_type IN ('full', 'compact'));

-- The two members who have a detailed profile page today.
UPDATE team_members SET profile_type = 'full'
WHERE lower(trim(name)) IN ('ahmad din', 'kaleem farooq');

COMMIT;
