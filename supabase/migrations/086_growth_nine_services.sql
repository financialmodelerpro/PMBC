-- 086_growth_nine_services.sql
-- Growth Engine services become the public site's nine services (Unit 1.3b,
-- 2026-09-22). One source of truth: src/config/services.ts.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot ALTER TABLE).
--
-- SAFE TO APPLY: after the Unit 1.4 deploy, and before or after the deploy of
-- Unit 1.3b. Until it is applied, the Unit 1.3b code shows the six old service
-- drafts as not matching the site (the Knowledge Base readiness says so) and a
-- lead or company given one of the nine service values is refused by the old
-- CHECK. Before the code deploys, the old code keeps working on converted rows
-- because it only reads item_key and title. No row outside the Growth tables
-- is touched.
--
-- Idempotent: constraints dropped before they are re-added, every update keyed
-- on the old value (a second run finds nothing to change), inserts ON CONFLICT
-- DO NOTHING, and the explicit log rows written only when a row changed.
--
-- WHAT CHANGES
-- 1. Service values. growth_companies.likely_service and
--    growth_leads.recommended_service accept only the nine site service slugs.
--    Any row holding one of the six old values is mapped first (there are none
--    today): five map to their site service, feasibility_study becomes null
--    because Feasibility Study is an entry offer, not a service.
-- 2. The Knowledge Base holds nine service drafts, keyed by the site slug and
--    named exactly as on the site, each linked to its own site page
--    (site_service_slug = item_key, enforced). The five matching drafts are
--    converted in place, so their history stays attached; the Feasibility
--    Studies service draft is archived with its key cleared (it cannot be
--    deleted: its creation is in the append-only log); four drafts are added.
--    Every conversion and the archive are logged to growth_activity.
-- 3. Offers can link to services: growth_kb_items.related_service_slugs, held
--    to the nine, and frozen into the approved copy like any other link. The
--    feasibility study offer links to Financial Modeling, Real Estate
--    Financial Modeling and Project Finance.
-- 4. Outreach priority: growth_settings.priority_services, held to the nine,
--    default the five priority services. A change is logged with old and new
--    values by the settings trigger from 085.
-- 5. Test rows may reuse a real service key (the unique key now ignores test
--    rows), so verifiers can exercise services without touching real ones.
--
-- The nine slugs below are mirrored in src/config/services.ts, and
-- `npm run verify-growth-kb` fails if they drift.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Service values on companies and leads
-- ---------------------------------------------------------------------------
ALTER TABLE growth_companies DROP CONSTRAINT IF EXISTS growth_companies_likely_service_check;
ALTER TABLE growth_leads DROP CONSTRAINT IF EXISTS growth_leads_recommended_service_check;

UPDATE growth_companies SET likely_service = CASE likely_service
  WHEN 'financial_modeling' THEN 'financial-modeling'
  WHEN 'business_valuation' THEN 'business-valuation'
  WHEN 'ma_modeling' THEN 'mergers-acquisitions'
  WHEN 'real_estate_modeling' THEN 'refm'
  WHEN 'financial_due_diligence' THEN 'financial-due-diligence'
  ELSE NULL END
WHERE likely_service IN ('financial_modeling', 'business_valuation', 'ma_modeling', 'real_estate_modeling', 'feasibility_study', 'financial_due_diligence');

UPDATE growth_leads SET recommended_service = CASE recommended_service
  WHEN 'financial_modeling' THEN 'financial-modeling'
  WHEN 'business_valuation' THEN 'business-valuation'
  WHEN 'ma_modeling' THEN 'mergers-acquisitions'
  WHEN 'real_estate_modeling' THEN 'refm'
  WHEN 'financial_due_diligence' THEN 'financial-due-diligence'
  ELSE NULL END
WHERE recommended_service IN ('financial_modeling', 'business_valuation', 'ma_modeling', 'real_estate_modeling', 'feasibility_study', 'financial_due_diligence');

ALTER TABLE growth_companies ADD CONSTRAINT growth_companies_likely_service_check CHECK (likely_service IN (
  'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
  'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
));
ALTER TABLE growth_leads ADD CONSTRAINT growth_leads_recommended_service_check CHECK (recommended_service IN (
  'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
  'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
));

-- ---------------------------------------------------------------------------
-- 2 and 3. Knowledge Base: nine services, offer links
-- ---------------------------------------------------------------------------
ALTER TABLE growth_kb_items ADD COLUMN IF NOT EXISTS related_service_slugs TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE growth_kb_items DROP CONSTRAINT IF EXISTS growth_kb_related_services_check;
ALTER TABLE growth_kb_items ADD CONSTRAINT growth_kb_related_services_check CHECK (
  related_service_slugs <@ ARRAY[
    'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
    'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
  ]::TEXT[]
);

-- Test rows may reuse a real key, so the unique key ignores them.
DROP INDEX IF EXISTS growth_kb_items_key;
CREATE UNIQUE INDEX IF NOT EXISTS growth_kb_items_key
  ON growth_kb_items (kind, item_key) WHERE item_key IS NOT NULL AND NOT is_test;

