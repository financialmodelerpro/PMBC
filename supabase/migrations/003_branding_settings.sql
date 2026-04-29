-- 003_branding_settings.sql
-- Single-row branding config + global settings.

CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  brand_name TEXT NOT NULL DEFAULT 'PaceMakers Business Consultants',
  short_name TEXT NOT NULL DEFAULT 'PaceMakers',
  tagline TEXT NOT NULL DEFAULT 'Advisory from Structure to Exit',
  primary_color TEXT NOT NULL DEFAULT '#1B3A5F',
  secondary_color TEXT NOT NULL DEFAULT '#3FA663',
  accent_color TEXT NOT NULL DEFAULT '#D4A93A',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branding_config (id) VALUES (1);

CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, settings) VALUES (1, '{}');
