-- 040_footer_logo_sizing.sql
-- Footer logo sizing controls, mirroring what the header already had.
--
-- The header has exposed logo_height_px and logo_width_px since migration 029,
-- but the footer logo had no equivalent: it was pinned to a hardcoded Tailwind
-- `h-11` (44px) with no way to change it, which is why it renders too small
-- against the deep navy footer.
--
-- Three keys under the existing `footer_settings` section, which already holds
-- about_blurb, address_line and copyright. Same namespace convention as
-- `header_settings`: one discrete row per setting, never a bundled JSON blob.
--
--   footer_logo_height_px   rendered height, 24 to 120, default 48
--   footer_logo_width_px    explicit width, blank means auto by aspect ratio
--   footer_logo_enabled     false hides the logo, leaving the serif wordmark
--
-- Height is bounded rather than free: below roughly 24px the wordmark reads
-- better than a shrunken logo, and above 120px the logo starts to dominate a
-- footer column. /api/admin/footer-settings rejects out-of-range values with a
-- 422, and the read path in lib/cms/footerSettings.ts clamps as well, so a row
-- hand-edited through /admin/content or the SQL editor still cannot produce a
-- zero-height, invisible logo.
--
-- DML only, so `node scripts/seed-footer-logo-sizing.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive: ON CONFLICT DO NOTHING, so a re-run leaves
-- values an operator has since changed exactly as they are.

BEGIN;

INSERT INTO cms_content (section, key, value) VALUES
  ('footer_settings', 'footer_logo_height_px', '48'),
  ('footer_settings', 'footer_logo_width_px',  ''),
  ('footer_settings', 'footer_logo_enabled',   'true')
ON CONFLICT (section, key) DO NOTHING;

COMMIT;
