-- 007_seed_default_sections.sql
-- Insert minimal page_sections placeholders so each page renders something
-- before real copy is written in Phase 9. Admin can edit/replace via the
-- page builder. Content blobs are intentionally lean.

-- Home
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('home', 'hero', '{"badge":"PaceMakers Business Consultants","headline":"Advisory from Structure to Exit","subtitle":"Boutique corporate finance and transaction advisory for KSA, GCC, and worldwide mandates.","cta_label":"Start a Conversation","cta_href":"/contact"}', 0),
  ('home', 'paragraphs', '{"html":"<p>Placeholder copy. Edit via /admin/page-builder/home.</p>"}', 10);

-- Services overview
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('services', 'hero', '{"badge":"Services","headline":"What we do","subtitle":"Nine service lines across modeling, valuation, due diligence, and transaction advisory."}', 0),
  ('services', 'service_cards', '{"items":[]}', 10);

-- Sectors
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('sectors', 'hero', '{"badge":"Sectors","headline":"Where we work","subtitle":"Real estate, energy, industrial services, infrastructure, and family-office portfolios."}', 0),
  ('sectors', 'sector_grid', '{"items":[]}', 10);

-- Approach
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('approach', 'hero', '{"badge":"Approach","headline":"How we engage","subtitle":"Understand. Analyse. Model. Advise."}', 0),
  ('approach', 'process_steps', '{"steps":[]}', 10);

-- Network
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('network', 'hero', '{"badge":"Network","headline":"Strategic Network","subtitle":"Sky Gulf in Al Khobar. Lynkers in Manama. GCC reach extended."}', 0),
  ('network', 'network_partners', '{"partners":[]}', 10);

-- About
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('about', 'hero', '{"badge":"About","headline":"The firm","subtitle":"Senior-led, analytically grounded, commercially focused."}', 0),
  ('about', 'founder_block', '{"name":"Ahmad Din","title":"Founder","bio_html":"<p>Placeholder bio. Edit via /admin/page-builder/about.</p>"}', 10);

-- Financial Modeler Pro
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('financial-modeler-pro', 'hero', '{"badge":"Financial Modeler Pro","headline":"Our flagship platform","subtitle":"Education and tools for financial modeling at institutional standard."}', 0),
  ('financial-modeler-pro', 'fmp_intro', '{"cta_label":"Visit Financial Modeler Pro","cta_href":"https://financialmodelerpro.com"}', 10);

-- Contact
INSERT INTO page_sections (page_slug, section_type, content, display_order) VALUES
  ('contact', 'hero', '{"badge":"Contact","headline":"Start a conversation","subtitle":"Tell us about your mandate. We respond within one to two business days."}', 0);
