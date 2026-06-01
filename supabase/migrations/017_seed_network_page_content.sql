-- 017_seed_network_page_content.sql
-- Phase 9 — Network page real content. Replaces all existing page_sections rows
-- for page_slug='network' (the Phase 6 smoke network_partners) with the
-- production 4-section flow:
--   10  hero
--   20  network_partners  (Sky Gulf + Lynkers)
--   30  text_image        (Why the network matters)
--   40  cta_block
--
-- All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
-- Partner facts are drawn from the home page network seed. Partner website URLs
-- are unknown, so `link` is left empty rather than fabricated.
--
-- Mirrors scripts/seed-network-page.mjs. Idempotent (DELETE + INSERT).

BEGIN;

DELETE FROM page_sections WHERE page_slug = 'network';

-- 10  hero
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('network', 'hero', '{
  "badge_text": "STRATEGIC NETWORK",
  "headline": "Reach extended through partners we trust.",
  "subtitle": "PaceMakers is deliberately lean, but never narrow. Two long-standing relationships extend our reach across the Gulf, giving clients regional presence and execution depth without the overhead of a large firm.",
  "cta_label": "Start a Conversation",
  "cta_href": "/contact",
  "cta_secondary_label": "About the Firm",
  "cta_secondary_href": "/about",
  "background_style": "light"
}'::jsonb, '{}'::jsonb, 10, true);

-- 20  network_partners
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('network', 'network_partners', '{
  "eyebrow": "THE NETWORK",
  "heading": "Two partners, one standard.",
  "intro": "We work alongside people we have known for years and whose judgment we trust with our clients. The bar for the network is the same bar we hold ourselves to.",
  "partners": [
    {
      "logo_url": "",
      "name": "Sky Gulf",
      "location": "Al Khobar, Saudi Arabia",
      "role_tag": "Execution Partner",
      "description": "Headquartered in the Eastern Province, Sky Gulf brings industrial and project-execution depth to mandates on the ground in Saudi Arabia. The relationship gives clients local presence where the assets and the counterparties actually are.",
      "link": ""
    },
    {
      "logo_url": "",
      "name": "Lynkers",
      "location": "Manama, Bahrain",
      "role_tag": "Equity Shareholder",
      "description": "Based in Manama and a strategic equity shareholder in PaceMakers, Lynkers provides Bahrain market access and capital-markets insight. The partnership connects clients to the regional banking and investor network that moves Gulf transactions.",
      "link": ""
    }
  ]
}'::jsonb, '{}'::jsonb, 20, true);

-- 30  text_image
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('network', 'text_image', '{
  "eyebrow": "WHY IT MATTERS",
  "heading": "Boutique judgment, regional reach.",
  "body_html": "<p>A large firm sells you its logo and staffs you with whoever is available. A network like ours works the opposite way: senior people who choose to work together, brought in only where they add something real.</p><p>For clients, that means the partner you hire stays accountable for the mandate, while the network supplies on-the-ground presence, sector contacts, and capital-markets access exactly where a transaction needs them.</p>",
  "image_url": "",
  "image_alt": "PaceMakers strategic network across the GCC",
  "image_caption": "",
  "image_position": "right",
  "cta_label": "How we work",
  "cta_href": "/approach"
}'::jsonb, '{}'::jsonb, 30, true);

-- 40  cta_block
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible) VALUES
('network', 'cta_block', '{
  "headline": "Have a transaction that needs regional reach?",
  "subhead": "Tell us what you are working on. We will bring the right people to the table, and no one you do not need.",
  "cta_primary_label": "Start a Conversation",
  "cta_primary_href": "/contact",
  "cta_secondary_label": "View Services",
  "cta_secondary_href": "/services",
  "background_style": "dark"
}'::jsonb, '{}'::jsonb, 40, true);

UPDATE cms_pages SET updated_at = NOW() WHERE slug = 'network';

COMMIT;
