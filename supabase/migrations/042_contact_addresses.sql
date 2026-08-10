-- 042_contact_addresses.sql
-- Three published contact addresses, and the notification recipient to match.
--
-- /contact showed a single address. It now routes three kinds of enquiry to
-- three mailboxes, stored in site_settings so they stay admin-editable at
-- /admin/settings rather than being hardcoded in the page:
--
--   contact_email           info@         general enquiries (also the footer)
--   contact_email_advisory  advisory@     mandate and advisory enquiries
--   contact_email_founder   ahmad.din@    direct contact with the founder
--
-- Labels ship alongside the addresses so the wording is editable too. The page
-- carries the same strings as fallbacks, so a database missing this migration
-- renders correct copy rather than blanks, and clearing an address removes that
-- row rather than leaving an empty one.
--
-- ALSO CHANGES WHERE CONTACT NOTIFICATIONS ARE DELIVERED.
-- `admin_email` was meetahmadch@gmail.com. The contact route prefers
-- site_settings.admin_email over the EMAIL_TO_ADMIN environment variable, so
-- setting EMAIL_TO_ADMIN=advisory@pacemakersglobal.com on Vercel alone would
-- have had no effect: the database value would still have won and mail would
-- have kept going to the personal Gmail address. This aligns the two.
--
-- Confirm advisory@pacemakersglobal.com actually receives mail before relying
-- on it. If that mailbox is not live yet, set admin_email back to a working
-- address in /admin/settings; submissions are saved to the inbox regardless, so
-- nothing is lost either way.
--
-- DML only, so `node scripts/seed-contact-addresses.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive: each key is only written when absent or
-- blank, and admin_email only moves while it still holds the old Gmail value,
-- so a re-run cannot overwrite a later operator edit.

BEGIN;

UPDATE site_settings
SET settings = settings
      || CASE WHEN COALESCE(settings->>'contact_email_advisory', '') = ''
              THEN jsonb_build_object('contact_email_advisory', 'advisory@pacemakersglobal.com')
              ELSE '{}'::jsonb END
      || CASE WHEN COALESCE(settings->>'contact_email_founder', '') = ''
              THEN jsonb_build_object('contact_email_founder', 'ahmad.din@pacemakersglobal.com')
              ELSE '{}'::jsonb END
      || CASE WHEN COALESCE(settings->>'contact_label_general', '') = ''
              THEN jsonb_build_object('contact_label_general', 'General enquiries')
              ELSE '{}'::jsonb END
      || CASE WHEN COALESCE(settings->>'contact_label_advisory', '') = ''
              THEN jsonb_build_object('contact_label_advisory', 'Mandate and advisory enquiries')
              ELSE '{}'::jsonb END
      || CASE WHEN COALESCE(settings->>'contact_label_founder', '') = ''
              THEN jsonb_build_object('contact_label_founder', 'Direct to the founder')
              ELSE '{}'::jsonb END
      || CASE WHEN COALESCE(settings->>'contact_email', '') = ''
              THEN jsonb_build_object('contact_email', 'info@pacemakersglobal.com')
              ELSE '{}'::jsonb END,
    updated_at = NOW()
WHERE id = 1;

-- Guarded on the old value so an operator who has since chosen a different
-- notification address keeps it.
UPDATE site_settings
SET settings = settings || jsonb_build_object('admin_email', 'advisory@pacemakersglobal.com'),
    updated_at = NOW()
WHERE id = 1
  AND settings->>'admin_email' = 'meetahmadch@gmail.com';

COMMIT;
