-- 097_network_skygulf_logo_size.sql
-- Network page (2026-10-09): sets the Sky Gulf partner card's new "Logo size"
-- to Smaller, so its wide, solid, coloured mark sits at a visual weight closer
-- to the Lynker line-art logo beside it. Every other partner, and every other
-- section, is untouched. The value stays editable in the page builder under
-- Network partners, Logo size, and can be set back to Standard there.
--
-- DML on page_sections.content. Run by hand in the Supabase SQL editor.
--
-- SAFE TO APPLY: after the deploy that reads `logo_size` (the commit adding
-- src/lib/public/partnerLogo.ts). Applied before it, the key is stored and
-- ignored, and the logo renders at today's size until that deploy is live.
--
-- Idempotent: it only sets one key on the partner named Sky Gulf, so a re-run
-- writes the same value. Partner order and every other key are preserved.
-- Changes nothing if no Network partners section holds a partner of that name.

BEGIN;

UPDATE page_sections ps
SET content = jsonb_set(
      ps.content,
      '{partners}',
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN t.p ->> 'name' = 'Sky Gulf'
                     THEN t.p || '{"logo_size": "smaller"}'::jsonb
                   ELSE t.p
                 END
                 ORDER BY t.ord
               )
        FROM jsonb_array_elements(ps.content -> 'partners') WITH ORDINALITY AS t(p, ord)
      )
    ),
    updated_at = now()
WHERE ps.section_type = 'network_partners'
  AND jsonb_typeof(ps.content -> 'partners') = 'array'
  AND ps.content -> 'partners' @> '[{"name": "Sky Gulf"}]'::jsonb;

COMMIT;
