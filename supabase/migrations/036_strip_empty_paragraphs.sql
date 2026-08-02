-- 036_strip_empty_paragraphs.sql
-- Remove stored empty paragraphs from page_sections content.
--
-- Word, Google Docs and TipTap all express a blank line between paragraphs as
-- an empty <p></p>. `.pmbc-prose p` already carries a bottom margin, so an
-- empty paragraph adds a second gap on top of the real one. Authors are not
-- consistent about inserting them, so a pasted document ends up with some
-- boundaries separated by one margin and others by two, and the text column
-- loses its rhythm.
--
-- Rendering already handles this: `sanitizeRichHtml` drops empty paragraphs
-- before output, so the public site is correct with or without this migration.
-- This exists so the STORED value matches what renders, which means the admin
-- editor shows the author the same thing the visitor sees. Without it the two
-- disagree until someone happens to re-save each section.
--
-- Scope when written: 7 empty paragraphs across 2 sections on about-ahmad-din,
-- both pasted in through the admin after the page was seeded. The statement is
-- written generally rather than against those ids, since the same paste habit
-- will produce more.
--
-- Only the fully empty form is matched here. Variants such as <p>&nbsp;</p> or
-- <p><br></p> are handled at render, and the companion script uses the same
-- richText.ts logic as the application, so it catches every form this SQL does
-- and more.
--
-- DML only, so `node scripts/strip-empty-paragraphs.mjs` applies it through
-- supabase-js. Idempotent: re-running finds nothing left to change.

BEGIN;

UPDATE page_sections
SET content = jsonb_set(
      content,
      '{html}',
      to_jsonb(regexp_replace(content->>'html', '<p>\s*</p>', '', 'g')),
      false
    ),
    updated_at = NOW()
WHERE content ? 'html'
  AND content->>'html' ~ '<p>\s*</p>';

COMMIT;
