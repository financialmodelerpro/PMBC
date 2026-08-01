-- 032_audit_log_diff_columns.sql
-- Parity Phase 7: gives audit_log the before/after/reason columns FMP's
-- AuditLogViewer renders as a diff (CMS_REFERENCE.md section 6).
--
-- PMBC's audit_log (migration 001) records who did what to which entity, but
-- not what the value actually was. That is enough to answer "who changed the
-- hero" and not enough to answer "what did it say before".
--
-- Semantics the application writes:
--   create   before_value NULL,     after_value = the new row
--   update   before_value = old row, after_value = the new row
--   delete   before_value = old row, after_value NULL
--   reason   optional free text, NULL unless the admin supplied context
--
-- Historical rows keep NULL in all three, which the viewer renders as
-- "no diff recorded" rather than an empty object. That distinction matters:
-- an empty object would read as "the row was blank", which is not what
-- happened.
--
-- JSONB rather than TEXT so a future query can filter on a specific field
-- inside a diff without parsing strings.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Additive only, no backfill, no
-- rewrite of existing rows.
-- No em dashes in this file.

BEGIN;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS before_value JSONB,
  ADD COLUMN IF NOT EXISTS after_value  JSONB,
  ADD COLUMN IF NOT EXISTS reason       TEXT;

-- The viewer filters by admin, by action, and by date range. The existing
-- idx_audit_log_created_at covers the default ordering; these two cover the
-- filtered paths so a filtered page does not degrade to a sequential scan as
-- the table grows.
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin_created
  ON audit_log(admin_id, created_at DESC);

COMMIT;

-- Rollback (run manually if needed):
--
-- DROP INDEX IF EXISTS idx_audit_log_admin_created;
-- DROP INDEX IF EXISTS idx_audit_log_action_created;
-- ALTER TABLE audit_log
--   DROP COLUMN IF EXISTS before_value,
--   DROP COLUMN IF EXISTS after_value,
--   DROP COLUMN IF EXISTS reason;
--
-- Additive only, so reverting the code without reverting this migration is
-- harmless: the columns simply stop being written and stop being read.
