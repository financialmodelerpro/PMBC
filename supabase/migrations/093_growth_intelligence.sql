-- 093_growth_intelligence.sql
-- Growth Engine Phase 7, Intelligence (Units 7.1 to 7.3, 2026-09-23): the
-- record of each scoring review and Ahmad's decision on it. The Daily Brief
-- and Analytics are computed from existing tables and need no new storage.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 092, and before or after the deploy of any Phase 7
-- unit. It creates one Growth table; nothing else changes. Until it is applied
-- the scoring review can be run and read but not saved or approved, and no
-- weights change. The Daily Brief and Analytics work either way.
--
-- Idempotent: IF NOT EXISTS throughout.
--
-- growth_scoring_reviews: one row per review of the Prospect Score or the
-- Lead Score against real outcomes: the sample, the weights in force, the
-- suggested weights, the analysis behind them, and the decision (pending,
-- approved or rejected, by whom, when, with a note). Suggested weights sum to
-- 100, checked with the functions from 088 and 089. Weights change only when
-- Ahmad approves, and that change is logged by the settings trigger.
--
-- ACCESS
-- As 083 to 092: RLS on with no policies, every privilege revoked from anon
-- and authenticated.

BEGIN;

CREATE TABLE IF NOT EXISTS growth_scoring_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('prospect', 'lead')),
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  positives INTEGER NOT NULL CHECK (positives >= 0),
  negatives INTEGER NOT NULL CHECK (negatives >= 0),
  current_weights JSONB NOT NULL,
  suggested_weights JSONB NOT NULL,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(analysis) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_at TIMESTAMPTZ,
  decided_by_name TEXT,
  decision_note TEXT,
  created_by_name TEXT,
  CONSTRAINT growth_scoring_reviews_weights_ok CHECK (
    (kind = 'prospect' AND growth_scoring_weights_ok(suggested_weights)) OR (kind = 'lead' AND growth_lead_weights_ok(suggested_weights))
  ),
  CONSTRAINT growth_scoring_reviews_decision CHECK (status = 'pending' OR decided_at IS NOT NULL),
  CONSTRAINT growth_scoring_reviews_rejection_reason CHECK (status <> 'rejected' OR length(btrim(coalesce(decision_note, ''))) > 0)
);

CREATE INDEX IF NOT EXISTS idx_growth_scoring_reviews_created ON growth_scoring_reviews (created_at DESC);

ALTER TABLE growth_scoring_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_scoring_reviews FROM anon, authenticated;

COMMIT;
