-- 064_contact_page_copy.sql
-- The /contact page's body copy becomes content.
--
-- The page carried one CMS section, the hero. Everything below it was written
-- into the route file: the form panel's eyebrow, heading and response-time
-- line, and the right column's eyebrow, heading and intro. Six strings that
-- read as marketing copy, edited by opening a .tsx file and redeploying.
--
-- Three more strings were already content but filed in the wrong drawer. The
-- booking callout on this page reads (booking, contact_prompt),
-- (booking, contact_callout_body) and (booking, contact_callout_cta), which
-- migration 039 put under `booking` because they name the booking action.
-- Nothing else reads them: /book has its own keys. So an operator looking for
-- contact-page copy found two thirds of it under one group and one third under
-- another. This migration moves those three, carrying whatever value they hold
-- now rather than reseeding the shipped default, then deletes the originals so
-- /admin/content does not offer an edit that changes nothing.
--
-- The founder card was already correct: 039 filed its four keys under
-- `contact`, and they are untouched here.
--
-- No wording changes. Every string below is the string the page renders today,
-- moved rather than rewritten. The route keeps the same literals as fallbacks,
-- so a database missing this migration renders exactly what it renders now.
--
-- DML only, so `node scripts/seed-contact-page-copy.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive on re-run: every insert is guarded by
-- ON CONFLICT DO NOTHING, so a second application cannot overwrite an edit made
-- in the admin, and the three deletes are no-ops once the rows are gone.

BEGIN;

-- 1. The three booking-callout keys, moved from `booking` to `contact` with
--    their current values. Run before the plain inserts below so a value edited
--    in the admin wins over the shipped default.
INSERT INTO cms_content (section, key, value)
SELECT 'contact', 'booking_prompt', value
FROM cms_content WHERE section = 'booking' AND key = 'contact_prompt'
ON CONFLICT (section, key) DO NOTHING;

INSERT INTO cms_content (section, key, value)
SELECT 'contact', 'booking_body', value
FROM cms_content WHERE section = 'booking' AND key = 'contact_callout_body'
ON CONFLICT (section, key) DO NOTHING;

INSERT INTO cms_content (section, key, value)
SELECT 'contact', 'booking_cta_label', value
FROM cms_content WHERE section = 'booking' AND key = 'contact_callout_cta'
ON CONFLICT (section, key) DO NOTHING;

-- 2. Every contact-page key at its shipped wording. The three above are
--    repeated here so a database that never ran 039 still ends up complete;
--    where step 1 already inserted a carried value, ON CONFLICT keeps it.
INSERT INTO cms_content (section, key, value) VALUES
  ('contact', 'form_eyebrow',       'Start a conversation'),
  ('contact', 'form_heading',       'Tell us about the mandate'),
  ('contact', 'form_response_note', 'We respond to every credible enquiry within one to two business days.'),
  ('contact', 'booking_prompt',     'Prefer to talk?'),
  ('contact', 'booking_body',       'Book a 60 minute advisory meeting directly with Ahmad.'),
  ('contact', 'booking_cta_label',  'Book a Meeting'),
  ('contact', 'direct_eyebrow',     'Direct'),
  ('contact', 'direct_heading',     'Other ways to reach us'),
  ('contact', 'direct_intro',       'For urgent matters or referrals, you can reach the firm directly.')
ON CONFLICT (section, key) DO NOTHING;

-- 3. Retire the originals. Left in place they would sit in /admin/content under
--    Booking, inviting an edit that the contact page no longer reads. Guarded
--    on the replacement existing, so a partial application cannot leave the
--    callout with no row at all.
DELETE FROM cms_content
WHERE section = 'booking'
  AND key IN ('contact_prompt', 'contact_callout_body', 'contact_callout_cta')
  AND EXISTS (
    SELECT 1 FROM cms_content
    WHERE section = 'contact'
      AND key IN ('booking_prompt', 'booking_body', 'booking_cta_label')
    HAVING COUNT(*) = 3
  );

COMMIT;
