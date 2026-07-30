-- 028_retune_brand_colors.sql
-- Brand token retune. The Phase 9.5 palette read too dark and too bright on the
-- live site: primary navy #153D64 was cold, and the gold #D4A93A / #B89530 pair
-- was over-saturated for an institutional advisory site.
--
-- New values (also applied to src/app/globals.css and src/lib/public/tokens.ts):
--   primary navy       #153D64 -> #1B3A5F   (warmer, less black)
--   deep navy (panels) #0F2F4F -> #14304F
--   accent gold        #D4A93A -> #C69C3E   (richer, less bright)
--   muted gold         #B89530 -> #A88530
--   cream              #FAF7F2 unchanged
--
-- Only accent_color actually changes in the database: primary_color was already
-- #1B3A5F here (the 9.5 pass moved the CSS tokens but never this row), and
-- secondary_color stays the sparingly-used green.
--
-- branding_config feeds the dynamic OG card (/api/og) and the branding admin,
-- so this keeps generated social images consistent with the site.
--
-- Idempotent.

BEGIN;

UPDATE branding_config
SET accent_color = '#C69C3E',
    primary_color = '#1B3A5F',
    updated_at = NOW()
WHERE id = 1;

UPDATE email_branding
SET primary_color = '#1B3A5F',
    updated_at = NOW()
WHERE id = 1;

COMMIT;
