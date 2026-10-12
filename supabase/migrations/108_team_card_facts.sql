-- 108_team_card_facts.sql
--
-- The small standard team card (owner's instruction, 2026-10-12). Every member
-- other than the founding partner gets the same small card on /team: portrait,
-- name, role, then three facts (qualification, years of experience, location)
-- and up to three key highlights, with everything else on the profile page.
--
--   experience_years  "Experience" on the card, as it should read ("12+ years")
--   location          "Location" on the card
--   credentials       now read as "Qualification" on the card
--
-- Until today the qualifications slot held each member's location, because
-- there was no location column. This moves Kaleem Farooq's and Muhammad
-- Shahjahan's locations into the new column, sets their years from their own
-- approved copy (12+ years, 4+ years) and gives Shahjahan his qualification
-- (ACMA, ICMAP). Kaleem's qualification is left empty: none is recorded, so his
-- card shows no Qualification line until one is entered in /admin/team. The
-- founding partner's row is not touched.
--
-- DDL plus DML. HAND-RUN in the Supabase SQL editor by the owner (supabase-js
-- cannot run DDL). Apply after 107.
--
-- SAFE TO APPLY: right after the deploy that renders the small card. Before
-- that deploy, both cards would lose their location line from under the role
-- (the old card reads only credentials). After the deploy but before this
-- runs, the cards show the location as the qualification line (the old values)
-- with no Experience or Location fact, and the admin saves the other fields
-- normally and skips these two.
--
-- SAFE ON RE-RUN, never destructive: ADD COLUMN IF NOT EXISTS, and each update
-- fires only while a value is still the old one or empty. Nothing is deleted.
--
-- Check after applying:
--   SELECT name, credentials, experience_years, location,
--          cardinality(experience_items) AS highlights
--   FROM team_members ORDER BY display_order;

BEGIN;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS experience_years TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS location TEXT;

UPDATE team_members
SET location = 'Riyadh, KSA'
WHERE lower(trim(name)) = 'kaleem farooq' AND location IS NULL;

UPDATE team_members
SET experience_years = '12+ years'
WHERE lower(trim(name)) = 'kaleem farooq' AND experience_years IS NULL;

UPDATE team_members
SET credentials = NULL
WHERE lower(trim(name)) = 'kaleem farooq' AND credentials = 'Riyadh, KSA';

UPDATE team_members
SET location = 'Lahore, Pakistan'
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%' AND location IS NULL;

UPDATE team_members
SET experience_years = '4+ years'
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%' AND experience_years IS NULL;

UPDATE team_members
SET credentials = 'ACMA (ICMAP)'
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%' AND credentials = 'Lahore, Pakistan';

COMMIT;
