-- 084_growth_knowledge_base.sql
-- Growth Engine Knowledge Base (Unit 1.3, 2026-09-22), and reliable ordering
-- for the activity log.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run CREATE TABLE).
--
-- SAFE TO APPLY: any time, before or after the deploy of Unit 1.3. It creates
-- one table and its triggers, adds two columns to growth_activity (migration
-- 083) and inserts ten empty drafts. No table outside the Growth Engine is
-- changed. Until it is applied, the Knowledge Base page says the table is
-- missing and offers nothing to edit, the approved-content reader returns
-- nothing, and Growth Home lists the table as missing.
--
-- Idempotent: IF NOT EXISTS throughout, triggers dropped before they are
-- created, and the drafts inserted ON CONFLICT DO NOTHING.
--
-- 1. ACTIVITY ORDER
-- 083 defaulted growth_activity.created_at to NOW(), the transaction time, so
-- rows written by one statement or one transaction shared a timestamp and had
-- no defined order. The default becomes clock_timestamp(), and a `seq` identity
-- column gives a strict insertion order. Order a timeline by (created_at, seq).
--
-- 2. KNOWLEDGE BASE
-- One table, `growth_kb_items`, for every kind of approved knowledge. The
-- fields of each kind live in `content` (JSON), validated by the admin API
-- against src/lib/growth/knowledge.ts, so a new field needs no migration.
--
-- Approval keeps two copies. `title` and `content` are the working copy the
-- admin edits. `approved_title` and `approved_content` are what was last
-- approved, and are the only copy any AI agent reads. Editing an approved item
-- changes the working copy only; the approved copy stands until the edit is
-- approved, so an agent never reads half-edited content. `status` is the
-- lifecycle: draft (never approved), approved, archived.
--
-- LOGGING
-- Triggers write growth_activity in the same statement as the change, so a
-- change cannot happen unlogged: created, approved, edited while approved,
-- archived and restored. The admin API sets `updated_by` and
-- `updated_by_name` on every write; the trigger records them as the actor.
--
-- 3. STARTER DRAFTS
-- The six Growth services and four entry offers, as empty drafts that are not
-- test rows. Five services are mapped to their public site service; Feasibility
-- Studies is left unmapped for Ahmad to choose. No content is written: nothing
-- here states a PMBC fact or claim.
--
-- ACCESS
-- As 083: RLS on with no policies, every privilege revoked from anon and
-- authenticated, is_test on the table.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Activity order
-- ---------------------------------------------------------------------------
ALTER TABLE growth_activity ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE growth_activity ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE INDEX IF NOT EXISTS idx_growth_activity_order ON growth_activity (created_at, seq);

-- ---------------------------------------------------------------------------
-- 2. Knowledge Base
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_kb_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT false,

  kind TEXT NOT NULL CHECK (kind IN (
    'service', 'offer', 'case_study', 'credential', 'faq', 'messaging',
    'disallowed', 'qualification', 'escalation', 'targeting'
  )),
  -- A stable key for items the system refers to: the Growth service value for
  -- a service, the offer key for an entry offer. Null for everything else.
  item_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Working copy.
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  content JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),

  -- Links. A service's related public site service (config/services.ts slug),
  -- and a case study's existing record, never a copy of it.
  site_service_slug TEXT,
  case_study_id UUID REFERENCES case_studies (id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),

  -- Approved copy: the only thing AI agents read.
  approved_title TEXT,
  approved_content JSONB CHECK (approved_content IS NULL OR jsonb_typeof(approved_content) = 'object'),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_by_name TEXT,
  CONSTRAINT growth_kb_approved_has_copy CHECK (
    status <> 'approved' OR (approved_title IS NOT NULL AND approved_content IS NOT NULL AND approved_at IS NOT NULL)
  ),

  updated_by TEXT,
  updated_by_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS growth_kb_items_key
  ON growth_kb_items (kind, item_key) WHERE item_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_kb_items_kind ON growth_kb_items (kind, status, sort_order);

