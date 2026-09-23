-- 092_growth_nurture_partners.sql
-- Growth Engine Phase 6, Nurture and Referrals (Units 6.1 to 6.3,
-- 2026-09-23): the nurture subscription on contacts, the educational
-- sequence, lead magnets, Brevo events, partners, check-ins, introductions and
-- the referral source on leads.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 091, and before or after the deploy of any Phase 6
-- unit. It adds Growth tables and columns with defaults only; nurture_enabled
-- defaults to false, so nothing is sent or synced when it is applied. Until it
-- is applied the Nurture and Partners screens show a migration notice, the
-- Brevo events route answers 503 and nothing is synced or sent.
--
-- Idempotent: IF NOT EXISTS throughout, constraints dropped before they are
-- re-created.
--
-- WHAT CHANGES
-- 1. growth_contacts: nurture_status (none, subscribed, unsubscribed; a
--    subscription needs opted-in consent, by constraint), when it changed,
--    the sequence position and next send, service interests, and the last
--    Brevo sync.
-- 2. growth_nurture_steps: the educational sequence, one row per step, each
--    approved before it can be sent.
-- 3. growth_lead_magnets: guides and checklists that can be sent to an
--    opted-in contact, each approved before use; links are https or a site
--    path.
-- 4. growth_messages: opened_at and clicked_at, set from Brevo events.
-- 5. growth_brevo_events: every Brevo event received, unique per event, so a
--    retried webhook is applied once.
-- 6. growth_partners, growth_partner_checkins, growth_introductions: partners
--    and past clients by type, their check-in cadence, each check-in, and
--    introductions with their outcome.
-- 7. growth_leads: referral_partner_id and referral_source.
-- 8. growth_settings: nurture_enabled (default false), partner_checkin_days.
--
-- ACCESS
-- As 083 to 091: RLS on with no policies, every privilege revoked from anon
-- and authenticated.

BEGIN;

-- 1. Contacts
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS nurture_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE growth_contacts DROP CONSTRAINT IF EXISTS growth_contacts_nurture_status_check;
ALTER TABLE growth_contacts ADD CONSTRAINT growth_contacts_nurture_status_check CHECK (nurture_status IN ('none', 'subscribed', 'unsubscribed'));
ALTER TABLE growth_contacts DROP CONSTRAINT IF EXISTS growth_contacts_nurture_needs_opt_in;
ALTER TABLE growth_contacts ADD CONSTRAINT growth_contacts_nurture_needs_opt_in CHECK (nurture_status <> 'subscribed' OR consent_status = 'opted_in');
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS nurture_changed_at TIMESTAMPTZ;
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS nurture_step INTEGER NOT NULL DEFAULT 0 CHECK (nurture_step >= 0);
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS nurture_next_at TIMESTAMPTZ;
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS service_interest TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS brevo_synced_at TIMESTAMPTZ;
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS brevo_sync_error TEXT;
CREATE INDEX IF NOT EXISTS idx_growth_contacts_nurture ON growth_contacts (nurture_next_at) WHERE nurture_status = 'subscribed';

