-- 099_kaleem_farooq_contact.sql
--
-- Adds Kaleem Farooq's contact details to the hero of his profile page
-- (/about/kaleem-farooq), on the owner's instruction of 2026-10-11:
--   contact_email     kaleem.farooq@pacemakersglobal.com
--   contact_phone     +966 50 110 1421
--   contact_linkedin  https://www.linkedin.com/in/kaleemfarooq/
--
-- The three keys are new optional fields on the founder_hero section type.
-- Each renders as one item in a contact row under the intro and in the page's
-- Person JSON-LD, and each is removed by clearing it in the page builder.
-- /about/ahmad-din uses the same section type and is untouched: its hero has
-- none of the keys, so it shows no contact row.
--
-- DML only, no DDL, so `node scripts/seed-kaleem-contact.mjs` applies it through
-- supabase-js (it also supports --dry-run). Same pairing as 098.
--
-- SAFE ON RE-RUN, and never destructive: a key is written only when it is absent
-- from the hero, so a re-run never restores a field the operator has since
-- edited or cleared, and every other key in the section is left as it is.
--
-- SAFE TO APPLY: before or after the deploy that renders the contact row.
-- Before it, the keys are stored and ignored by the hero renderer, and the page
-- looks exactly as it does today. After it, the row appears.

BEGIN;

UPDATE page_sections
SET content = jsonb_build_object(
      'contact_email', 'kaleem.farooq@pacemakersglobal.com',
      'contact_phone', '+966 50 110 1421',
      'contact_linkedin', 'https://www.linkedin.com/in/kaleemfarooq/'
    ) || content
WHERE page_slug = 'about-kaleem-farooq'
  AND section_type = 'founder_hero';

COMMIT;
