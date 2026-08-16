-- 071_team_meta_description.sql
-- The /team meta description stops contradicting the page it describes.
--
-- It read "The people behind PaceMakers. Senior practitioners who lead every
-- mandate directly." That is plural where the rest of the site is singular: the
-- hero on the same page says "Every mandate is partner-led", /approach says
-- "Every mandate is won and led by the partner", and Critical Reminder 3b makes
-- the point that there is one partner and no permanent pyramid. A description
-- promising "practitioners who lead every mandate" is the claim the firm
-- deliberately does not make, and it is the version a search result shows.
--
-- It now matches the hero it sits above.
--
-- This was carried across unchanged by migration 070, which seeded the three
-- collection pages at their existing wording on the instruction to move rather
-- than rewrite. It was flagged at the time as the one line worth revisiting.
--
-- Note that this field is editable in the page builder from 2026-08-16, under
-- "Page details and search listing", so a future change to it needs no
-- migration at all. This one exists because the row was seeded wrong.
--
-- DML only, so `node scripts/seed-team-meta-description.mjs` applies it.
--
-- Idempotent, and guarded on the old wording, so an edit made in the admin
-- since outranks a re-run.

BEGIN;

UPDATE cms_pages
SET meta_description = 'The people behind PaceMakers. Every mandate is partner-led, supported by a focused analytical bench.',
    updated_at = NOW()
WHERE slug = 'team'
  AND meta_description = 'The people behind PaceMakers. Senior practitioners who lead every mandate directly.';

COMMIT;
