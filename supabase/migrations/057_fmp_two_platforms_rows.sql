-- 057_fmp_two_platforms_rows.sql
-- The /fmp "Two platforms" block becomes two full-width rows.
--
-- WHAT WAS WRONG
-- Modeling Hub and Training Hub sat side by side as two cards. Two cards in a
-- row are only as short as the taller one, and Training Hub carries fewer
-- bullets, so it rendered with a visible gap between its last bullet and its
-- CTA. The CTA is pinned to the bottom of the card on purpose, so that gap is
-- what the layout does when the two columns are unequal, not a mistake in the
-- copy. Stacking removes the comparison rather than papering over it.
--
-- It also buys width. Both descriptions were written as prose and were reading
-- in a 45-character column.
--
-- WHAT THIS CHANGES
--   1. `layout` on the section becomes 'rows'. Absent or anything else means
--      'cards', so every other feature_cards block is untouched.
--   2. Each card gains the standard media key set, seeded BLANK.
--
-- The media slots are empty by design. There is no stock imagery in this
-- repository, and a made-up screenshot of a platform is worse than an honest
-- placeholder: an empty slot renders the same navy monogram panel an audience
-- carousel card shows before its image is uploaded, so the row keeps the shape
-- it will have once filled. The keys are seeded rather than left absent so the
-- stored JSON documents the slot, following migration 043.
--
-- Side alternation is not stored. The first row puts its media on the right and
-- they alternate from there, which is a property of the layout rather than of a
-- card: storing it per card would let an operator set both rows to the same
-- side and lose the alternation the layout exists for.
--
-- DML only, so `npm run seed-fmp-two-platforms` applies it. Idempotent and
-- guarded: the update only fires while the section is still on the cards
-- layout, so a re-run cannot overwrite a later edit.

BEGIN;

UPDATE page_sections
SET content = jsonb_set(
      content || jsonb_build_object('layout', 'rows'),
      '{cards}',
      (
        SELECT jsonb_agg(
          card || jsonb_build_object(
            'media_url', '',
            'media_type', 'image',
            'media_poster_url', '',
            'media_alt', ''
          )
          ORDER BY ord
        )
        FROM jsonb_array_elements(content->'cards') WITH ORDINALITY AS t(card, ord)
      )
    ),
    updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro'
  AND section_type = 'feature_cards'
  AND content->>'eyebrow' = 'THE TWO HALVES'
  AND COALESCE(content->>'layout', 'cards') = 'cards';

COMMIT;
