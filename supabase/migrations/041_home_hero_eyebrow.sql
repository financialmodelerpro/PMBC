-- 041_home_hero_eyebrow.sql
-- Home hero eyebrow: say something the logo has not already said.
--
-- The eyebrow read "PACEMAKERS BUSINESS CONSULTANTS", directly beneath a navbar
-- carrying the PaceMakers logo and above a headline that is the firm's tagline.
-- Three lines of brand identity in a row, the middle one adding nothing. The
-- replacement names the discipline instead, which is the one thing a referred
-- prospect landing cold cannot infer from the logo:
--
--   CORPORATE FINANCE AND TRANSACTION ADVISORY
--
-- Wording note: spelled "AND" rather than an ampersand, matching how the rest of
-- the site writes it in prose. The value stays fully admin-editable in the page
-- builder; this migration only changes the seeded copy.
--
-- DML only, so `node scripts/seed-home-hero-eyebrow.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive: guarded on the old value, so a re-run after an
-- operator has rewritten the eyebrow leaves their wording alone rather than
-- stamping this one back over it.

BEGIN;

UPDATE page_sections
SET content = content || jsonb_build_object(
      'badge_text', 'CORPORATE FINANCE AND TRANSACTION ADVISORY'
    ),
    updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'hero'
  AND content->>'badge_text' = 'PACEMAKERS BUSINESS CONSULTANTS';

COMMIT;
