-- 110_home_founder_from_team.sql
--
-- The home page founder block reads the founding partner's Team & Advisors
-- record instead of its own copies (owner's instruction, 2026-10-12): name,
-- photo, credentials line, bio, proof points and the profile link. The
-- section keeps only its framing (eyebrow, headline, proof points label,
-- button labels, layout).
--
--   1. His Short bio becomes the two paragraphs the home block shows today
--      ("Ahmad Din has spent more than twelve years..."), chosen by the owner,
--      so the home page reads the same and his /team card shows it too. The
--      previous one-paragraph bio is replaced.
--   2. His profile's "Experience & Background" list (the same five proof
--      points the home block shows today) is marked "Show on team card", the
--      source of the home block's proof points.
-- The home section's stored copies are left in place and ignored by the code
-- that reads this; they are the fallback if his record cannot be read.
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner.
--
-- SAFE TO APPLY: before the deploy that reads it (apply this first). Before
-- that deploy, only /team changes: his card shows the two paragraphs, and the
-- marked list is ignored. Applying after the deploy instead would show his old
-- one-paragraph bio on the home page until this runs.
--
-- SAFE ON RE-RUN, never destructive: the bio is copied only while it differs
-- from the home text, and the list is marked only while unmarked. Nothing is
-- deleted.
--
-- Check after applying:
--   SELECT left(bio, 60) FROM team_members WHERE profile_slug = 'about-ahmad-din';
--   SELECT content->>'heading', content->'show_on_card' FROM page_sections
--   WHERE page_slug = 'about-ahmad-din' AND section_type = 'founder_credentials'
--   ORDER BY display_order;

BEGIN;

UPDATE team_members tm
SET bio = ps.content->>'bio_html'
FROM page_sections ps
WHERE tm.profile_slug = 'about-ahmad-din'
  AND ps.page_slug = 'home'
  AND ps.section_type = 'founder_block'
  AND coalesce(ps.content->>'bio_html', '') <> ''
  AND tm.bio IS DISTINCT FROM ps.content->>'bio_html';

UPDATE page_sections
SET content = content || '{"show_on_card": true}'::jsonb
WHERE page_slug = 'about-ahmad-din'
  AND section_type = 'founder_credentials'
  AND content->>'heading' = 'Experience & Background'
  AND NOT (content ? 'show_on_card');

COMMIT;
