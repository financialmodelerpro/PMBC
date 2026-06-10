-- 021_services_collection.sql
-- Advisory service lines as a managed CMS collection (admin: /admin/services).
-- Replaces the static config-only services model with an editable table.
-- Public /services + /services/[slug] read published rows, falling back to
-- config/services.ts when the table is empty.

BEGIN;

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  number TEXT,
  summary TEXT,
  icon TEXT,
  hero_image TEXT,
  body TEXT,
  bullets JSONB NOT NULL DEFAULT '[]',
  cta_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_status_order
  ON services(status, display_order);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Seed the nine established service lines (published). Body is left empty so the
-- existing cms_content service_<slug> copy continues to drive detail pages until
-- it is migrated into the row from the admin editor.
INSERT INTO services (title, slug, number, summary, display_order, status) VALUES
  ('Financial Modeling', 'financial-modeling', '01',
   'Institutional-grade three-statement, project, and scenario models built for board, lender, and investor scrutiny.', 1, 'published'),
  ('Business Valuation', 'business-valuation', '02',
   'DCF, comparable transactions, and precedent-based valuations used for negotiations, fairness opinions, and strategic planning.', 2, 'published'),
  ('Financial Due Diligence', 'financial-due-diligence', '03',
   'Buy-side and sell-side quality of earnings, working capital, and net debt analyses with defendable findings.', 3, 'published'),
  ('Transaction Advisory', 'transaction-advisory', '04',
   'End-to-end deal support from screening to close, including structuring, negotiation, and closing mechanics.', 4, 'published'),
  ('M&A Advisory', 'mergers-acquisitions', '05',
   'Sell-side and buy-side mandates run with discretion, from target identification through completion.', 5, 'published'),
  ('Real Estate Modeling', 'real-estate-modeling', '06',
   'Development, income, and mixed-use property models with phasing, financing, and sensitivity built in.', 6, 'published'),
  ('Project Finance', 'project-finance', '07',
   'Lender-ready models and structuring for infrastructure, energy, and industrial projects.', 7, 'published'),
  ('Investment Memorandums', 'investment-memorandums', '08',
   'Information memoranda, teasers, and investor decks that present the opportunity with rigor and clarity.', 8, 'published'),
  ('CFO Advisory', 'cfo-advisory', '09',
   'Fractional, senior finance leadership for planning, reporting, and capital decisions.', 9, 'published')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
