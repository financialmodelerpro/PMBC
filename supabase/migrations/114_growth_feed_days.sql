-- 114_growth_feed_days.sql
-- Growth Engine daily signal feed cadence (2026-10-29): the days of the week
-- (Riyadh time, 0 Sunday to 6 Saturday) on which the 09:00 morning job runs
-- the feed. Default Sunday, Tuesday and Thursday. A run by hand works on any
-- day.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: any time after 085 and 113, before or after the deploy that
-- reads the column. It adds one settings column with its default. Before it
-- is applied the morning job already uses the same default (Sunday, Tuesday,
-- Thursday) and the day boxes in Settings show read only. The 087 trigger
-- logs every later change with old and new values.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the check is dropped before it is
-- added. Uses growth_is_increasing from 085, as send_days does.

BEGIN;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS signal_feed_days INTEGER[] NOT NULL DEFAULT '{0,2,4}';
ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_signal_feed_days_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_signal_feed_days_check CHECK (
  cardinality(signal_feed_days) BETWEEN 1 AND 7
  AND signal_feed_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]
  AND growth_is_increasing(signal_feed_days)
);

COMMIT;
