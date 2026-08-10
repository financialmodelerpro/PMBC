-- 039_booking_cta_prominence.sql
-- Raise the booking route's prominence across the navbar, the contact page and
-- the home founder card.
--
-- Four content changes, all in the database so every string stays admin
-- editable. No hardcoded copy is introduced by the components that read them:
-- each has a shipped fallback, so a database missing this migration renders
-- sensible text rather than blanks.
--
--   1. Navbar CTA           header_settings cta_label / cta_href
--   2. Contact callout      cms_content `booking` section, two new keys
--   3. Founder card copy    cms_content `contact` section, four new keys
--   4. Home founder CTA     page_sections founder_block on `home`
--
-- Why the navbar CTA moves: the header carried both a "Contact" nav item and a
-- "Start a Conversation" button, and both pointed at /contact. One of the two
-- was redundant. Pointing the button at /book makes the pair meaningful, since
-- the nav item now leads to the form and the button to the calendar. The nav
-- item itself is untouched, and /book is deliberately NOT added to site_pages:
-- it stays a CTA, not a seventh nav entry.
--
-- DML only, so `node scripts/seed-booking-cta-prominence.mjs` applies it
-- through supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive on re-run, in the same style as 038. The
-- navbar CTA is only repointed while it still carries the old /contact value,
-- so an operator who has since changed it keeps their edit. The founder CTA is
-- only filled when its href is empty. New copy rows use ON CONFLICT DO NOTHING.

BEGIN;

-- 1. Navbar CTA. Guarded on the current value rather than applied blind: this
--    is the one statement here that changes existing content rather than adding
--    to it, and an operator edit should outrank a re-run of this migration.
UPDATE cms_content
SET value = 'Book a Meeting',
    updated_at = NOW()
WHERE section = 'header_settings'
  AND key = 'cta_label'
  AND value = 'Start a Conversation';

UPDATE cms_content
SET value = '/book',
    updated_at = NOW()
WHERE section = 'header_settings'
  AND key = 'cta_href'
  AND value = '/contact';

-- 2. Contact page booking callout. `contact_prompt` already exists from 038 and
--    supplies the heading line, so only the body and button label are new.
INSERT INTO cms_content (section, key, value) VALUES
  ('booking', 'contact_callout_body', 'Book a 60 minute advisory meeting directly with Ahmad.'),
  ('booking', 'contact_callout_cta',  'Book a Meeting')
ON CONFLICT (section, key) DO NOTHING;

-- 2b. Retire the key the old subtle strip used. The callout that replaced it
--     takes its heading from `contact_prompt` and its button label from
--     `contact_callout_cta`, so `contact_link_label` now controls nothing.
--     Left in place it would sit in /admin/content inviting an edit that has no
--     effect anywhere, which is worse than the row not existing. Introduced by
--     038 the day before, so nothing else can depend on it.
DELETE FROM cms_content
WHERE section = 'booking'
  AND key = 'contact_link_label';

-- 3. Contact page founder card. Its portrait is deliberately absent from this
--    list: it is read at render time from the founder_hero section, so a new
--    upload in the page builder flows through without a content edit here.
INSERT INTO cms_content (section, key, value) VALUES
  ('contact', 'founder_name',      'Ahmad Din'),
  ('contact', 'founder_heading',   'Speak directly with the founder'),
  ('contact', 'founder_body',      'Every mandate at PaceMakers is led personally by Ahmad Din. If you would rather discuss your situation before writing it down, book a call.'),
  ('contact', 'founder_cta_label', 'Book a Meeting')
ON CONFLICT (section, key) DO NOTHING;

-- 4. Home founder card second CTA.
--    The card already carried cta_secondary_label 'Connect on LinkedIn' with an
--    empty href, so FounderBlock rendered no second button at all (it requires
--    both label and href). Rather than add a third slot, that dormant pair is
--    repurposed for the booking CTA, which is the action the home card actually
--    wants next to "Read Full Profile". The LinkedIn link is not lost: it still
--    lives on the founder profile page as its primary CTA.
--    Only touches a card whose secondary href is empty.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'cta_secondary_label', 'Book a Meeting',
      'cta_secondary_href',  '/book'
    ),
    updated_at = NOW()
WHERE section_type = 'founder_block'
  AND page_slug = 'home'
  AND COALESCE(content->>'cta_secondary_href', '') = '';

COMMIT;
