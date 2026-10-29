-- 116_growth_feed_keep_12.sql
-- Growth Engine signal feed (2026-10-29): the most signals kept per run goes
-- back from 20 to 12. With every keyword group searched in a run there are
-- far more candidates than slots, and the best 12 by rank are kept.
--
-- Moves the column default, and the real settings row only while it still
-- holds 20 (the value 115 set); a value Ahmad chose himself is left alone.
--
-- DDL plus one guarded UPDATE, HAND-RUN in the Supabase SQL editor.
--
-- SAFE TO APPLY: any time after 115, before or after the deploy. Until it is
-- applied the feed keeps up to the stored 20; the code default is already 12
-- for a fresh row. Nothing public changes.
--
-- Idempotent: SET DEFAULT is repeatable and the UPDATE only moves a 20 to 12.

BEGIN;

ALTER TABLE growth_settings ALTER COLUMN signal_feed_max_per_run SET DEFAULT 12;
UPDATE growth_settings SET signal_feed_max_per_run = 12 WHERE id = 1 AND signal_feed_max_per_run = 20;

COMMIT;
