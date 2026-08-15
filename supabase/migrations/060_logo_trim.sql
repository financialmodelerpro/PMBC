-- 060_logo_trim.sql
--
-- Trims the transparent margins off the two brand logo files and retunes every
-- height that depended on the old aspect ratio.
--
-- WHY
-- Phase 44 measured the navbar's brand box starting on exactly the same x as
-- the section content below it, while the mark still looked indented. Both were
-- true at once, because the padding was inside the PNG:
--
--   light  7033x2239, ink 6123x1175, padding L493 T548 R417 B516
--   dark   7209x2239, ink 6113x1176, padding L451 T548 R645 B515
--
-- That is 22px of dead space before the light mark at its rendered width, and
-- both files were only 52.5% ink vertically. CSS cannot see transparent pixels,
-- so no container change could ever have fixed it. Two rounds of container work
-- were spent looking in the wrong place, which is the real cost of shipping an
-- asset with its own padding baked in.
--
-- WHY THE HEIGHTS MOVE WITH IT
-- Every surface sizes this asset by height and lets the width follow. Trimming
-- takes the light file's aspect from 3.14 to 5.21, so at an unchanged box height
-- the mark would render nearly twice as tall: the box used to be mostly empty.
-- Each height below is set to the ink height that surface renders today, which
-- is the old box height times 1175/2239, or 0.525. The mark is therefore the
-- same size it has always been. Only its position changes, and only because the
-- dead space is gone.
--
--   header_settings.logo_height_px        100 to 53   (100 x 0.525 = 52.5)
--   footer_settings.footer_logo_height_px  90 to 47   ( 90 x 0.525 = 47.3)
--
-- header_height_px goes from blank to 100. It was defaulting to 80, and the
-- 100px logo box was what actually made the bar 101px tall. Without this the
-- bar would lose 20px the moment the logo stopped being the tallest thing in
-- it, which is a change to the header's proportions rather than to the logo.
--
-- TWO SURFACES ARE NOT IN THIS FILE
-- The OG card and the email header size this asset in code, because one is a
-- fixed 1200x630 composition and the other is an HTML email that has to survive
-- Outlook. They are retuned in the same commit, by the same 0.525:
--
--   src/app/api/og/route.tsx          200x48 to 130x25
--   src/lib/email/templates/_base.ts  height 42 to 22, attribute and max-height
--
-- The OG card also loses its horizontal slack. It sized the logo 200 wide and
-- let `object-fit: contain` centre a 154px mark inside it, so the logo sat
-- inset from the headline beneath it by roughly 23px on top of the file's own
-- padding. At 130 the box is the mark and both start on the same x.
--
-- NOT DML. The trimming is a binary operation on a PNG, so this file is a record
-- of what `node scripts/seed-logo-trim.mjs` did rather than something that can
-- be pasted into the SQL editor. The statements below are the settings half and
-- are accurate; the storage half cannot be expressed in SQL at all.
--
-- SAFE ON RE-RUN. The script re-inspects the current files and skips when there
-- is no padding left to remove. Nothing is deleted: the original objects stay in
-- the bucket and their URLs keep working, so reverting is putting the old URL
-- back in Header Settings and the two heights back to 100 and 90.

BEGIN;

-- 1. Point branding at the trimmed files.
--
-- These two URLs are what the script produced on 2026-08-15. On a rebuild, run
-- the script rather than these statements: it derives the names from the clock
-- and uploads the objects that these URLs refer to, which do not otherwise
-- exist.
UPDATE branding_config
SET
  logo_url = 'https://yackrfoesinnothbltlc.supabase.co/storage/v1/object/public/cms-assets/1786794532809_logo-light-trimmed.png',
  logo_dark_url = 'https://yackrfoesinnothbltlc.supabase.co/storage/v1/object/public/cms-assets/1786794534969_logo-dark-trimmed.png',
  updated_at = NOW()
WHERE id = 1;

-- 2. The header. The logo box becomes the mark, and the bar is pinned to the
-- height the old box was giving it.
UPDATE cms_content SET value = '53', updated_at = NOW()
WHERE section = 'header_settings' AND key = 'logo_height_px';

INSERT INTO cms_content (section, key, value)
VALUES ('header_settings', 'header_height_px', '100')
ON CONFLICT (section, key) DO UPDATE SET value = '100', updated_at = NOW();

-- 3. The footer, on the same ratio.
UPDATE cms_content SET value = '47', updated_at = NOW()
WHERE section = 'footer_settings' AND key = 'footer_logo_height_px';

COMMIT;
