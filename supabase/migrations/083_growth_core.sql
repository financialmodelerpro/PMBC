-- 083_growth_core.sql
-- Growth Engine core data layer (Unit 1.2, 2026-09-22): companies, contacts,
-- signals, leads and an append-only activity log.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run CREATE TABLE).
--
-- SAFE TO APPLY: any time, before or after the deploy of Unit 1.2. It only
-- creates five new tables, two trigger functions and their triggers; no
-- existing table is touched. Until it is applied, Growth Home says the data
-- layer is not ready and names the missing tables, and nothing else reads
-- them, so the site builds and runs unchanged in the gap.
--
-- Idempotent: every statement is IF NOT EXISTS, CREATE OR REPLACE, or drops
-- its trigger first, so a second run changes nothing.
--
-- ACCESS
-- RLS on with no policies (default deny), as every table since 013: only the
-- service role, which the server uses, can read or write. In addition, every
-- privilege is revoked from `anon` and `authenticated`, so the public anon key
-- is refused at the grant level before RLS is even consulted.
--
-- TEST DATA
-- Every table carries `is_test`. Vercel previews and local runs use this
-- production database, so anything created while testing is flagged and can be
-- found and removed without touching real records.
--
-- VALUE LISTS
-- The CHECK lists below are mirrored in src/lib/growth/model.ts, and
-- `npm run verify-growth-data` fails if the two drift. Change both together.
--
-- MINIMUM DEAL SIZE
-- `growth_leads.below_minimum` is generated from `deal_size_sar` against SAR
-- 50,000,000, so the flag can never disagree with the amount. A lead with no
-- deal size is not flagged. Changing the minimum needs a migration and the
-- matching constant in model.ts.
--
-- DE-DUPLICATION
-- Companies are unique by website domain and contacts by email, both stored
-- normalised (lower case; a domain without scheme, www or path) and enforced
-- by a CHECK, so the unique index cannot be dodged by casing or a prefix.

BEGIN;

-- updated_at, maintained by the database so no caller can forget it.
CREATE OR REPLACE FUNCTION growth_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  website_domain TEXT CHECK (
    website_domain IS NULL OR (
      website_domain = lower(btrim(website_domain))
      AND website_domain !~ '^(https?://|www\.)'
      AND position('/' IN website_domain) = 0
      AND length(website_domain) > 0
    )
  ),
  sector TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Saudi Arabia',
  description TEXT,
  linkedin_url TEXT,
  likely_service TEXT CHECK (likely_service IN (
    'financial_modeling', 'business_valuation', 'ma_modeling',
    'real_estate_modeling', 'feasibility_study', 'financial_due_diligence'
  )),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'researching', 'qualified', 'client', 'disqualified', 'archived'
  )),
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_companies_domain_key
  ON growth_companies (website_domain) WHERE website_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_companies_status ON growth_companies (status, is_test);

DROP TRIGGER IF EXISTS growth_companies_updated_at ON growth_companies;
CREATE TRIGGER growth_companies_updated_at BEFORE UPDATE ON growth_companies
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  company_id UUID REFERENCES growth_companies (id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  role_title TEXT,
  email TEXT CHECK (email IS NULL OR (email = lower(btrim(email)) AND position('@' IN email) > 1)),
  phone TEXT,
  linkedin_url TEXT,
  is_decision_maker BOOLEAN NOT NULL DEFAULT false,
  consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (consent_status IN (
    'unknown', 'legitimate_interest', 'opted_in', 'opted_out', 'do_not_contact'
  )),
  consent_source TEXT,
  consent_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_contacts_email_key
  ON growth_contacts (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_contacts_company ON growth_contacts (company_id);

DROP TRIGGER IF EXISTS growth_contacts_updated_at ON growth_contacts;
CREATE TRIGGER growth_contacts_updated_at BEFORE UPDATE ON growth_contacts
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads: one lifecycle record per opportunity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  company_id UUID REFERENCES growth_companies (id) ON DELETE SET NULL,
  contact_id UUID REFERENCES growth_contacts (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),

  stage TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN (
    'prospect', 'contacted', 'replied', 'qualified', 'meeting_booked',
    'opportunity', 'proposal', 'won', 'lost', 'nurture'
  )),
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  prospect_score SMALLINT CHECK (prospect_score BETWEEN 0 AND 100),
  prospect_band TEXT CHECK (prospect_band IN ('priority', 'good', 'watch', 'low')),
  lead_score SMALLINT CHECK (lead_score BETWEEN 0 AND 100),
  lead_temperature TEXT CHECK (lead_temperature IN ('hot', 'warm', 'cold')),
  -- Written reasons behind the scores: a JSON array of strings.
  score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(score_reasons) = 'array'),
  score_override BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  CONSTRAINT growth_leads_override_needs_reason CHECK (
    NOT score_override OR length(btrim(coalesce(override_reason, ''))) > 0
  ),

  recommended_service TEXT CHECK (recommended_service IN (
    'financial_modeling', 'business_valuation', 'ma_modeling',
    'real_estate_modeling', 'feasibility_study', 'financial_due_diligence'
  )),
  requirement TEXT,
  deal_size_sar NUMERIC CHECK (deal_size_sar >= 0),
  below_minimum BOOLEAN GENERATED ALWAYS AS (
    deal_size_sar IS NOT NULL AND deal_size_sar < 50000000
  ) STORED,
  timeline TEXT,

  source TEXT NOT NULL CHECK (source IN (
    'outbound', 'website', 'referral', 'partner', 'tool', 'pilot', 'other'
  )),
  -- Where the source record lives, e.g. a tool_leads id or a referrer's name.
  source_ref TEXT,

  next_action TEXT,
  next_action_due DATE,
  lost_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_leads_stage ON growth_leads (stage, is_test);
