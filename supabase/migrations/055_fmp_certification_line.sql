-- 055_fmp_certification_line.sql
-- The /fmp certification band stops listing courses.
--
-- WHAT WAS WRONG
-- Migration 049 gave /fmp a `feature_cards` band naming the two certification
-- paths that existed when it was written: 3SFM at 17 sessions and BVM at 6
-- lessons, with six bullets each, a session count, an hour count, a difficulty
-- level and a course link by UUID. Every one of those numbers is a fact about
-- Financial Modeler Pro's catalogue on the day it was read, and PMBC has no way
-- to know when any of them changes. FMP will add courses. The moment it does,
-- this page is stating that there are two paths when there are more, and no
-- edit here would ever be prompted by that: the page would simply be quietly
-- wrong.
--
-- A page that cannot track what it describes should not describe it. What PMBC
-- can state truthfully and permanently is that the certification is free,
-- professional and assessed, and then hand the reader to the catalogue itself.
--
-- WHY AN UPDATE RATHER THAN A DELETE AND AN INSERT
-- The row keeps its id, its display_order, its styles and any media keys, so
-- the band stays exactly where it was in the page order and nothing downstream
-- has to be re-pointed. Only its type and its content change.
--
-- The Training Hub card in the band above already carries the same "Browse Free
-- Courses" destination. That is deliberate rather than a duplicate: this band's
-- job now is to answer "does it cost anything and is it worth anything", and
-- ending it anywhere other than the catalogue would leave that answered and
-- unactionable.
--
-- DML only, so `npm run seed-fmp-certification-line` applies it. Idempotent and
-- guarded on the old value: the update only fires while the band is still the
-- feature_cards version, so a re-run cannot overwrite a later edit.

BEGIN;

UPDATE page_sections
SET section_type = 'cta_block',
    content = jsonb_build_object(
      'eyebrow', 'CERTIFICATION',
      'headline', 'Free professional certification.',
      'subhead', 'Financial Modeler Pro runs its certification courses free, with no subscription and no paywall. Each path is assessed rather than attendance-based, and ends in a certificate carrying a unique ID that an employer or an institution can verify online.',
      'cta_primary_label', 'Browse Free Courses',
      'cta_primary_href', 'https://app.financialmodelerpro.com/training'
    ),
    updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro'
  AND section_type = 'feature_cards'
  AND content->>'eyebrow' = 'CERTIFICATION';

COMMIT;
