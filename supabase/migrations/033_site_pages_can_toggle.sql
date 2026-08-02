-- 033_site_pages_can_toggle.sql
-- site_pages.can_toggle: whether an admin is allowed to hide a nav item.
--
-- FMP's site_pages carries this flag so structural links cannot be hidden by
-- accident (ADMIN_PARITY_GAP.md section 6). PMBC adopts it in parity 8 as part
-- of the Pages and Nav inline-edit rewrite: when can_toggle is false the
-- Visible switch renders locked, and /api/admin/site-pages rejects a visibility
-- change on that row with a 403 rather than trusting the client.
--
-- Contact is pinned by default because /contact is the site's single conversion
-- route and the header CTA points at it. Everything else stays hideable.
--
-- DDL. supabase-js cannot run ALTER TABLE, so this one is pasted into the
-- Supabase SQL editor by hand, the same as 031 and 032.
--
-- Degrades safely if it has not been run: /api/admin/site-pages retries its
-- write without the column when Postgres reports the column is missing, and the
-- admin table hides the Pinned control when no row carries the field. So the
-- page keeps working on an un-migrated database, minus the pinning feature.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE site_pages
  ADD COLUMN IF NOT EXISTS can_toggle BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN site_pages.can_toggle IS
  'False pins the item visible in the navbar: the admin Visible switch locks and the API refuses to change it.';

-- Pin the conversion route. Only touches rows that are still at the default, so
-- a re-run cannot undo a deliberate unpinning done later in the admin.
UPDATE site_pages
SET can_toggle = false
WHERE href IN ('/contact', '/')
  AND can_toggle IS TRUE;

COMMIT;
