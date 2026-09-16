-- 077_tool_leads.sql
-- Leads from the free tools, and the event history behind each one.
--
-- SAFE TO APPLY: any time, before or after the free tools code is deployed.
--   Before the deploy nothing reads or writes these tables. After the deploy,
--   until it is applied, a submission still shows the visitor their results
--   (the lead API logs that it could not save), no email is sent because there
--   is no lead to attach it to, and the admin Tool leads screen says the
--   migration is missing.
--
-- DDL. Paste into the Supabase SQL editor by hand.
--
-- WHY NOT contact_submissions
-- An enquiry and a tool lead share a name, an email and a status workflow and
-- almost nothing else: a lead carries the full inputs and computed results as
-- JSONB, consent records, attribution, and email delivery state, and has no
-- message. `tool_slug` lets every future tool use the same table.
--
-- tool_leads
--   is_test          true for submissions made by signed-in staff in Admin
--                    preview. Excluded from every count by default.
--   data_version     VALUATION_DATA_VERSION at the time. `results` is what the
--                    visitor was shown and emailed, computed on the server, and
--                    is never recomputed later with newer data.
--   equity_*, wacc   copied out of `results` so the list can sort and filter
--                    without reading JSON.
--   consent_*        the required consent, with the exact wording agreed to.
--   follow_up_*      the optional consent to follow-up email.
--   ip_hash          SHA-256 of the IP with a server secret. The raw IP is never
--                    stored. Used for rate limiting only.
--   access_token     random, unguessable. Identifies the lead in the booking
--                    link so a click can be attributed without exposing the id.
--   email_* / alert_*  delivery state of the results email and the internal
--                    alert. `email_status` is the latest meaningful state, set
--                    by the send and then by Brevo webhook events.
--
-- tool_lead_events
--   One row per thing that happened to a lead after it was saved: the email
--   sent or failed, each Brevo event, each booking click, an admin resend.
--   `dedupe_key` is unique so a webhook Brevo retries is recorded once.
--
-- RLS on with no policies: service role only.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS tool_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tool_slug TEXT NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT false,
  data_version TEXT NOT NULL,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  purpose TEXT,
  deal_size_band TEXT,
  below_minimum BOOLEAN NOT NULL DEFAULT false,
  country TEXT,
  currency TEXT,
  industry TEXT,

  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  equity_low NUMERIC,
  equity_mid NUMERIC,
  equity_high NUMERIC,
  wacc NUMERIC,

  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  consent_text TEXT,
  follow_up_consent BOOLEAN NOT NULL DEFAULT false,
  follow_up_consent_at TIMESTAMPTZ,

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_path TEXT,
  ip_hash TEXT,
  user_agent TEXT,

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  notes TEXT,
  access_token TEXT NOT NULL UNIQUE,

  email_status TEXT NOT NULL DEFAULT 'pending',
  email_message_id TEXT,
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  email_last_event_at TIMESTAMPTZ,
  alert_status TEXT NOT NULL DEFAULT 'pending',
  alert_message_id TEXT,
  alert_error TEXT,

  booking_clicks INTEGER NOT NULL DEFAULT 0,
  last_booking_click_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tool_leads_created ON tool_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_leads_tool ON tool_leads (tool_slug, is_test, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_leads_ip ON tool_leads (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_leads_email_msg ON tool_leads (email_message_id);
CREATE INDEX IF NOT EXISTS idx_tool_leads_alert_msg ON tool_leads (alert_message_id);

CREATE TABLE IF NOT EXISTS tool_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES tool_leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('brevo', 'results', 'email', 'admin', 'system')),
  email_kind TEXT CHECK (email_kind IN ('results', 'alert')),
  message_id TEXT,
  link TEXT,
  detail TEXT,
  payload JSONB,
  dedupe_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_tool_lead_events_lead ON tool_lead_events (lead_id, occurred_at DESC);

ALTER TABLE tool_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_lead_events ENABLE ROW LEVEL SECURITY;

COMMIT;
