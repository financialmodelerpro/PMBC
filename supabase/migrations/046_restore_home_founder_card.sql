-- 046_restore_home_founder_card.sql
-- Restore the full founder card on the home page.
--
-- WHAT HAPPENED
-- Migration 045 merged /about into home. In the process it replaced the home
-- `founder_block` card with a short `paragraphs` mention: a heading, one
-- sentence, and a link. That was the right call for the question 045 was
-- answering (do not repeat /about's founder card on the same page it was
-- merged into), but it removed more than the duplication: the portrait, the
-- credentials line, the two-paragraph bio, and the five proof points all went
-- with it, and none of those existed anywhere else on home.
--
-- WHAT COMES BACK
-- The card as it stood immediately before the merge, which is the state
-- migration 044 left it in:
--   * eyebrow and headline in partner-led framing, not "Ahmad leads every
--     mandate". 044 moved the site off that phrasing deliberately and this
--     does not walk it back.
--   * the credentials line naming him as founding partner,
--   * the two-paragraph bio explaining the delivery model,
--   * the five proof points, which are his CAREER figures and are labelled as
--     such. They are on his card for exactly the reason 044 put them there:
--     they are not the firm's track record, and the firm's own numbers stay in
--     the stats block above.
--
-- The photo is NOT hardcoded. It is read from whichever `founder_hero` carries
-- one, the same way 037 sourced it, so a rebuild against a different Supabase
-- project picks up that project's storage URL rather than this one's, and a
-- fresh database with no portrait uploaded yet gets an empty string and the
-- monogram fallback instead of a broken path.
--
-- CTAS
-- "Read the full profile" to /about/ahmad-din as the quiet underlined link,
-- and "Book a Meeting" to /book as the solid navy button. That pairing is the
-- one Phase 21.5 established: the primary is the reference, the secondary is
-- the action, and FounderBlock renders them as a hierarchy rather than as two
-- equal-weight links.
--
-- POSITION
-- display_order 80, unchanged, so the card sits where the mention sat: after
-- the delivery approach and before the network block. The rest of the home
-- sequence is untouched, so no resequencing statement is needed here.
--
-- The mention is deleted rather than kept. Both say the same thing about the
-- same person, and leaving the paragraph under the card would read as an
-- editing accident.
--
-- DML only, so `node scripts/seed-restore-founder-card.mjs` applies it through
-- supabase-js. Idempotent: the insert is guarded on the card being absent, and
-- the delete is a natural no-op once done.

BEGIN;

-- 1. The card ----------------------------------------------------------------
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT 'home', 'founder_block', jsonb_build_object(
    'eyebrow', 'PARTNER-LED DELIVERY',
    'headline', 'Every mandate is partner-led.',
    'name', 'Ahmad Din',
    'credentials_line', 'Founding Partner · ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
    'photo_url', COALESCE((
      SELECT content->>'photo_url'
      FROM page_sections
      WHERE section_type = 'founder_hero'
        AND COALESCE(content->>'photo_url', '') <> ''
      ORDER BY updated_at DESC
      LIMIT 1
    ), ''),
    'bio_html', '<p>At many boutique firms the partner wins the engagement and hands the work to a junior team. PaceMakers is structured the other way. Ahmad Din, the firm''s founding partner, wins and leads every mandate, and reviews every deliverable personally before it reaches a client. Analysts and associates are engaged for each engagement as the work requires.</p><p>That is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, and every recommendation, with the capacity to resource the work properly.</p>',
    'credentials', jsonb_build_array(
      '200+ advisory engagements across his career',
      '200+ business valuations delivered',
      'SAR 20B+ real estate NAV modeled',
      'SAR 300M+ capital deployed via equity research',
      'ACWA Power Central Asia renewables and Saudi Aramco-backed industrial projects'
    ),
    'cta_primary_label', 'Read the full profile',
    'cta_primary_href', '/about/ahmad-din',
    'cta_secondary_label', 'Book a Meeting',
    'cta_secondary_href', '/book',
    'layout', 'image_left'
  ), '{}'::jsonb, 80, true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'home' AND section_type = 'founder_block'
);

-- 2. The mention it replaces --------------------------------------------------
DELETE FROM page_sections
WHERE page_slug = 'home'
  AND section_type = 'paragraphs'
  AND content->>'heading' = 'Led by Ahmad Din, founding partner.';

COMMIT;
