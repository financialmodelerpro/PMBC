-- 088_growth_prospecting.sql
-- Growth Engine Phase 2, Prospecting (Units 2.1 to 2.6, 2026-09-23): signal
-- triage, prospect scores, research briefs, the daily signal feed, pilot
-- imports and the settings they read.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 087, and before or after the deploy of any Phase 2
-- unit. It only adds columns with defaults to Growth tables and creates three
-- new Growth tables; no table outside Growth is touched and no existing row
-- changes meaning. Until it is applied, the Phase 2 screens show a migration
-- notice, signals can still be added and triaged without origin or duplicate
-- detail, scores are shown but not stored, and research, the signal feed and
-- imports refuse to run. Nothing is sent or spent in the gap.
--
-- Idempotent: IF NOT EXISTS throughout, constraints and triggers dropped
-- before they are re-created.
--
-- WHAT CHANGES
-- 1. growth_signals: origin (manual, feed or import), evidence_key (the
--    evidence link normalised, for duplicate detection), duplicate_of, who
--    triaged it and when, the feed run that found it, and a dismissal must
--    give a reason.
-- 2. growth_companies: source, scale_sar (known project or deal size, SAR),
--    and the Prospect Score: computed_score (always the rules' answer),
--    prospect_score and prospect_band (the effective score, which an override
--    replaces), score_reasons, score_override with a required reason, and
--    scored_at.
-- 3. growth_research_briefs: every Research Agent brief, kept as history.
--    A mock brief can never be accepted into a profile (by constraint).
-- 4. growth_feed_runs: one row per signal feed run. The unique key on
--    (run_date, is_test) for scheduled runs means the morning job runs once a
--    Riyadh day even if the cron fires twice.
-- 5. growth_imports: one row per pilot CSV import; the companies, contacts
--    and leads it created point back to it.
-- 6. growth_settings: signal_keywords, signal_feed_paused,
--    signal_feed_max_per_run, scoring_weights (seven factors summing to 100,
--    checked by the database) and agent_models (per-agent model overrides).
--    Changes are logged with old and new values by the 087 settings trigger.
--
-- ACCESS
-- As 083 to 087: RLS on with no policies, every privilege revoked from anon
-- and authenticated.

BEGIN;

-- ---------------------------------------------------------------------------
-- 4 first: feed runs, which signals reference
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_feed_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  -- The Riyadh calendar day the run belongs to.
  run_date DATE NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('real', 'mock_preview')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'refused', 'failed')),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  found INTEGER NOT NULL DEFAULT 0 CHECK (found >= 0),
  saved INTEGER NOT NULL DEFAULT 0 CHECK (saved >= 0),
  duplicates INTEGER NOT NULL DEFAULT 0 CHECK (duplicates >= 0),
  discarded INTEGER NOT NULL DEFAULT 0 CHECK (discarded >= 0),
  usage_id UUID REFERENCES growth_ai_usage (id),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  finished_at TIMESTAMPTZ,
  created_by_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_feed_runs_once_a_day
  ON growth_feed_runs (run_date, is_test) WHERE trigger = 'cron';
