-- 113_growth_feed_coverage.sql
-- Growth Engine daily signal feed coverage (2026-10-29): how far back the feed
-- looks, how many web searches each keyword group gets, and the most one run
-- may cost.
--
--   signal_feed_window_days         30, 1 to 90. The prompt asks for events
--                                   in this window and the code discards
--                                   anything older, so the two always agree.
--   signal_feed_searches_per_group  5, 1 to 10. A run makes one AI call per
--                                   active keyword group, each allowed this
--                                   many searches.
--   signal_feed_max_cost_usd        3.00, above 0 and at most 50. A group's
--                                   call starts only while the run's spend so
--                                   far plus that call's estimate stays within
--                                   it; groups left out are recorded on the run.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: any time after 088, before or after the deploy that reads
-- these columns. It adds three settings columns with defaults and changes
-- nothing visible. Until it is applied the feed uses the same defaults (30
-- days, 5 searches a group, USD 3.00 a run) and the three settings show read
-- only. The 087 trigger logs every later change with old and new values.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and each check is dropped before it
-- is added.

BEGIN;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_window_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_feed_window_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_feed_window_check CHECK (signal_feed_window_days BETWEEN 1 AND 90);

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_searches_per_group INTEGER NOT NULL DEFAULT 5;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_feed_searches_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_feed_searches_check CHECK (signal_feed_searches_per_group BETWEEN 1 AND 10);

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_max_cost_usd NUMERIC(6, 2) NOT NULL DEFAULT 3.00;
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_feed_cost_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_feed_cost_check CHECK (signal_feed_max_cost_usd > 0 AND signal_feed_max_cost_usd <= 50);

COMMIT;
