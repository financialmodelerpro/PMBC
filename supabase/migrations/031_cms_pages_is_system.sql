-- 031_cms_pages_is_system.sql
-- Parity Phase 4: adds the `is_system` flag FMP's Page Builder uses to decide
-- whether a page may be deleted from the admin.
--
-- PMBC's cms_pages (migration 002) never had this column; FMP's does. Without
-- it, adding a delete button would let an admin remove a page that backs a live
-- public route.
--
-- WHICH PAGES ARE MARKED SYSTEM, and why it is ALL of them:
--
-- The 8 firm pages (home, about, services, contact, sectors, approach, network,
-- financial-modeler-pro) back bespoke routes under src/app/(public)/.
--
-- The 9 `service-*` rows look like inert metadata but are NOT. The route
-- src/app/(public)/services/[slug]/page.tsx calls fetchPage(`service-${slug}`)
-- inside generateMetadata and feeds it to buildPageMetadata, so each row supplies
-- the meta_title, meta_description and og_image_url for a live public service
-- page. Deleting one would not break the page (it falls back to config defaults)
-- but would silently downgrade its SEO, which is exactly the kind of quiet
-- regression a delete button should not make possible.
--
-- So: every row present when this migration runs backs a live route and is
-- marked system. Pages created afterwards through the new admin flow default to
-- is_system = false and are freely deletable, which is the point of the feature.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the UPDATE is scoped to rows created
-- before this migration, so re-running cannot re-lock a page an admin has since
-- created and deliberately left unlocked.
-- No em dashes in this file.

BEGIN;

ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Mark everything that exists right now. Scoped by created_at so a re-run after
-- new pages have been added does not sweep them up too.
UPDATE cms_pages
   SET is_system = true
 WHERE created_at < NOW()
   AND slug IN (
     'home', 'about', 'services', 'contact',
     'sectors', 'approach', 'network', 'financial-modeler-pro',
     'service-financial-modeling', 'service-business-valuation',
     'service-financial-due-diligence', 'service-transaction-advisory',
     'service-mergers-acquisitions', 'service-real-estate-modeling',
     'service-project-finance', 'service-investment-memorandums',
     'service-cfo-advisory'
   );

COMMIT;

-- Rollback (run manually if needed):
--
-- ALTER TABLE cms_pages DROP COLUMN IF EXISTS is_system;
--
-- Dropping the column disables the admin delete guard, so revert the Phase 4
-- code at the same time rather than leaving the UI able to delete anything.
