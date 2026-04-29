-- 004_contact_email.sql
-- Contact submissions + email branding/templates.

CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  country TEXT,
  service_interest TEXT,
  message TEXT NOT NULL,
  source_page TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_contact_submissions_status ON contact_submissions(status, created_at DESC);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

CREATE TABLE email_branding (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1B3A5F',
  signature_html TEXT,
  footer_html TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_branding (id) VALUES (1);

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
