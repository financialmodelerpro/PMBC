-- 022_case_studies_collection.sql
-- Case studies / engagements as a managed collection (admin: /admin/case-studies).
-- Public /case-studies + /case-studies/[slug] read published rows.

BEGIN;

CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  client_name TEXT,
  industry TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  summary TEXT,
  cover_image TEXT,
  body TEXT,
  metrics JSONB NOT NULL DEFAULT '[]',
  featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_studies_status_order
  ON case_studies(status, display_order);
CREATE INDEX IF NOT EXISTS idx_case_studies_featured
  ON case_studies(featured, status);

ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;

COMMIT;
