-- 073_place_testimonial_sections.sql
-- The three testimonial sections take their places, and nothing changes for a
-- visitor today.
--
-- All three ship `visible = false`, and the submission form has a second lock
-- on it: `site_settings.testimonial_form_public` is absent, which reads as off,
-- so even made visible it would stay hidden until that switch is turned on.
-- Placing and publishing are separate acts, which is the whole reason the
-- switch exists.
--
--   contact  testimonial_form   below the enquiry form
--   home     testimonials       after the founder card, before the network line
--   home     testimonial_form   at the foot of the page
--
-- Positions, and why these numbers.
--
-- `/contact` holds a hero at 10 and the `contact_body` at 20, so the form goes
-- at 30: below the enquiry form, as instructed, which is also the right order
-- for the reader. Someone who came to write to the firm should be asked to
-- write about the firm second.
--
-- Home is the more careful one. The founder card sits at 80 and the network
-- mention at 90, so the quotes go at 85, exactly where the instruction puts
-- them: after a page has said who leads the work is when a client saying it was
-- worth it lands hardest, and before the network block, which changes subject.
-- The submission form goes last, at 200, well clear of the closing call to
-- action, because asking an existing client for a testimonial and asking a
-- prospect to get in touch are addressed to different readers and the CTA
-- should not have to compete.
--
-- The quotes block is capped at two. Home is a long page and this is a proof
-- point inside it rather than its subject, and two quotes read as evidence
-- where eight read as a wall. `max_items` is blank everywhere else, which means
-- all of them.
--
-- DML only, so `node scripts/seed-testimonial-sections.mjs` applies it.
--
-- Idempotent: each insert is guarded on that page not already carrying that
-- section type, so a re-run cannot add a second copy or overwrite an edit.

BEGIN;

-- 1. The submission form on /contact, below the enquiry form.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'contact',
  'testimonial_form',
  jsonb_build_object(
    'eyebrow', 'In your words',
    'heading', 'Share your experience',
    'intro', 'If we have worked together and you would be willing to say so publicly, we would be glad to hear it. Nothing you write appears anywhere until you have approved the wording and we have published it.',
    'consent_label', 'I agree that PaceMakers may publish this testimonial, with my name, role and company, on its website and in its materials.',
    'button_label', 'Submit testimonial',
    'success_message', 'Thank you. Your testimonial has been received and will be reviewed before anything is published.'
  ),
  '{}'::jsonb,
  30,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'contact' AND section_type = 'testimonial_form'
);

-- 2. The quotes on home, between the founder card and the network mention.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'home',
  'testimonials',
  jsonb_build_object(
    'eyebrow', 'In their words',
    'heading', 'What clients say',
    'only_landing', false,
    'max_items', '2'
  ),
  '{}'::jsonb,
  85,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'home' AND section_type = 'testimonials'
);

-- 3. The submission form on home, at the foot.
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT
  'home',
  'testimonial_form',
  jsonb_build_object(
    'eyebrow', 'In your words',
    'heading', 'Share your experience',
    'intro', 'If we have worked together and you would be willing to say so publicly, we would be glad to hear it. Nothing you write appears anywhere until you have approved the wording and we have published it.',
    'consent_label', 'I agree that PaceMakers may publish this testimonial, with my name, role and company, on its website and in its materials.',
    'button_label', 'Submit testimonial',
    'success_message', 'Thank you. Your testimonial has been received and will be reviewed before anything is published.'
  ),
  '{}'::jsonb,
  200,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'home' AND section_type = 'testimonial_form'
);

COMMIT;
