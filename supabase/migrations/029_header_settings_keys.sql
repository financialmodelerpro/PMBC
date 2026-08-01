-- 029_header_settings_keys.sql
-- Phase 1 of FMP admin parity: consolidate /admin/branding into
-- /admin/header-settings, matching FMP's single "Header Settings" page.
--
-- FMP stores 17 discrete keys under cms_content section='header_settings'
-- (verified against the real FMP page carried in "PMBC from FMP/", not just
-- CMS_REFERENCE.md). PMBC already had 4 of them. This migration seeds the 13
-- presentation keys that were missing, so the consolidated page has a row to
-- write for every control.
--
-- Deliberate split, to avoid two sources of truth:
--   * Brand IDENTITY (logo_url, logo_dark_url, favicon_url, brand_name,
--     short_name, tagline, primary/secondary/accent colour) stays in the
--     `branding_config` TABLE, because the public Navbar, Footer, /api/og and
--     buildPageMetadata already read it from there. Duplicating those into
--     cms_content would recreate exactly the dual-source problem migration 027
--     fixed for nav items.
--   * Header PRESENTATION (sizing, position, toggles, icon, layout) lives here
--     as cms_content rows, matching FMP.
--
-- One FMP key is intentionally NOT ported: `achievement_card_logo_height`.
-- It sizes the logo on FMP's training achievement share card. PMBC has no
-- achievement cards, so the key would be dead config.
--
-- Idempotent: ON CONFLICT DO NOTHING, safe to re-run. Existing values are
-- never overwritten, so re-running cannot clobber an admin's edits.
-- No em dashes in this file.

BEGIN;

INSERT INTO cms_content (section, key, value) VALUES
  -- Logo presentation. Identity (the URL itself) stays in branding_config.
  ('header_settings', 'logo_enabled',             'true'),
  ('header_settings', 'logo_width_px',            ''),
  ('header_settings', 'logo_height_px',           '40'),
  ('header_settings', 'logo_position',            'left'),

  -- Branding text toggles. The text itself stays in branding_config.
  ('header_settings', 'show_brand_name',          'true'),
  ('header_settings', 'show_tagline',             'false'),

  -- Header icon. Separate from the logo and from the favicon in branding_config.
  ('header_settings', 'icon_url',                 ''),
  ('header_settings', 'icon_as_favicon',          'false'),
  ('header_settings', 'icon_in_header',           'false'),
  ('header_settings', 'icon_size_px',             '20'),

  -- Header layout.
  ('header_settings', 'header_height_px',         ''),
  ('header_settings', 'header_padding_top_px',    ''),
  ('header_settings', 'header_padding_bottom_px', '')
ON CONFLICT (section, key) DO NOTHING;

COMMIT;

-- Rollback (run manually if needed):
--
-- DELETE FROM cms_content
--  WHERE section = 'header_settings'
--    AND key IN (
--      'logo_enabled','logo_width_px','logo_height_px','logo_position',
--      'show_brand_name','show_tagline',
--      'icon_url','icon_as_favicon','icon_in_header','icon_size_px',
--      'header_height_px','header_padding_top_px','header_padding_bottom_px'
--    );
--
-- Additive only: it creates no tables and alters no columns, and the four
-- pre-existing keys (cta_label, cta_href, show_cta, mobile_menu_enabled) are
-- untouched. Reverting the code without reverting this migration is harmless,
-- the extra rows simply go unread.
