-- 106_service_practice_groups.sql
--
-- Services in three practice groups, matching the firm profile deck
-- (2026-10-11, on the owner's instruction). New order and numbering:
--
--   Modeling and Valuation   01 financial-modeling        Financial Modeling
--                            02 refm                      Real Estate Financial Modeling
--                            03 business-valuation        Business Valuation
--   Transactions             04 transaction-advisory      Transaction Advisory
--                            05 mergers-acquisitions      M&A Advisory
--                            06 financial-due-diligence   Financial Due Diligence
--   Capital and Finance      07 project-finance           Project Finance
--                            08 investment-memorandums    Investment Memoranda
--                            09 cfo-advisory              CFO Advisory
--
-- Slugs do not change. The one rename is the display name "Investment
-- Memorandums" to "Investment Memoranda"; its slug keeps the old plural, so
-- /services/investment-memorandums and its four join keys stay put.
--
-- WHAT THIS TOUCHES
--   1. services            number and display_order on all nine; the one title.
--                          Drives the /services grid and the navbar dropdown.
--   2. cms_pages           title and meta title of service-investment-memorandums.
--   3. page_sections       the three group names on the /services grid section
--                          (group_1_name to group_3_name), editable in the page
--                          builder. Existing values win.
--   4. growth_kb_items     the nine service drafts' sort_order follows the new
--                          order, and the one title. Logged by the 084 trigger.
--
-- The static SERVICES config in src/config/services.ts is the fifth place and
-- is changed in code: it carries the same order, numbers and title, plus which
-- group each slug belongs to, and drives the detail pages' "Service 0n" line,
-- the related services, the contact dropdown, the sitemap and the JSON-LD.
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner.
--
-- SAFE TO APPLY: right after the deploy that groups the grid goes live. Before
-- that deploy the old flat grid would show the new order while the detail pages
-- still print the old numbers; in the gap after the deploy and before this,
-- the grid and dropdown show the old numbers while detail pages show the new.
-- No URL changes in either gap, so nothing 404s.
--
-- SAFE ON RE-RUN: numbers and orders are set to fixed values by slug; the
-- title changes are guarded on the old title; the group names only fill keys
-- that are absent. Nothing is deleted.
--
-- Check after applying (expect nine rows, 01 to 09 in the order above):
--   SELECT number, display_order, slug, title FROM services ORDER BY display_order;

BEGIN;

-- 1. Managed services collection ---------------------------------------------
UPDATE services AS s
SET number = m.number,
    display_order = m.display_order,
    updated_at = NOW()
FROM (VALUES
  ('financial-modeling', '01', 1),
  ('refm', '02', 2),
  ('business-valuation', '03', 3),
  ('transaction-advisory', '04', 4),
  ('mergers-acquisitions', '05', 5),
  ('financial-due-diligence', '06', 6),
  ('project-finance', '07', 7),
  ('investment-memorandums', '08', 8),
  ('cfo-advisory', '09', 9)
) AS m(slug, number, display_order)
WHERE s.slug = m.slug
  AND (s.number IS DISTINCT FROM m.number OR s.display_order IS DISTINCT FROM m.display_order);

UPDATE services
SET title = 'Investment Memoranda',
    updated_at = NOW()
WHERE slug = 'investment-memorandums' AND title = 'Investment Memorandums';

-- 2. Detail page metadata ----------------------------------------------------
UPDATE cms_pages
SET title = 'Investment Memoranda',
    updated_at = NOW()
WHERE slug = 'service-investment-memorandums' AND title = 'Investment Memorandums';

UPDATE cms_pages
SET meta_title = 'Investment Memoranda | PaceMakers Business Consultants',
    updated_at = NOW()
WHERE slug = 'service-investment-memorandums'
  AND meta_title = 'Investment Memorandums | PaceMakers Business Consultants';

-- 3. Group names on the /services grid ---------------------------------------
UPDATE page_sections
SET content = jsonb_build_object(
      'group_1_name', 'Modeling and Valuation',
      'group_2_name', 'Transactions',
      'group_3_name', 'Capital and Finance'
    ) || content,
    updated_at = NOW()
WHERE page_slug = 'services'
  AND section_type = 'service_grid'
  AND NOT (content ? 'group_1_name' AND content ? 'group_2_name' AND content ? 'group_3_name');

-- 4. Growth Knowledge Base service drafts ------------------------------------
UPDATE growth_kb_items AS k
SET sort_order = m.sort_order,
    updated_by = NULL,
    updated_by_name = 'Migration 106'
FROM (VALUES
  ('financial-modeling', 10),
  ('refm', 20),
  ('business-valuation', 30),
  ('transaction-advisory', 40),
  ('mergers-acquisitions', 50),
  ('financial-due-diligence', 60),
  ('project-finance', 70),
  ('investment-memorandums', 80),
  ('cfo-advisory', 90)
) AS m(item_key, sort_order)
WHERE k.kind = 'service' AND k.item_key = m.item_key AND NOT k.is_test
  AND k.sort_order IS DISTINCT FROM m.sort_order;

UPDATE growth_kb_items
SET title = 'Investment Memoranda',
    updated_by = NULL,
    updated_by_name = 'Migration 106'
WHERE kind = 'service' AND item_key = 'investment-memorandums' AND NOT is_test
  AND title = 'Investment Memorandums';

COMMIT;