-- 2. The sequence
CREATE TABLE IF NOT EXISTS growth_nurture_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  step INTEGER NOT NULL CHECK (step BETWEEN 1 AND 24),
  -- Days after the previous step (after subscribing, for step 1).
  delay_days INTEGER NOT NULL DEFAULT 7 CHECK (delay_days BETWEEN 0 AND 365),
  subject TEXT NOT NULL CHECK (length(btrim(subject)) > 0),
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  link_path TEXT CHECK (link_path IS NULL OR link_path ~ '^/[^/]'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approved_at TIMESTAMPTZ,
  approved_by_name TEXT,
  updated_by_name TEXT,
  CONSTRAINT growth_nurture_steps_approval CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_nurture_steps_step_key ON growth_nurture_steps (step, is_test) WHERE status <> 'archived';

DROP TRIGGER IF EXISTS growth_nurture_steps_updated_at ON growth_nurture_steps;
CREATE TRIGGER growth_nurture_steps_updated_at BEFORE UPDATE ON growth_nurture_steps
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- 3. Lead magnets
CREATE TABLE IF NOT EXISTS growth_lead_magnets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT,
  url TEXT NOT NULL CHECK (url ~* '^https://[^[:space:]]+$' OR url ~ '^/[^/]'),
  email_subject TEXT NOT NULL CHECK (length(btrim(email_subject)) > 0),
  email_body TEXT NOT NULL CHECK (length(btrim(email_body)) > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  approved_at TIMESTAMPTZ,
  approved_by_name TEXT,
  CONSTRAINT growth_lead_magnets_approval CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS growth_lead_magnets_updated_at ON growth_lead_magnets;
CREATE TRIGGER growth_lead_magnets_updated_at BEFORE UPDATE ON growth_lead_magnets
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- 4. Opens and clicks on messages
ALTER TABLE growth_messages ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE growth_messages ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE growth_messages ADD COLUMN IF NOT EXISTS lead_magnet_id UUID REFERENCES growth_lead_magnets (id);

-- 5. Brevo events, applied once each
CREATE TABLE IF NOT EXISTS growth_brevo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  event TEXT NOT NULL,
  email TEXT,
  message_id UUID REFERENCES growth_messages (id),
  contact_id UUID REFERENCES growth_contacts (id),
  -- Brevo's own event identity: event, message id and time, as sent.
  dedupe_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS growth_brevo_events_once ON growth_brevo_events (dedupe_key);

-- 6. Partners
CREATE TABLE IF NOT EXISTS growth_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  type TEXT NOT NULL CHECK (type IN ('referral_partner', 'past_client', 'bank', 'law_firm', 'advisor', 'developer', 'other')),
  company_id UUID REFERENCES growth_companies (id),
  organisation TEXT,
  email TEXT CHECK (email IS NULL OR email = lower(btrim(email))),
  phone TEXT,
  linkedin_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  checkin_every_days INTEGER CHECK (checkin_every_days IS NULL OR checkin_every_days BETWEEN 7 AND 730),
  last_checkin_at TIMESTAMPTZ,
  next_checkin_due DATE,
  last_reminded_on DATE
);
CREATE INDEX IF NOT EXISTS idx_growth_partners_due ON growth_partners (next_checkin_due) WHERE status = 'active';

DROP TRIGGER IF EXISTS growth_partners_updated_at ON growth_partners;
CREATE TRIGGER growth_partners_updated_at BEFORE UPDATE ON growth_partners
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

CREATE TABLE IF NOT EXISTS growth_partner_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  partner_id UUID NOT NULL REFERENCES growth_partners (id),
  note TEXT,
  by_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_growth_partner_checkins_partner ON growth_partner_checkins (partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS growth_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  partner_id UUID NOT NULL REFERENCES growth_partners (id),
  lead_id UUID REFERENCES growth_leads (id),
  company_name TEXT NOT NULL CHECK (length(btrim(company_name)) > 0),
  introduced_on DATE NOT NULL,
  direction TEXT NOT NULL DEFAULT 'to_us' CHECK (direction IN ('to_us', 'from_us')),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'meeting', 'proposal', 'won', 'lost', 'no_response')),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_growth_introductions_partner ON growth_introductions (partner_id, introduced_on DESC);

DROP TRIGGER IF EXISTS growth_introductions_updated_at ON growth_introductions;
CREATE TRIGGER growth_introductions_updated_at BEFORE UPDATE ON growth_introductions
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- 7. Referral source on leads
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS referral_partner_id UUID REFERENCES growth_partners (id);
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- 8. Settings
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS nurture_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS partner_checkin_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_partner_checkin_days_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_partner_checkin_days_check CHECK (partner_checkin_days BETWEEN 7 AND 730);

ALTER TABLE growth_nurture_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_brevo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_partner_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_introductions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_nurture_steps, growth_lead_magnets, growth_brevo_events, growth_partners, growth_partner_checkins, growth_introductions FROM anon, authenticated;

COMMIT;
