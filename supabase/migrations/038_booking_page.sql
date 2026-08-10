-- 038_booking_page.sql
-- Booking page at /book, plus the CTA wiring that points at it.
--
-- Mirrors FMP's /book-a-meeting setup: one Calendly inline embed, one
-- admin-editable URL, direct contact routes underneath. The differences are
-- deliberate. FMP stores its booking URL inside the home page's founder
-- section content, which couples a global setting to one section on one page.
-- PMBC keeps it in site_settings, where it is a site-wide value edited from
-- Site Settings and read by any page that needs it.
--
-- The seeded URL is the same Calendly event FMP books against, confirmed by
-- reading FMP's live page_sections rather than trusting the example URL in its
-- source comments.
--
-- DML only, so `node scripts/seed-booking-page.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent, and non-destructive on re-run. Every statement is guarded so a
-- second application cannot overwrite operator edits: the URL is only seeded
-- when blank, the page and its hero are only inserted when absent, the founder
-- CTA is only filled when its href is empty, and the copy rows use
-- ON CONFLICT DO NOTHING. Unlike 034, re-running this is safe.

BEGIN;

-- 1. The Calendly URL, site-wide and admin-editable at /admin/settings.
--    Only seeded when absent or blank, so repointing the calendar in admin
--    survives a re-run of this migration.
UPDATE site_settings
SET settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{booking_url}',
      to_jsonb('https://calendly.com/financialmodelerpro/60-minute-modeling-hub-advisory-meeting'::text),
      true
    ),
    updated_at = NOW()
WHERE id = 1
  AND COALESCE(settings->>'booking_url', '') = '';

-- 2. The CMS page row. Marked is_system because /book is a real route: the
--    admin delete button must not be able to remove the row that supplies its
--    meta title, description and OG image via generateMetadata.
INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
VALUES (
  'book',
  'Book a Meeting',
  'Book a Meeting | PaceMakers Business Consultants',
  'Book an introductory call with PaceMakers Business Consultants. No cost, no obligation, and a direct conversation about your mandate.',
  'published',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- 3. The hero, editable in the page builder like every other page hero.
--    Guarded on the page having no sections at all rather than on this row
--    specifically, so an operator who deleted the hero on purpose does not get
--    it silently reinstated.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'book',
  'hero',
  jsonb_build_object(
    'badge_text', 'BOOK A MEETING',
    'headline',   'Start the conversation.',
    'subtitle',   'A 60 minute introductory call, at no cost and no obligation. We will discuss the mandate, the timeline, and whether PaceMakers is the right firm for it.',
    'cta_label',  '',
    'cta_href',   '',
    'cta_secondary_label', '',
    'cta_secondary_href',  ''
  ),
  '{}'::jsonb,
  10,
  true
WHERE NOT EXISTS (SELECT 1 FROM page_sections WHERE page_slug = 'book');

-- 4. The founder profile's secondary CTA. It already read "Book a Meeting" but
--    carried an empty href, so FounderHero suppressed the button entirely
--    (it renders a CTA only when both label and href are set). This gives it a
--    destination. Only fills an empty href, never repoints one already set.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'cta_secondary_label', 'Book a Meeting',
      'cta_secondary_href',  '/book'
    ),
    updated_at = NOW()
WHERE section_type = 'founder_hero'
  AND COALESCE(content->>'cta_secondary_href', '') = '';

-- 5. Booking copy, grouped under its own cms_content section so it appears as
--    an editable group at /admin/content without any admin code change.
--    Every one of these has a hardcoded fallback in the route, so a missing row
--    degrades to shipped copy rather than a blank.
INSERT INTO cms_content (section, key, value) VALUES
  ('booking', 'calendar_eyebrow',     'Select a time'),
  ('booking', 'fallback_prompt',      'Trouble viewing the calendar?'),
  ('booking', 'fallback_link_label',  'Open Calendly directly'),
  ('booking', 'alternatives_label',   'Other ways to reach us'),
  ('booking', 'alternatives_text',    'You can also write to us directly, or send the mandate details through the contact form.'),
  ('booking', 'contact_form_label',   'Send a message'),
  ('booking', 'empty_heading',        'The calendar is being set up'),
  ('booking', 'empty_body',           'Self-service booking is not live yet. Reach us directly and we will find a time.'),
  ('booking', 'contact_prompt',       'Prefer to talk?'),
  ('booking', 'contact_link_label',   'Book a meeting directly')
ON CONFLICT (section, key) DO NOTHING;

COMMIT;
