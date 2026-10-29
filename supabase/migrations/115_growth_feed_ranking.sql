-- 115_growth_feed_ranking.sql
-- Growth Engine signal feed ranking (2026-10-29). The feed now drops
-- candidates that are not prospects, scores the rest on the Prospect Score's
-- own factors (sector tier, size against the SAR 50 million minimum, trigger
-- type and recency), and keeps the highest ranked. Each kept signal records
-- where it ranked and why:
--
--   growth_signals.feed_rank    its place in the run, 1 is the best; null for
--                               a signal added by hand or before 115
--   growth_signals.feed_score   0 to 100, the Prospect Score of the candidate
--   growth_signals.feed_reason  one line: why it was kept and where it ranked
--
-- It also raises the most signals kept per run from 10 to 20: the column
-- default, and the real settings row only while it still holds the old
-- default of 10 (a value Ahmad chose himself is left alone).
--
-- DDL plus one guarded UPDATE, HAND-RUN in the Supabase SQL editor.
--
-- SAFE TO APPLY: any time after 088, before or after the deploy that writes
-- the columns. Before it, the feed still ranks and keeps the best, but the
-- rank and reason are not stored on each signal (the insert drops the three
-- columns) and the run keeps the current limit. Nothing public changes.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, each check dropped before it is
-- added, and the UPDATE only moves a 10 to 20.

BEGIN;

ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS feed_rank INTEGER;
ALTER TABLE growth_signals DROP CONSTRAINT IF EXISTS growth_signals_feed_rank_check;
ALTER TABLE growth_signals ADD CONSTRAINT growth_signals_feed_rank_check CHECK (feed_rank IS NULL OR feed_rank >= 1);
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS feed_score SMALLINT;
ALTER TABLE growth_signals DROP CONSTRAINT IF EXISTS growth_signals_feed_score_check;
ALTER TABLE growth_signals ADD CONSTRAINT growth_signals_feed_score_check CHECK (feed_score IS NULL OR feed_score BETWEEN 0 AND 100);
ALTER TABLE growth_signals ADD COLUMN IF NOT EXISTS feed_reason TEXT;

ALTER TABLE growth_settings ALTER COLUMN signal_feed_max_per_run SET DEFAULT 20;
UPDATE growth_settings SET signal_feed_max_per_run = 20 WHERE id = 1 AND signal_feed_max_per_run = 10;

COMMIT;
