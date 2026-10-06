-- 096_growth_sector_tiers.sql
-- Growth Engine sector tiers (2026-10-06): the credit each sector tier earns
-- in the Prospect Score and the Lead Score, and which tiers count as a
-- priority sector for the Lead Score rule (priority sector, SAR 50 million or
-- more and a timeline within three months is at least Warm). Real estate
-- scores highest and is the only priority tier by default; infrastructure,
-- energy and industrial sit below it and above every other sector.
--
-- DDL, HAND-RUN in the Supabase SQL editor (supabase-js cannot run DDL).
--
-- SAFE TO APPLY: any time after 088, before or after the deploy that reads
-- this column. It adds one settings column whose default is the tiers the
-- code already uses (100, 75, 60, 45, 25; priority real estate), so scores do
-- not move when it is applied. Until it is applied the scores use the same
-- defaults and the tiers cannot be saved in Settings.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the check is dropped before it is
-- added. Changes are logged by the 087 settings trigger like every column.

BEGIN;

ALTER TABLE growth_settings ADD COLUMN IF NOT EXISTS sector_tiers JSONB NOT NULL DEFAULT
  '{"credit": {"real_estate": 100, "infrastructure": 75, "investment": 60, "services": 45, "other": 25}, "priority": ["real_estate"]}'::jsonb;

ALTER TABLE growth_settings DROP CONSTRAINT IF EXISTS growth_settings_sector_tiers_check;
ALTER TABLE growth_settings ADD CONSTRAINT growth_settings_sector_tiers_check CHECK (
  jsonb_typeof(sector_tiers -> 'credit') = 'object'
  AND jsonb_typeof(sector_tiers -> 'priority') = 'array'
  AND jsonb_array_length(sector_tiers -> 'priority') >= 1
  AND (sector_tiers -> 'credit' ->> 'real_estate')::int BETWEEN 0 AND 100
  AND (sector_tiers -> 'credit' ->> 'other')::int BETWEEN 0 AND 100
  AND (sector_tiers -> 'credit' ->> 'real_estate')::int > (sector_tiers -> 'credit' ->> 'infrastructure')::int
  AND (sector_tiers -> 'credit' ->> 'infrastructure')::int > (sector_tiers -> 'credit' ->> 'investment')::int
  AND (sector_tiers -> 'credit' ->> 'investment')::int > (sector_tiers -> 'credit' ->> 'services')::int
  AND (sector_tiers -> 'credit' ->> 'services')::int > (sector_tiers -> 'credit' ->> 'other')::int
);

COMMIT;
