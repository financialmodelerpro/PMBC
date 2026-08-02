-- 035_founder_prose_alignment.sql
-- Justify the long-form prose blocks on the founder profile page.
--
-- The `align` key on a `paragraphs` section arrived with the alignment dropdown
-- in the paragraphs editor. It defaults to 'left', so every section authored
-- before the field existed keeps rendering exactly as it did, and only the
-- blocks named here opt in to justified setting.
--
-- Applies to the two long-form blocks only. Market Focus and Personal are a
-- single short paragraph each, where justification has nothing to even out and
-- would just stretch one line.
--
-- Migration 034 is left untouched: it has been applied, and applied migrations
-- are never edited. A rebuild runs 034 then 035 and lands in the same place.
--
-- DML only, so `node scripts/seed-founder-alignment.mjs` applies it through
-- supabase-js. Idempotent: re-running sets the same value.

BEGIN;

UPDATE page_sections
SET content = content || jsonb_build_object('align', 'justify'),
    updated_at = NOW()
WHERE page_slug = 'about-ahmad-din'
  AND section_type = 'paragraphs'
  AND display_order IN (20, 30);

COMMIT;
