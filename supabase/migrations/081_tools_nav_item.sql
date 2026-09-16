-- 081_tools_nav_item.sql
-- Tools becomes a normal Pages & Nav item, switched on or off by hand.
--
-- SAFE TO APPLY: any time, before or after the deploy that reads it.
--   The row is inserted HIDDEN, so applying it changes nothing a visitor sees.
--   Before the deploy, the running code strips any /tools row from the navbar
--   and decides Tools itself from the tool visibility switch, so a hidden row
--   is ignored. After the deploy, Tools appears only when this row is switched
--   on in Pages & Nav AND at least one tool is Live at /admin/tools.
--
-- DML. Run in the Supabase SQL editor.
--
-- WHAT IT DOES
-- 1. Makes room directly after Financial Modeler Pro by moving every later
--    item (today only Contact) down one place.
-- 2. Inserts "Tools", link /tools, hidden, not pinned, in that place. With no
--    Financial Modeler Pro row it goes last.
-- The footer "Free Tools" link follows this row too; it is not a Footer Links
-- row, so nothing is written there.
--
-- WHY
-- The navbar used to add Tools automatically whenever a tool was Live. The
-- operator now decides whether Tools is offered, under what label and where,
-- in Pages & Nav like every other page. Each tool page still follows its own
-- Live or Hidden status.
--
-- Touches only label, href, display_order, visible and can_toggle: the live
-- site_pages table has no updated_at column, whatever 027 declared.
--
-- Idempotent: does nothing when a /tools row (with or without a trailing
-- slash, any case) already exists, so re-running cannot duplicate or reorder.

BEGIN;

WITH existing AS (
  SELECT 1 FROM site_pages WHERE lower(rtrim(href, '/')) = '/tools'
),
anchor AS (
  SELECT COALESCE(
    (SELECT display_order FROM site_pages WHERE lower(rtrim(href, '/')) = '/fmp' ORDER BY display_order LIMIT 1),
    (SELECT MAX(display_order) FROM site_pages),
    -1
  ) AS after_order
),
shifted AS (
  UPDATE site_pages
  SET display_order = display_order + 1
  WHERE NOT EXISTS (SELECT 1 FROM existing)
    AND display_order > (SELECT after_order FROM anchor)
  RETURNING id
)
INSERT INTO site_pages (label, href, display_order, visible, can_toggle)
SELECT 'Tools', '/tools', (SELECT after_order FROM anchor) + 1, false, true
WHERE NOT EXISTS (SELECT 1 FROM existing)
  -- Referenced so the shift above always runs first in the same statement.
  AND (SELECT COUNT(*) FROM shifted) >= 0;

COMMIT;
