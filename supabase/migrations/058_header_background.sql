-- 058_header_background.sql
-- The surface the header sits on becomes an operator choice.
--
-- The navbar was hardcoded white: `bg-white`, with `bg-white/95` once the page
-- had scrolled under it. That is a poor ground for PMBC's own logo, which is
-- navy and green on a transparent field, and there was no way to change it
-- short of editing the component.
--
-- One key under the existing `header_settings` section, holding one of three
-- values:
--
--   white       the shipped default, unchanged
--   cream       #FAF7F2, the warm surface every other section already uses
--   navy_deep   #14304F, the footer colour
--
-- Named for the three `PmbcVariant` backgrounds rather than given new names,
-- because an operator already meets white, cream and deep navy in the page
-- builder's style panel and the header is the same kind of choice.
--
-- An enum rather than a free hex value, deliberately. The link colour, the CTA
-- treatment, the monogram, the mobile menu panel and which logo is used all
-- follow from this one setting, and none of them can be derived from an
-- arbitrary colour without guessing at contrast. On deep navy the CTA turns
-- gold, since a navy button on a navy header cannot be seen, and the logo set
-- for dark backgrounds is used in place of the standard one. Those are design
-- decisions held in src/lib/public/headerSurface.ts, not arithmetic.
--
-- DML only, so `node scripts/seed-header-background.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive: ON CONFLICT DO NOTHING, so a re-run leaves a
-- value an operator has since changed exactly as it is. Everything that reads
-- the key falls back to white when it is absent, so the site renders as it did
-- before this migration on a database that has not run it.

BEGIN;

INSERT INTO cms_content (section, key, value) VALUES
  ('header_settings', 'header_background', 'white')
ON CONFLICT (section, key) DO NOTHING;

COMMIT;
