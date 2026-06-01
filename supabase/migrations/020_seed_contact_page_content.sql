-- 020_seed_contact_page_content.sql
-- Phase 9 — Contact intro. The /contact route renders CMS page_sections ABOVE
-- the static form + direct-contact section (which carries its own heading and the
-- respond-within-one-to-two-business-days line), so the only CMS section is a
-- hero header. Hero CTA buttons are intentionally omitted because the form sits
-- directly below. Replaces all page_sections rows for page_slug='contact'.
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
--
-- Mirrors scripts/seed-contact-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'contact';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('contact', 'hero', '{
  "badge_text": "CONTACT",
  "headline": "Start a conversation.",
  "subtitle": "Most of our work comes through referral. If you have a mandate, a question, or an introduction, we read every message and respond to credible enquiries within one to two business days.",
  "cta_label": "",
  "cta_href": "",
  "cta_secondary_label": "",
  "cta_secondary_href": "",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'contact';

COMMIT;