CREATE INDEX IF NOT EXISTS idx_growth_feed_runs_created ON growth_feed_runs (created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Imports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  filename TEXT,
  created_by_name TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0 CHECK (rows_total >= 0),
  companies_created INTEGER NOT NULL DEFAULT 0,
  contacts_created INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  activities_created INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  suppressed INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(errors) = 'array'),
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES growth_imports (id) ON DELETE SET NULL;
ALTER TABLE growth_contacts ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES growth_imports (id) ON DELETE SET NULL;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES growth_imports (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 1. Signals
-- ---------------------------------------------------------------------------
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE growth_signals DROP CONSTRAINT IF EXISTS growth_signals_origin_check;
ALTER TABLE growth_signals ADD CONSTRAINT growth_signals_origin_check CHECK (origin IN ('manual', 'feed', 'import'));
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS evidence_key TEXT;
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES growth_signals (id) ON DELETE SET NULL;
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ;
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS triaged_by_name TEXT;
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS feed_run_id UUID REFERENCES growth_feed_runs (id) ON DELETE SET NULL;
ALTER TABLE growth_signals DROP CONSTRAINT IF EXISTS growth_signals_dismissal_needs_reason;
ALTER TABLE growth_signals ADD CONSTRAINT growth_signals_dismissal_needs_reason CHECK (
  status <> 'dismissed' OR length(btrim(coalesce(dismissed_reason, ''))) > 0
) NOT VALID;
ALTER TABLE growth_signals DROP CONSTRAINT IF EXISTS growth_signals_not_own_duplicate;
ALTER TABLE growth_signals ADD CONSTRAINT growth_signals_not_own_duplicate CHECK (duplicate_of IS NULL OR duplicate_of <> id);

CREATE INDEX IF NOT EXISTS idx_growth_signals_evidence_key ON growth_signals (evidence_key) WHERE evidence_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_signals_created ON growth_signals (created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Companies: source, scale and the Prospect Score
-- ---------------------------------------------------------------------------
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE growth_companies DROP CONSTRAINT IF EXISTS growth_companies_source_check;
ALTER TABLE growth_companies ADD CONSTRAINT growth_companies_source_check CHECK (
  source IS NULL OR source IN ('outbound', 'website', 'referral', 'partner', 'tool', 'pilot', 'other')
);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS scale_sar NUMERIC CHECK (scale_sar IS NULL OR scale_sar >= 0);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS computed_score SMALLINT CHECK (computed_score IS NULL OR computed_score BETWEEN 0 AND 100);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS prospect_score SMALLINT CHECK (prospect_score IS NULL OR prospect_score BETWEEN 0 AND 100);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS prospect_band TEXT;
ALTER TABLE growth_companies DROP CONSTRAINT IF EXISTS growth_companies_prospect_band_check;
ALTER TABLE growth_companies ADD CONSTRAINT growth_companies_prospect_band_check CHECK (
  prospect_band IS NULL OR prospect_band IN ('priority', 'good', 'watch', 'low')
);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE growth_companies DROP CONSTRAINT IF EXISTS growth_companies_score_reasons_array;
ALTER TABLE growth_companies ADD CONSTRAINT growth_companies_score_reasons_array CHECK (jsonb_typeof(score_reasons) = 'array');
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS score_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE growth_companies DROP CONSTRAINT IF EXISTS growth_companies_override_needs_reason;
ALTER TABLE growth_companies ADD CONSTRAINT growth_companies_override_needs_reason CHECK (
  NOT score_override OR length(btrim(coalesce(override_reason, ''))) > 0
);
ALTER TABLE growth_companies ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_growth_companies_band ON growth_companies (prospect_band, is_test);

-- ---------------------------------------------------------------------------
-- 3. Research briefs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  company_id UUID NOT NULL REFERENCES growth_companies (id),
  is_mock BOOLEAN NOT NULL,
  model TEXT NOT NULL,
  usage_id UUID REFERENCES growth_ai_usage (id),
  -- The structured brief: every fact with its source link, unknowns as unknown.
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  -- The fields Ahmad accepted into the profile, e.g. ["description", "sector"].
  accepted JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(accepted) = 'array'),
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  created_by_name TEXT,
  CONSTRAINT growth_research_briefs_mock_never_accepted CHECK (NOT is_mock OR jsonb_array_length(accepted) = 0)
);

CREATE INDEX IF NOT EXISTS idx_growth_research_briefs_company ON growth_research_briefs (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Settings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION growth_scoring_weights_ok(w JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_typeof(w) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(w)) = 7
    AND w ?& ARRAY['geography', 'sector', 'project_signal', 'funding_signal', 'scale', 'decision_maker', 'recency']
    AND (SELECT bool_and(jsonb_typeof(v) = 'number' AND (v)::text ~ '^[0-9]+$' AND (v)::text::int BETWEEN 0 AND 100) FROM jsonb_each(w) AS e(k, v))
    AND (SELECT sum((v)::text::int) FROM jsonb_each(w) AS e(k, v)) = 100;
$$;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_keywords TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_keywords_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_keywords_check CHECK (cardinality(signal_keywords) <= 50);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_max_per_run INTEGER NOT NULL DEFAULT 10;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_feed_max_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_feed_max_check CHECK (signal_feed_max_per_run BETWEEN 1 AND 50);
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS scoring_weights JSONB NOT NULL DEFAULT
  '{"geography": 10, "sector": 15, "project_signal": 20, "funding_signal": 20, "scale": 15, "decision_maker": 10, "recency": 10}'::jsonb;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_scoring_weights_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_scoring_weights_check CHECK (growth_scoring_weights_ok(scoring_weights));
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS agent_models JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_agent_models_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_agent_models_check CHECK (jsonb_typeof(agent_models) = 'object');

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_feed_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_research_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_feed_runs, growth_imports, growth_research_briefs FROM anon, authenticated;
REVOKE ALL ON FUNCTION growth_scoring_weights_ok(JSONB) FROM PUBLIC, anon, authenticated;

COMMIT;
