-- 079_retire_tools_link_rows.sql
-- Removes the two stored links into the free tools that migration 075 created.
--
-- SAFE TO APPLY: any time, before or after the free tools code is deployed.
--   Both rows have been hidden since 2026-09-16, so removing them changes
--   nothing a visitor sees on the current production build. After the deploy
--   the code ignores both rows even if this has not run.
--
-- DML. Run in the SQL editor with the others.
--
-- WHY
-- 075 put a "Free Tools" link in (footer_settings, links) and a cta_block on
-- service-business-valuation. Each had its own visible flag, and 075 was
-- applied before the routes existed, so the live site linked to a 404 until
-- both were hidden by script. The footer link and the service CTA are now
-- rendered from the one tool visibility switch at /admin/tools (076), so these
-- rows are a second switch that does nothing. Left in place they would show in
-- Footer Links and the page builder as controls that have no effect.
--
-- The CTA copy moved to the registry (`serviceCta` in src/config/tools.ts).
-- The retired scripts/set-tools-links-visibility.mjs is no longer needed.
--
-- Idempotent.

BEGIN;

UPDATE cms_content
SET value = (
      SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)::text
      FROM jsonb_array_elements(value::jsonb) WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'id' <> 'tools'
    ),
    updated_at = NOW()
WHERE section = 'footer_settings'
  AND key = 'links'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(value::jsonb) AS e WHERE e->>'id' = 'tools'
  );

DELETE FROM page_sections
WHERE page_slug = 'service-business-valuation'
  AND section_type = 'cta_block'
  AND content->>'cta_primary_href' = '/tools/business-valuation';

COMMIT;
