-- 005_seed_default_pages.sql
-- Insert one cms_pages row for every v1 page (per CLAUDE.md Section 5 sitemap).
-- Service detail pages live at /services/[slug] and use the same cms_pages
-- pattern with slug "service-{service-slug}".

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status) VALUES
  ('home', 'Home', 'PaceMakers Business Consultants — Advisory from Structure to Exit', 'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.', 'published'),
  ('services', 'Services', 'Services — PaceMakers Business Consultants', 'Financial modeling, valuation, due diligence, M&A, and CFO advisory across KSA and GCC mandates.', 'published'),
  ('sectors', 'Sector Coverage', 'Sector Coverage — PaceMakers Business Consultants', 'Real estate, energy, industrial services, infrastructure, and family-office mandates.', 'published'),
  ('approach', 'Our Approach', 'Engagement Approach — PaceMakers Business Consultants', 'How we engage: understand, analyse, model, advise.', 'published'),
  ('network', 'Strategic Network', 'Strategic Network — PaceMakers Business Consultants', 'Sky Gulf in Al Khobar and Lynkers in Manama extend our GCC reach.', 'published'),
  ('about', 'About', 'About — PaceMakers Business Consultants', 'A boutique corporate finance firm. Senior-led, analytically grounded, commercially focused.', 'published'),
  ('financial-modeler-pro', 'Financial Modeler Pro', 'Financial Modeler Pro — PaceMakers Business Consultants', 'PMBC''s flagship platform for financial modeling education and tools.', 'published'),
  ('contact', 'Contact', 'Contact — PaceMakers Business Consultants', 'Start a conversation about your mandate.', 'published'),
  -- Service detail pages
  ('service-financial-modeling', 'Financial Modeling', 'Financial Modeling — PaceMakers Business Consultants', 'Institutional-grade financial models for transaction, valuation, and decision support.', 'published'),
  ('service-business-valuation', 'Business Valuation', 'Business Valuation — PaceMakers Business Consultants', 'Independent valuation analyses for transaction, dispute, and strategic decisions.', 'published'),
  ('service-financial-due-diligence', 'Financial Due Diligence', 'Financial Due Diligence — PaceMakers Business Consultants', 'Buy-side and sell-side financial due diligence for sophisticated investors.', 'published'),
  ('service-transaction-advisory', 'Transaction Advisory', 'Transaction Advisory — PaceMakers Business Consultants', 'End-to-end transaction support across structuring, negotiation, and closing.', 'published'),
  ('service-mergers-acquisitions', 'M&A Advisory', 'M&A Advisory — PaceMakers Business Consultants', 'Buy-side and sell-side M&A advisory across KSA, GCC, and worldwide mandates.', 'published'),
  ('service-real-estate-modeling', 'Real Estate Modeling', 'Real Estate Modeling — PaceMakers Business Consultants', 'Development, residual land, and portfolio cash-flow models for real estate principals.', 'published'),
  ('service-project-finance', 'Project Finance', 'Project Finance — PaceMakers Business Consultants', 'Bankable project finance models for infrastructure, energy, and industrial projects.', 'published'),
  ('service-investment-memorandums', 'Investment Memorandums', 'Investment Memorandums — PaceMakers Business Consultants', 'Investor-ready information memoranda and pitch materials.', 'published'),
  ('service-cfo-advisory', 'CFO Advisory', 'CFO Advisory — PaceMakers Business Consultants', 'Fractional CFO and finance leadership for growth-stage and family-office portfolio companies.', 'published');
