-- 025_testimonials_collection.sql
-- Client testimonials (admin: /admin/testimonials).
-- Public home/about pull status='approved' (and show_on_landing for the homepage).

BEGIN;

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  company TEXT,
  text TEXT NOT NULL,
  rating INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  testimonial_type TEXT NOT NULL DEFAULT 'written',
  video_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  show_on_landing BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status
  ON testimonials(status, display_order);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

COMMIT;