-- Convert the five matching service drafts in place, logging each.
WITH mapping (old_key, new_key, new_title, sort_order) AS (
  VALUES
    ('financial_modeling', 'financial-modeling', 'Financial Modeling', 10),
    ('business_valuation', 'business-valuation', 'Business Valuation', 20),
    ('financial_due_diligence', 'financial-due-diligence', 'Financial Due Diligence', 30),
    ('ma_modeling', 'mergers-acquisitions', 'M&A Advisory', 50),
    ('real_estate_modeling', 'refm', 'Real Estate Financial Modeling', 60)
),
converted AS (
  UPDATE growth_kb_items AS k
  SET item_key = m.new_key, title = m.new_title, site_service_slug = m.new_key, sort_order = m.sort_order, updated_by = NULL, updated_by_name = 'Migration 086'
  FROM mapping AS m
  WHERE k.kind = 'service' AND k.item_key = m.old_key AND NOT k.is_test
  RETURNING k.id, m.old_key, m.new_key, m.new_title, k.is_test
)
INSERT INTO growth_activity (is_test, kb_item_id, actor_type, actor_id, action, summary, metadata)
SELECT is_test, id, 'system', 'migration-086', 'kb.service_aligned',
  'Aligned service with the site: ' || old_key || ' is now ' || new_key || ' (' || new_title || ')',
  jsonb_build_object('old_key', old_key, 'new_key', new_key, 'new_title', new_title, 'actor_name', 'Migration 086')
FROM converted;

-- Feasibility Studies is an entry offer, not a service: archive its service
-- draft and clear the key. The archive is logged by the 084 trigger.
UPDATE growth_kb_items
SET status = 'archived', item_key = NULL, title = 'Feasibility Studies (retired: now an entry offer)', site_service_slug = NULL,
    updated_by = NULL, updated_by_name = 'Migration 086'
WHERE kind = 'service' AND item_key = 'feasibility_study' AND NOT is_test;

-- The four site services that had no draft. Creation is logged by the trigger.
INSERT INTO growth_kb_items (kind, item_key, sort_order, title, site_service_slug, updated_by_name) VALUES
  ('service', 'transaction-advisory', 40, 'Transaction Advisory', 'transaction-advisory', 'Migration 086'),
  ('service', 'project-finance', 70, 'Project Finance', 'project-finance', 'Migration 086'),
  ('service', 'investment-memorandums', 80, 'Investment Memorandums', 'investment-memorandums', 'Migration 086'),
  ('service', 'cfo-advisory', 90, 'CFO Advisory', 'cfo-advisory', 'Migration 086')
ON CONFLICT (kind, item_key) WHERE item_key IS NOT NULL AND NOT is_test DO NOTHING;

-- Every live service is one of the nine and links to its own page.
ALTER TABLE growth_kb_items DROP CONSTRAINT IF EXISTS growth_kb_service_is_site_service;
ALTER TABLE growth_kb_items ADD CONSTRAINT growth_kb_service_is_site_service CHECK (
  kind <> 'service' OR status = 'archived' OR (
    item_key IN (
      'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
      'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
    )
    AND site_service_slug = item_key
  )
);

-- The feasibility study offer links to its related services, once, logged.
WITH linked AS (
  UPDATE growth_kb_items
  SET related_service_slugs = ARRAY['financial-modeling', 'refm', 'project-finance'], updated_by = NULL, updated_by_name = 'Migration 086'
  WHERE kind = 'offer' AND item_key = 'feasibility_study' AND NOT is_test AND related_service_slugs = '{}'
  RETURNING id, is_test
)
INSERT INTO growth_activity (is_test, kb_item_id, actor_type, actor_id, action, summary, metadata)
SELECT is_test, id, 'system', 'migration-086', 'kb.offer_linked',
  'Linked the feasibility study offer to Financial Modeling, Real Estate Financial Modeling and Project Finance',
  jsonb_build_object('related_service_slugs', ARRAY['financial-modeling', 'refm', 'project-finance'], 'actor_name', 'Migration 086')
FROM linked;

-- An approved item's links are part of what agents read, so a change to them
-- while approved is logged like any other edit.
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
      OR NEW.case_study_id IS DISTINCT FROM OLD.case_study_id
      OR NEW.related_service_slugs IS DISTINCT FROM OLD.related_service_slugs) THEN
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
REVOKE ALL ON FUNCTION growth_kb_log_activity() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Outreach priority
-- ---------------------------------------------------------------------------
ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS priority_services TEXT[] NOT NULL
  DEFAULT ARRAY['financial-modeling', 'business-valuation', 'financial-due-diligence', 'mergers-acquisitions', 'refm']::TEXT[];
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_priority_services_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_priority_services_check CHECK (
  priority_services <@ ARRAY[
    'financial-modeling', 'business-valuation', 'financial-due-diligence', 'transaction-advisory',
    'mergers-acquisitions', 'refm', 'project-finance', 'investment-memorandums', 'cfo-advisory'
  ]::TEXT[]
);

COMMIT;
