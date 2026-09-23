-- 094_growth_signal_keywords.sql
-- Growth Engine signal keyword library (2026-09-23): keywords grouped by
-- trigger type, each switchable on and off, and the keyword behind each
-- signal so its count can be shown. Also pauses the daily feed.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: any time after 093, before or after the deploy that adds the
-- library screens. It creates two Growth tables, adds two nullable columns to
-- growth_signals, and sets the real settings row's signal_feed_paused to true
-- (the change is logged with old and new values by the settings trigger). The
-- library itself is not seeded here: the code holds the defaults and uses
-- them until the first edit saves them, so there is one source of truth.
-- Until it is applied the feed keeps reading the old signal_keywords list,
-- which is empty, so it finds nothing.
--
-- Idempotent: IF NOT EXISTS throughout; the pause is a plain UPDATE that a
-- second run repeats harmlessly.
--
-- 1. growth_keyword_groups: one row per group, keyed by a short name, with its
--    region (ksa or gcc), default trigger and on/off switch.
-- 2. growth_signal_keywords: the keywords, each with its group, trigger type,
--    on/off switch and whether it came with the defaults. One keyword per
--    group, ignoring case.
-- 3. growth_signals.matched_keyword_id and matched_keyword: the keyword a
--    signal came from (the text is kept if the keyword is later removed).
-- 4. growth_settings row 1: signal_feed_paused = true, until Ahmad switches
--    the feed on.

BEGIN;

CREATE TABLE IF NOT EXISTS growth_keyword_groups (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  region TEXT NOT NULL CHECK (region IN ('ksa', 'gcc')),
  default_trigger TEXT CHECK (default_trigger IS NULL OR default_trigger IN (
    'new_project', 'fundraising_debt', 'off_plan_registration', 'market_entry',
    'finance_leadership_hire', 'contract_award', 'acquisition_jv',
    'capital_market_activity', 'expansion', 'other'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by_name TEXT
);

DROP TRIGGER IF EXISTS growth_keyword_groups_updated_at ON growth_keyword_groups;
CREATE TRIGGER growth_keyword_groups_updated_at BEFORE UPDATE ON growth_keyword_groups
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

CREATE TABLE IF NOT EXISTS growth_signal_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  group_key TEXT NOT NULL REFERENCES growth_keyword_groups (key) ON DELETE CASCADE,
  keyword TEXT NOT NULL CHECK (length(btrim(keyword)) BETWEEN 2 AND 120),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'new_project', 'fundraising_debt', 'off_plan_registration', 'market_entry',
    'finance_leadership_hire', 'contract_award', 'acquisition_jv',
    'capital_market_activity', 'expansion', 'other'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_signal_keywords_once ON growth_signal_keywords (group_key, lower(btrim(keyword)));
CREATE INDEX IF NOT EXISTS idx_growth_signal_keywords_group ON growth_signal_keywords (group_key, sort_order);

DROP TRIGGER IF EXISTS growth_signal_keywords_updated_at ON growth_signal_keywords;
CREATE TRIGGER growth_signal_keywords_updated_at BEFORE UPDATE ON growth_signal_keywords
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS matched_keyword_id UUID REFERENCES growth_signal_keywords (id) ON DELETE SET NULL;
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS matched_keyword TEXT;
CREATE INDEX IF NOT EXISTS idx_growth_signals_keyword ON growth_signals (matched_keyword_id) WHERE matched_keyword_id IS NOT NULL;

UPDATE growth_settings SET signal_feed_paused = true, updated_by = NULL, updated_by_name = 'Migration 094', last_change_is_test = false WHERE id = 1 AND signal_feed_paused = false;

ALTER TABLE growth_keyword_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_signal_keywords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_keyword_groups, growth_signal_keywords FROM anon, authenticated;

COMMIT;
