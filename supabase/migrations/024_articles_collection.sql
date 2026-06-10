-- 024_articles_collection.sql
-- Insights / thought-leadership articles (admin: /admin/articles).
-- Public /insights + /insights/[slug] read published rows ordered by published_at.

BEGIN;

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT,
  cover_url TEXT,
  category TEXT,
  author_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  seo_title TEXT,
  seo_description TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published
  ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_featured
  ON articles(featured, status);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

COMMIT;
