-- 053_home_network_mention_and_fmp_carousel.sql
--
-- Two content changes. DML only, so `npm run seed-network-and-fmp-carousel`
-- applies it through supabase-js.
--
-- 1. The home network block becomes a short mention.
--
--    It was a full `text_image`: two justified paragraphs naming both partners
--    and their cities, beside a gold-framed video, at 710px. /network already
--    carries all of that at length. On home it only needs to say the firm has
--    reach and point at the page that explains it, so it becomes a three
--    sentence `paragraphs` section with an inline link.
--
--    The section type changes from `text_image` to `paragraphs` because
--    `text_image` draws an empty gold-framed box when it has no image, so a
--    text-only version of it would leave a placeholder on the page. That is the
--    same reason migration 045 converted the firm introduction.
--
--    THE VIDEO IS DROPPED. It is not deleted from storage and the URL is
--    recorded here, so restoring it is one paste into the page builder's Media
--    panel:
--
--      https://yackrfoesinnothbltlc.supabase.co/storage/v1/object/public/
--      cms-assets/1786358965024_strategic-network-video.mp4
--
--    It goes because the video is what made this a block rather than a mention:
--    keeping it would have kept the two-column treatment the change exists to
--    remove.
--
-- 2. "Who it is for" on /fmp becomes a carousel.
--
--    The same `audience_carousel` type the home "Who we serve" block uses, so
--    the two audience sections on the site behave identically: one wide card at
--    a time, an image beside the copy, six seconds a card, arrows, and a hold
--    on hover, on keyboard focus, and while off screen.
--
--    All six audiences and their copy carry over unchanged. What is lost is the
--    01 to 06 numbering, which a carousel replaces with its own position
--    indicator, and what is gained is an image slot per card.
--
--    image_url is seeded BLANK on all six, as it was for the home carousel.
--    Each card renders a navy monogram panel until an operator uploads one.
--
-- Idempotent. Both statements are guarded on the state they expect to find.

-- ---------------------------------------------------------------------------
-- 1. home: the network block becomes a mention
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  section_type = 'paragraphs',
  content = jsonb_build_object(
    'heading', 'Reach across the Gulf, delivery in house.',
    'align', 'left',
    'html',
      '<p>Two long-standing relationships extend the firm''s reach across the Gulf: Sky Gulf in Al Khobar and Lynkers in Manama. Both originate and refer mandates and open local doors. Neither executes them: every engagement is delivered by PaceMakers, partner-led. <a href="/network">Meet the network</a>.</p>'
  ),
  updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'text_image'
  AND content->>'cta_href' = '/network';

-- ---------------------------------------------------------------------------
-- 2. /fmp: "Who it is for" becomes an audience carousel
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  section_type = 'audience_carousel',
  content = jsonb_build_object(
    'eyebrow', 'WHO IT IS FOR',
    'headline', 'Built for the people who have to defend the numbers.',
    'intro', 'The platform assumes a working knowledge of finance and no patience for a course that never reaches a model.',
    'autoplay_seconds', 6,
    'items', jsonb_build_array(
      jsonb_build_object(
        'title', 'Financial Analysts',
        'description', 'Build a complete, balanced model without starting from an empty workbook every time. The structure, the schedules and the checks are already in place, so the work goes into the assumptions rather than into wiring up the mechanics.',
        'image_url', '', 'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Investment Professionals',
        'description', 'Screen and underwrite opportunities on a consistent basis. Scenario analysis compares cases side by side, and the IC presentation builder turns the result into a deck whose figures stay linked to the model behind it.',
        'image_url', '', 'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Real Estate Developers',
        'description', 'Model a phased, multi-asset development properly: mixed unit programmes, construction drawn against a facility with interest capitalised during the build, instalment revenue, and an equity waterfall that survives a lender review.',
        'image_url', '', 'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Family Offices',
        'description', 'Review your own holdings rather than outsourcing the review. Test a sponsor case yourself, see which assumptions carry the return, and hold an independent view before committing capital.',
        'image_url', '', 'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Lenders and Banks',
        'description', 'Interrogate a borrower model on your own terms. DSCR, debt sizing, sculpting and covenant headroom are computed explicitly, so a credit team can stress the case rather than accept a sponsor summary.',
        'image_url', '', 'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Students and Aspiring Analysts',
        'description', 'Learn the method that firms actually use, then prove it. Both certification paths are free, assessed rather than attendance-based, and end in a certificate an employer can verify online.',
        'image_url', '', 'image_alt', ''
      )
    )
  ),
  updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro'
  AND section_type = 'service_cards'
  AND content->>'eyebrow' = 'WHO IT IS FOR';

-- ---------------------------------------------------------------------------
-- 3. Both carousels hold at six seconds a card.
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET content = content || jsonb_build_object('autoplay_seconds', 6), updated_at = NOW()
WHERE section_type = 'audience_carousel'
  AND (content->>'autoplay_seconds') IS DISTINCT FROM '6';

-- ---------------------------------------------------------------------------
-- 4. Pre-rule en dashes in the nine service timeline strings.
--
-- Seeded by migration 010, before the no-dash rule existed, and listed in
-- CLAUDE.md as known pre-rule content to fix when next touched rather than in a
-- dash-only pass. The whole-table sweep in this migration's seed script is what
-- next touched them, so they are fixed here: "3-5 weeks" becomes "3 to 5 weeks",
-- which is the substitution the style rules name for a range.
--
-- Only a dash BETWEEN DIGITS is rewritten. That is the one case where the
-- replacement is unambiguous. A dash anywhere else is a sentence the author
-- shaped, so the seed script reports it and stops rather than guessing at a
-- comma or a full stop.
-- ---------------------------------------------------------------------------
UPDATE cms_content
SET value = regexp_replace(value, '(\d)\s*[' || chr(8211) || chr(8212) || ']\s*(\d)', '\1 to \2', 'g'),
    updated_at = NOW()
WHERE value ~ '\d\s*[' || chr(8211) || chr(8212) || ']\s*\d';

UPDATE page_sections
SET content = (
      regexp_replace(content::text, '(\d)\s*[' || chr(8211) || chr(8212) || ']\s*(\d)', '\1 to \2', 'g')
    )::jsonb,
    updated_at = NOW()
WHERE content::text ~ '\d\s*[' || chr(8211) || chr(8212) || ']\s*\d';
