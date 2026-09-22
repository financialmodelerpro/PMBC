-- 085_growth_settings.sql
-- Growth Engine settings and suppression list (Unit 1.4, 2026-09-22).
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run CREATE TABLE).
--
-- SAFE TO APPLY: any time, before or after the deploy of Unit 1.4. It creates
-- two tables, one helper function and three triggers, and inserts the one
-- settings row with its defaults. No existing table is changed; the valuation
-- tool's tables are only read, by the app. Until it is applied, the Settings
-- page says the tables are missing, the suppression check treats every email
-- as suppressed (it fails closed), and Growth Home lists both tables missing.
--
-- Idempotent: IF NOT EXISTS throughout, triggers dropped before they are
-- created, and the settings row inserted ON CONFLICT DO NOTHING.
--
-- SETTINGS
-- One row, `CHECK (id = 1)`, typed columns rather than a JSON blob so the
-- database refuses nonsense: a cap or budget of zero, a threshold outside 1 to
-- 100, a retention period under a month, a sending window that ends before it
-- starts, follow-up days that are not increasing. Every later unit reads its
-- limits from here and never hardcodes them.
--
-- The monthly AI budget has no default: it is null until Ahmad sets it, and
-- Unit 1.5 must refuse to spend while it is null.
--
-- Every change is logged to growth_activity by trigger, in the same statement,
-- as `settings.changed` with each changed field's old and new value and the
-- admin who made it. `last_change_is_test` marks a verifier's change so its log
-- rows are test rows; the admin screen always writes false.
--
-- SUPPRESSION
-- Emails and domains that must never be contacted. An entry is never deleted:
-- removing it records who, when and why, and keeps the row as history. Only
-- one live entry per email or domain. Adding and removing are logged by
-- trigger as `suppression.added` and `suppression.removed`.
--
-- The app's suppression check reads this table AND, live, the valuation
-- tool's unsubscribes and Growth contacts marked opted out or do not contact,
-- so a later unsubscribe is caught without waiting for an import.
--
-- ACCESS
-- As 083 and 084: RLS on with no policies, every privilege revoked from anon
-- and authenticated, is_test on the suppression table.

BEGIN;

-- True when every element is greater than the one before it.
CREATE OR REPLACE FUNCTION growth_is_increasing(arr INTEGER[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(bool_and(a < b), true)
  FROM (SELECT arr[i] AS a, arr[i + 1] AS b FROM generate_subscripts(arr, 1) AS i WHERE i < cardinality(arr)) AS pairs;
$$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  updated_by_name TEXT,
  last_change_is_test BOOLEAN NOT NULL DEFAULT false,

  -- Outreach limits. Days: 0 Sunday to 6 Saturday, in Saudi time.
  daily_cold_email_cap INTEGER NOT NULL DEFAULT 10 CHECK (daily_cold_email_cap BETWEEN 1 AND 500),
  send_timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh' CHECK (send_timezone = 'Asia/Riyadh'),
  send_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4}' CHECK (
    cardinality(send_days) BETWEEN 1 AND 7
    AND send_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
    AND growth_is_increasing(send_days)
  ),
  send_start TIME NOT NULL DEFAULT '09:00',
  send_end TIME NOT NULL DEFAULT '17:00',
  CONSTRAINT growth_settings_window CHECK (send_start < send_end),
  follow_up_days INTEGER[] NOT NULL DEFAULT '{4,10,20}' CHECK (
    cardinality(follow_up_days) BETWEEN 1 AND 10
    AND follow_up_days[1] >= 1
    AND follow_up_days[cardinality(follow_up_days)] <= 365
    AND growth_is_increasing(follow_up_days)
  ),
  max_follow_ups INTEGER NOT NULL DEFAULT 3 CHECK (max_follow_ups BETWEEN 0 AND 10),
  CONSTRAINT growth_settings_follow_ups_fit CHECK (max_follow_ups <= cardinality(follow_up_days)),

  -- AI budget. Enforced from Unit 1.5.
  ai_monthly_budget_usd NUMERIC(10, 2) CHECK (ai_monthly_budget_usd IS NULL OR (ai_monthly_budget_usd > 0 AND ai_monthly_budget_usd <= 100000)),
  ai_alert_threshold_pct INTEGER NOT NULL DEFAULT 80 CHECK (ai_alert_threshold_pct BETWEEN 1 AND 100),
  ai_alert_email TEXT NOT NULL DEFAULT 'ahmad.din@pacemakersglobal.com' CHECK (
    ai_alert_email = lower(btrim(ai_alert_email)) AND ai_alert_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),

  -- Retention for contacts who never replied. Preview only in this unit.
  retention_months INTEGER NOT NULL DEFAULT 12 CHECK (retention_months BETWEEN 1 AND 120)
);

