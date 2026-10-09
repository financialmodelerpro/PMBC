-- 098_team_kaleem_farooq.sql
--
-- Adds Kaleem Farooq (Business Development, Saudi Arabia) to the team:
--   1. His profile page at /about/kaleem-farooq: a cms_pages row and six
--      page-builder sections, the same section types /about/ahmad-din uses.
--        10  founder_hero          name, role, location, two-paragraph intro
--        20  founder_credentials   Sector focus         (display: numbered)
--        30  paragraphs            Career highlights
--        40  founder_credentials   Areas of expertise   (display: pills)
--        50  paragraphs            His role at PaceMakers
--        60  quote                 his quote
--   2. His card in team_members at display_order 1, second after the founding
--      partner (who leads /team regardless of order).
--
-- Content is the owner's copy, with "PMBC" replaced by "PaceMakers" on the
-- owner's instruction of 2026-10-10 (the standing rule keeps "PMBC" out of public copy).
--
-- Left empty on purpose, to be set later in the admin: the portrait (hero
-- photo_url in the page builder, card photo in /admin/team; both render a
-- monogram until set), the email column, and the hero CTAs.
--
-- DML only, no DDL, so `node scripts/seed-kaleem-farooq.mjs` applies it through
-- supabase-js. This file is the record; the script is the executable, and the
-- copy lives in full there. Same pairing as 034 and 059.
--
-- SAFE ON RE-RUN, and never destructive: every insert is guarded and nothing is
-- updated or deleted, so a re-run cannot overwrite wording edited in the admin.
--
-- SAFE TO APPLY: before or after the deploy that ships the route. Before it,
-- /team shows his card with no profile link (the link is drawn only from code in
-- that deploy) and /about/kaleem-farooq 404s, linked from nowhere. After it, the
-- card links through and the page renders. Applied before the deploy so the
-- sitemap entry never points at a 404.

BEGIN;

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
SELECT
  'about-kaleem-farooq',
  'Kaleem Farooq',
  'Kaleem Farooq | Business Development, Saudi Arabia | PaceMakers',
  'Kaleem Farooq leads business development for PaceMakers Business Consultants in Saudi Arabia. Finance and commercial leader with 12+ years in the Kingdom across technology, SaaS, construction, government projects and fintech.',
  'published',
  true
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE slug = 'about-kaleem-farooq');

-- The six sections are inserted only when the page has none. Their full content
-- (JSONB) is in scripts/seed-kaleem-farooq.mjs, SECTIONS, and is not repeated
-- here so the two cannot drift.

INSERT INTO team_members (name, role, credentials, bio, photo, display_order, visible)
SELECT
  'Kaleem Farooq',
  'Business Development, Saudi Arabia',
  'Riyadh, KSA',
  '<p>Finance and commercial leader with 12+ years in Saudi Arabia across technology, SaaS, construction, government projects and fintech. Kaleem leads business development for PaceMakers in the Kingdom, connecting founders, CFOs and investors with the firm''s advisory practice.</p>',
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE lower(trim(name)) = 'kaleem farooq'
);

COMMIT;
