-- 030_header_layout_key.sql
-- Adds the one header_settings key that Phase 1 did not create.
--
-- Phase 1 (migration 029) seeded 13 presentation keys derived from FMP's real
-- Header Settings page. `header_layout` is NOT one of FMP's 17 keys; it is a
-- PMBC addition requested when the presentation fields were wired into the
-- public Navbar, to control how nav items distribute across the header.
--
-- Values:
--   'default'  brand, nav, actions spaced apart (the layout shipped to date)
--   'centered' nav items centred in the space between brand and actions
--   'spread'   nav items distributed evenly across the available width
--
-- Anything unrecognised falls back to 'default' in fetchHeaderConfig, so a bad
-- value can never break the navbar.
--
-- Idempotent: ON CONFLICT DO NOTHING. Additive, no schema change.
-- No em dashes in this file.

BEGIN;

INSERT INTO cms_content (section, key, value) VALUES
  ('header_settings', 'header_layout', 'default')
ON CONFLICT (section, key) DO NOTHING;

COMMIT;

-- Rollback (run manually if needed):
--
-- DELETE FROM cms_content
--  WHERE section = 'header_settings' AND key = 'header_layout';
--
-- Additive only. Reverting the code without reverting this migration is
-- harmless: the row simply goes unread.