INSERT INTO growth_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Log every change: each changed field with its old and new value.
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
    NEW.last_change_is_test,
    CASE WHEN NEW.updated_by IS NULL THEN 'system' ELSE 'admin' END,
    NEW.updated_by,
    'settings.changed',
    'Changed ' || (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(v_changes) AS k),
    jsonb_build_object('changes', v_changes, 'actor_name', NEW.updated_by_name)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_settings_updated_at ON growth_settings;
CREATE TRIGGER growth_settings_updated_at BEFORE UPDATE ON growth_settings
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();
DROP TRIGGER IF EXISTS growth_settings_log ON growth_settings;
CREATE TRIGGER growth_settings_log AFTER UPDATE ON growth_settings
  FOR EACH ROW EXECUTE FUNCTION growth_settings_log_change();

-- ---------------------------------------------------------------------------
-- Suppression list
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  kind TEXT NOT NULL CHECK (kind IN ('email', 'domain')),
  value TEXT NOT NULL CHECK (
    value = lower(btrim(value))
    AND (
      (kind = 'email' AND value ~ '^[^@[:space:]]+@[^@[:space:]]+$')
      OR (kind = 'domain' AND value ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$')
    )
  ),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'valuation_unsubscribe', 'growth_contact')),
  -- The record the entry came from: a tool lead id or a growth contact id.
  source_ref TEXT,
  added_by TEXT,
  added_by_name TEXT,

  removed_at TIMESTAMPTZ,
  removed_by TEXT,
  removed_by_name TEXT,
  removed_reason TEXT,
  CONSTRAINT growth_suppressions_removal_has_reason CHECK (
    removed_at IS NULL OR length(btrim(coalesce(removed_reason, ''))) > 0
  )
);

-- One live entry per email or domain; removed entries stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS growth_suppressions_live_key
  ON growth_suppressions (kind, value) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_growth_suppressions_value ON growth_suppressions (value);

-- An entry is never deleted outside test data, and never edited except to remove it once.
CREATE OR REPLACE FUNCTION growth_suppressions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT OLD.is_test THEN
      RAISE EXCEPTION 'growth_suppressions: entries are removed, not deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'growth_suppressions: a removed entry cannot be changed';
  END IF;
  IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.value IS DISTINCT FROM OLD.value
    OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    RAISE EXCEPTION 'growth_suppressions: only removal can change an entry';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_suppressions_guard ON growth_suppressions;
CREATE TRIGGER growth_suppressions_guard BEFORE UPDATE OR DELETE ON growth_suppressions
  FOR EACH ROW EXECUTE FUNCTION growth_suppressions_guard();

CREATE OR REPLACE FUNCTION growth_suppressions_log()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO growth_activity (is_test, actor_type, actor_id, action, summary, metadata)
    VALUES (
      NEW.is_test,
      CASE WHEN NEW.added_by IS NULL THEN 'system' ELSE 'admin' END,
      NEW.added_by,
      'suppression.added',
      'Suppressed ' || NEW.kind || ' ' || NEW.value || ': ' || NEW.reason,
      jsonb_build_object('suppression_id', NEW.id, 'kind', NEW.kind, 'value', NEW.value, 'source', NEW.source, 'source_ref', NEW.source_ref, 'actor_name', NEW.added_by_name)
    );
  ELSIF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    INSERT INTO growth_activity (is_test, actor_type, actor_id, action, summary, metadata)
    VALUES (
      NEW.is_test,
      CASE WHEN NEW.removed_by IS NULL THEN 'system' ELSE 'admin' END,
      NEW.removed_by,
      'suppression.removed',
      'Removed suppression of ' || NEW.kind || ' ' || NEW.value || ': ' || NEW.removed_reason,
      jsonb_build_object('suppression_id', NEW.id, 'kind', NEW.kind, 'value', NEW.value, 'actor_name', NEW.removed_by_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_suppressions_log ON growth_suppressions;
CREATE TRIGGER growth_suppressions_log AFTER INSERT OR UPDATE ON growth_suppressions
  FOR EACH ROW EXECUTE FUNCTION growth_suppressions_log();

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_settings, growth_suppressions FROM anon, authenticated;
-- growth_is_increasing stays executable: it is pure, and the CHECK constraints call it.
REVOKE ALL ON FUNCTION growth_settings_log_change(), growth_suppressions_guard(), growth_suppressions_log() FROM PUBLIC, anon, authenticated;

COMMIT;
