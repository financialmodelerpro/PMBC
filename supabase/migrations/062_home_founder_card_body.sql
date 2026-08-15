-- 062_home_founder_card_body.sql
--
-- Rewrites the home founder card's body so the page states the delivery model
-- once rather than twice.
--
-- DML only, no DDL, so `node scripts/seed-founder-card-body.mjs` applies it
-- through supabase-js. This file is the record; the script is the executable.
--
-- THE REPETITION
-- The firm introduction at display_order 20 said:
--
--   "The partner wins the engagement, leads it, and reviews every deliverable
--    personally. Analysts and associates are engaged per engagement, so the work
--    is properly resourced without a permanent pyramid to feed."
--
-- and the founder card at display_order 80, on the same scroll, said:
--
--   "Ahmad Din, the firm's founding partner, wins and leads every mandate, and
--    reviews every deliverable personally before it reaches a client. Analysts
--    and associates are engaged for each engagement as the work requires."
--
-- That is the same sentence twice, close enough that the second reads as an
-- editing accident rather than emphasis. It was flagged when migration 046
-- restored this card and left alone at the time, because trimming it meant
-- rewriting copy a brief had asked to restore verbatim. The brief has now asked
-- for the rewrite.
--
-- WHICH ONE KEEPS IT
-- The firm introduction. It is the firm's own paragraph, it reaches the reader
-- first, and the delivery model is a fact about the firm rather than about the
-- person. That leaves the card free to do the job a founder card should do, and
-- was not doing: say who Ahmad is, what he brings to a mandate, and why a client
-- should care.
--
-- WHAT REPLACED IT
-- Two paragraphs. The first is identity and range, drawn from the same facts as
-- the founder profile without copying its prose, since the two pages are
-- deliberately not identical (Critical Reminder 4). The second is the reason it
-- matters to a client, and it is where the old second paragraph's point about
-- senior judgment now lives. That point earned its place, but only folded into a
-- claim about what the judgment is for: knowing which assumptions hold. On its
-- own it was an assertion that any firm could make.
--
-- The numbers are deliberately absent from the body. They are already directly
-- underneath it as the proof-point list, labelled by migration 061 as the
-- partner's career record rather than the firm's, and repeating them in prose
-- would restate that list the way the old paragraph restated the introduction.
--
-- THE HEADING AND EYEBROW MOVE TOO
-- "Every mandate is partner-led." over "PARTNER-LED DELIVERY" is the same claim
-- a third time, in the largest type on the card. Cutting the restatement from
-- the body and leaving it in the headline would have fixed the paragraph and
-- kept the repetition, so both move to framing the person instead.

BEGIN;

UPDATE page_sections
SET content = content || jsonb_build_object(
  'eyebrow', 'THE FOUNDING PARTNER',
  'headline', 'The judgment behind the numbers.',
  'bio_html',
    '<p style="text-align: justify;">Ahmad Din has spent more than twelve years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan. He is an ACCA member (UK) and FMVA certified. The work has been concentrated where the numbers have to survive scrutiny: multi-billion riyal mixed-use developments, project finance for renewable and industrial assets, and the valuations and due diligence that decide whether a buyer proceeds.</p>'
    '<p style="text-align: justify;">What that brings to a mandate is judgment about which assumptions will hold. A model is only as good as the thinking behind its inputs, and knowing which of them survive diligence and which give way under questioning is what separates a defensible number from a plausible one. Where a figure will not hold, you will hear it from him early, while there is still time to change the structure.</p>'
),
updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'founder_block' AND display_order = 80;

COMMIT;
