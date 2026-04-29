-- 006_seed_default_content.sql
-- Seed cms_content rows for header, footer, contact info, SEO defaults.
-- Values are placeholders; admin will refine via /admin/content.

INSERT INTO cms_content (section, key, value) VALUES
  -- Header
  ('header_settings', 'show_cta', 'true'),
  ('header_settings', 'cta_label', 'Start a Conversation'),
  ('header_settings', 'cta_href', '/contact'),

  -- Footer
  ('footer_settings', 'about_blurb', 'PaceMakers Business Consultants is a boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.'),
  ('footer_settings', 'copyright', '© PaceMakers Business Consultants LLP. All rights reserved.'),
  ('footer_settings', 'address_line', 'Lahore · Al Khobar · Manama'),

  -- Contact info
  ('contact_info', 'email', 'info@pacemakersglobal.com'),
  ('contact_info', 'whatsapp', ''),
  ('contact_info', 'linkedin_url', ''),
  ('contact_info', 'office_address', 'Lahore, Pakistan'),

  -- SEO defaults
  ('seo_defaults', 'site_title', 'PaceMakers Business Consultants'),
  ('seo_defaults', 'site_description', 'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.'),
  ('seo_defaults', 'og_image_url', '')
ON CONFLICT (section, key) DO NOTHING;
