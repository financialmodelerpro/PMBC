-- 087_growth_ai_usage.sql
-- Growth Engine AI layer (Unit 1.5, 2026-09-22): a record of every AI call,
-- the monthly budget alert, and an isolated settings row for verification.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: after 086, and before or after the deploy of Unit 1.5. It
-- creates two tables and their triggers, and widens growth_settings to allow
-- one test row. No row outside the Growth tables is touched and the real
-- settings row is not changed. Until it is applied, every AI call is refused
-- (the layer cannot record it, and an unrecorded call is never made), Settings
-- shows spend as unavailable, and Growth Home lists both tables missing.
--
-- Idempotent: IF NOT EXISTS throughout, constraints and triggers dropped
-- before they are re-created.
--
-- 1. growth_ai_usage: one row per call the layer handles, including calls it
--    refuses and calls that fail, with agent, provider, model, mock or real,
--    tokens, cost in USD, the related company, lead or Knowledge Base item,
--    outcome and is_test. A trigger writes each one to growth_activity with
--    actor type 'ai', so the audit log's AI filter shows every call.
--    created_at defaults to clock_timestamp() so rows keep their order.
-- 2. growth_ai_alerts: one row per month (Riyadh) whose spend crossed the
--    alert threshold. The unique key on (month, is_test) is the guarantee that
--    a month's alert is sent once: the layer claims the month by inserting
--    first, and only the claim that succeeds sends. A failed send deletes its
--    claim so the next call can try again.
-- 3. growth_settings may hold a second row, id 2, marked is_test, used only by
--    verifiers. Row 1 stays the one real settings row and is never test.
--    The 085 logging trigger marks a change to row 2 as a test change.
--
-- ACCESS
-- As 083 to 086: RLS on with no policies, every privilege revoked from anon
-- and authenticated.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  agent TEXT NOT NULL CHECK (length(btrim(agent)) > 0),
  provider TEXT NOT NULL CHECK (provider IN ('mock', 'anthropic')),
  is_mock BOOLEAN NOT NULL,
  CONSTRAINT growth_ai_usage_mock_matches_provider CHECK (is_mock = (provider = 'mock')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  CONSTRAINT growth_ai_usage_mock_is_free CHECK (NOT is_mock OR cost_usd = 0),

  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'refused')),
  -- Why a call was refused or failed, in plain words. Never a prompt or a key.
  reason TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),

  company_id UUID REFERENCES growth_companies (id),
  lead_id UUID REFERENCES growth_leads (id),
  kb_item_id UUID REFERENCES growth_kb_items (id)
);

CREATE INDEX IF NOT EXISTS idx_growth_ai_usage_month ON growth_ai_usage (is_test, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_ai_usage_agent ON growth_ai_usage (agent, created_at DESC);

CREATE OR REPLACE FUNCTION growth_ai_usage_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO growth_activity (is_test, company_id, lead_id, kb_item_id, actor_type, actor_id, action, summary, metadata)
  VALUES (
    NEW.is_test,
    NEW.company_id,
    NEW.lead_id,
    NEW.kb_item_id,
    'ai',
    NEW.agent,
    'ai.' || CASE NEW.status WHEN 'succeeded' THEN 'call' WHEN 'failed' THEN 'failed' ELSE 'refused' END,
    CASE NEW.status
      WHEN 'succeeded' THEN (CASE WHEN NEW.is_mock THEN 'Mock AI call by ' ELSE 'AI call by ' END) || NEW.agent || ' (' || NEW.model || ', USD ' || to_char(NEW.cost_usd, 'FM999990.000000') || ')'
      WHEN 'failed' THEN 'AI call by ' || NEW.agent || ' failed: ' || coalesce(NEW.reason, 'unknown error')
      ELSE 'AI call by ' || NEW.agent || ' refused: ' || coalesce(NEW.reason, 'refused')
    END,
    jsonb_build_object('usage_id', NEW.id, 'provider', NEW.provider, 'mock', NEW.is_mock, 'model', NEW.model,
      'input_tokens', NEW.input_tokens, 'output_tokens', NEW.output_tokens, 'cost_usd', NEW.cost_usd, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_ai_usage_log ON growth_ai_usage;
CREATE TRIGGER growth_ai_usage_log AFTER INSERT ON growth_ai_usage
  FOR EACH ROW EXECUTE FUNCTION growth_ai_usage_log();

-- ---------------------------------------------------------------------------
-- 2. Monthly alert, once per month
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_ai_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  -- The Riyadh calendar month, YYYY-MM.
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  threshold_pct INTEGER NOT NULL CHECK (threshold_pct BETWEEN 1 AND 100),
  budget_usd NUMERIC(10, 2) NOT NULL CHECK (budget_usd > 0),
  spent_usd NUMERIC(12, 6) NOT NULL CHECK (spent_usd >= 0),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent')),
  sent_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_ai_alerts_once_a_month ON growth_ai_alerts (month, is_test);

CREATE OR REPLACE FUNCTION growth_ai_alerts_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' THEN
    INSERT INTO growth_activity (is_test, actor_type, actor_id, action, summary, metadata)
    VALUES (
      NEW.is_test, 'system', 'ai-budget', 'ai.budget_alert',
      'AI spend for ' || NEW.month || ' reached ' || NEW.threshold_pct || '% of the budget (USD '
        || to_char(NEW.spent_usd, 'FM999990.00') || ' of USD ' || to_char(NEW.budget_usd, 'FM999990.00') || '); alert sent to ' || NEW.recipient,
      jsonb_build_object('month', NEW.month, 'threshold_pct', NEW.threshold_pct, 'spent_usd', NEW.spent_usd, 'budget_usd', NEW.budget_usd)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_ai_alerts_log ON growth_ai_alerts;
CREATE TRIGGER growth_ai_alerts_log AFTER UPDATE ON growth_ai_alerts
  FOR EACH ROW EXECUTE FUNCTION growth_ai_alerts_log();

-- ---------------------------------------------------------------------------
-- 3. An isolated test settings row
-- ---------------------------------------------------------------------------
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_id_check;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_one_real_row;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_one_real_row CHECK (
  (id = 1 AND NOT is_test) OR (id = 2 AND is_test)
);

-- A change to the test row is always logged as a test change.
CREATE OR REPLACE FUNCTION growth_settings_log_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old JSONB := to_jsonb(OLD) - ARRAY['updated_at', 'updated_by', 'updated_by_name', 'last_change_is_test'];
  v_new JSONB := to_jsonb(NEW) - ARRAY['updated_at', 'updated_by', 'updated_by_name', 'last_change_is_test'];
  v_changes JSONB := '{}'::jsonb;
  v_key TEXT;
BEGIN
  FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
    IF v_new -> v_key IS DISTINCT FROM v_old -> v_key THEN
      v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
    END IF;
  END LOOP;
  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;
  INSERT INTO growth_activity (is_test, actor_type, actor_id, action, summary, metadata)
  VALUES (
    NEW.last_change_is_test OR NEW.is_test,
    CASE WHEN NEW.updated_by IS NULL THEN 'system' ELSE 'admin' END,
    NEW.updated_by,
    'settings.changed',
    'Changed ' || (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(v_changes) AS k),
    jsonb_build_object('changes', v_changes, 'actor_name', NEW.updated_by_name, 'settings_row', NEW.id)
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_ai_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_ai_usage, growth_ai_alerts FROM anon, authenticated;
REVOKE ALL ON FUNCTION growth_ai_usage_log(), growth_ai_alerts_log(), growth_settings_log_change() FROM PUBLIC, anon, authenticated;

COMMIT;