DROP TRIGGER IF EXISTS growth_kb_items_updated_at ON growth_kb_items;
CREATE TRIGGER growth_kb_items_updated_at BEFORE UPDATE ON growth_kb_items
  FOR EACH ROW EXECUTE FUNCTION growth_set_updated_at();

ALTER TABLE growth_activity ADD COLUMN IF NOT EXISTS kb_item_id UUID REFERENCES growth_kb_items (id);
CREATE INDEX IF NOT EXISTS idx_growth_activity_kb ON growth_activity (kb_item_id, created_at DESC);

-- Every change that matters to an agent is logged in the same statement.
CREATE OR REPLACE FUNCTION growth_kb_log_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_summary TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'kb.created';
    v_summary := 'Created ' || NEW.kind || ': ' || NEW.title;
  ELSIF NEW.approved_at IS DISTINCT FROM OLD.approved_at AND NEW.status = 'approved' THEN
    v_action := 'kb.approved';
    v_summary := 'Approved ' || NEW.kind || ': ' || NEW.approved_title;
  ELSIF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
    v_action := 'kb.archived';
    v_summary := 'Archived ' || NEW.kind || ': ' || NEW.title;
  ELSIF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
    v_action := 'kb.restored';
    v_summary := 'Restored ' || NEW.kind || ': ' || NEW.title;
  ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
    AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.site_service_slug IS DISTINCT FROM OLD.site_service_slug
      OR NEW.case_study_id IS DISTINCT FROM OLD.case_study_id) THEN
    v_action := 'kb.edited_approved';
    v_summary := 'Edited approved ' || NEW.kind || ': ' || NEW.title || ' (approved copy unchanged until re-approved)';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO growth_activity (is_test, kb_item_id, actor_type, actor_id, action, summary, metadata)
  VALUES (
    NEW.is_test,
    NEW.id,
    CASE WHEN NEW.updated_by IS NULL THEN 'system' ELSE 'admin' END,
    NEW.updated_by,
    v_action,
    v_summary,
    jsonb_build_object('kind', NEW.kind, 'status', NEW.status, 'actor_name', NEW.updated_by_name)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growth_kb_items_log ON growth_kb_items;
CREATE TRIGGER growth_kb_items_log AFTER INSERT OR UPDATE ON growth_kb_items
  FOR EACH ROW EXECUTE FUNCTION growth_kb_log_activity();

-- ---------------------------------------------------------------------------
-- 3. Starter drafts: empty, not test rows, no PMBC facts
-- ---------------------------------------------------------------------------
INSERT INTO growth_kb_items (kind, item_key, sort_order, title, site_service_slug) VALUES
  ('service', 'financial_modeling',      10, 'Financial Modeling',      'financial-modeling'),
  ('service', 'business_valuation',      20, 'Business Valuation',      'business-valuation'),
  ('service', 'ma_modeling',             30, 'M&A Modeling',            'mergers-acquisitions'),
  ('service', 'real_estate_modeling',    40, 'Real Estate Modeling',    'refm'),
  ('service', 'feasibility_study',       50, 'Feasibility Studies',     NULL),
  ('service', 'financial_due_diligence', 60, 'Financial Due Diligence', 'financial-due-diligence'),
  ('offer',   'model_health_check',      10, 'Model health check',      NULL),
  ('offer',   'feasibility_study',       20, 'Feasibility study',       NULL),
  ('offer',   'valuation_report',        30, 'Valuation report',        NULL),
  ('offer',   'investor_pack',           40, 'Investor pack',           NULL)
ON CONFLICT (kind, item_key) WHERE item_key IS NOT NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- Access: service role only
-- ---------------------------------------------------------------------------
ALTER TABLE growth_kb_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE growth_kb_items FROM anon, authenticated;
REVOKE ALL ON FUNCTION growth_kb_log_activity() FROM PUBLIC, anon, authenticated;

COMMIT;