CREATE INDEX IF NOT EXISTS idx_growth_leads_company ON growth_leads (company_id);
CREATE INDEX IF NOT EXISTS idx_growth_leads_contact ON growth_leads (contact_id);
CREATE INDEX IF NOT EXISTS idx_growth_leads_next_action ON growth_leads (next_action_due) WHERE next_action_due IS NOT NULL;

DROP TRIGGER IF EXISTS growth_leads_updated_at ON growth_leads;
CREATE TRIGGER growth_leads_updated_at BEFORE UPDATE ON growth_leads
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- Signals: trigger events, which may arrive before their company exists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  company_id UUID REFERENCES growth_companies (id) ON DELETE SET NULL,
  -- The company as the source names it, kept even after company_id is set.
  company_name TEXT,
  CONSTRAINT growth_signals_names_a_company CHECK (
    company_id IS NOT NULL OR length(btrim(coalesce(company_name, ''))) > 0
  ),
  lead_id UUID REFERENCES growth_leads (id) ON DELETE SET NULL,

  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'new_project', 'fundraising_debt', 'off_plan_registration', 'market_entry',
    'finance_leadership_hire', 'contract_award', 'acquisition_jv',
    'capital_market_activity', 'expansion', 'other'
  )),
  signal_date DATE NOT NULL,
  summary TEXT NOT NULL CHECK (length(btrim(summary)) > 0),
  evidence_url TEXT NOT NULL CHECK (evidence_url ~* '^https?://[^[:space:]]+$'),
  source_name TEXT,

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'converted', 'attached', 'dismissed')),
  dismissed_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_signals_status ON growth_signals (status, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_growth_signals_company ON growth_signals (company_id);

DROP TRIGGER IF EXISTS growth_signals_updated_at ON growth_signals;
CREATE TRIGGER growth_signals_updated_at BEFORE UPDATE ON growth_signals
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity: append-only timeline across companies, contacts, leads, signals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  -- Plain references: a record with history cannot be deleted out from under
  -- its log. Remove the (test) activity first.
  company_id UUID REFERENCES growth_companies (id),
  contact_id UUID REFERENCES growth_contacts (id),
  lead_id UUID REFERENCES growth_leads (id),
  signal_id UUID REFERENCES growth_signals (id),

  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'system', 'ai')),
  -- The admin user id, or the name of the job or AI agent.
  actor_id TEXT,
  action TEXT NOT NULL CHECK (length(btrim(action)) > 0),
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_growth_activity_company ON growth_activity (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_activity_contact ON growth_activity (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_activity_lead ON growth_activity (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_activity_signal ON growth_activity (signal_id, created_at DESC);

-- Append-only: no row is ever updated, and only test rows may be deleted.
CREATE OR REPLACE FUNCTION growth_activity_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'growth_activity is append-only: rows cannot be updated';
  END IF;
  IF TG_OP = 'DELETE' AND NOT OLD.is_test THEN
    RAISE EXCEPTION 'growth_activity is append-only: only test rows can be deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS growth_activity_no_update ON growth_activity;
CREATE TRIGGER growth_activity_no_update BEFORE UPDATE OR DELETE ON growth_activity
  FOR EACH ROW EXECUTE FUNCTION growth_activity_append_only();

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_activity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE growth_companies, growth_contacts, growth_leads, growth_signals, growth_activity FROM anon, authenticated;
REVOKE ALL ON FUNCTION growth_set_updated_at(), growth_activity_append_only() FROM PUBLIC, anon, authenticated;

COMMIT;
