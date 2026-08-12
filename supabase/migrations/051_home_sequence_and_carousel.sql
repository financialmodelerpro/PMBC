-- 051_home_sequence_and_carousel.sql
--
-- Three content changes to the home page. DML only, so
-- `npm run seed-home-sequence` applies it through supabase-js.
--
-- 1. "What we do" moves below the firm track record and stops listing the
--    catalogue. It was a six-card grid at 1267px, the tallest block on the
--    page, sitting between the firm introduction and the firm's own numbers.
--    Six cards on the home page is the services page rendered twice: /services
--    already lists all nine disciplines, each linking to a full write-up. The
--    section becomes a short statement of what the firm does with a CTA to
--    that page, and moves to display_order 45, immediately after the stats.
--
--    The section TYPE changes from service_cards to cta_block. Keeping
--    service_cards with fewer cards would have left a grid of two or three
--    items that reads as a truncated list rather than a deliberate summary,
--    and would have left the six card rows sitting in the JSONB where a later
--    editor would find and restore them.
--
-- 2. "Firm credentials" is deleted. Its six facts (established 2017, LLP,
--    SECP-registered, 30+ mandates, sectors, client geographies) are the same
--    six the stats block immediately above it already carries as figures. Two
--    presentations of one fact set, one under the other, reads as padding.
--
-- 3. "Who we serve" becomes an audience_carousel: one card at a time at the
--    full container width, each with an image, advancing on a timer with
--    arrows for manual control. The four audiences and their copy are carried
--    over unchanged; what changes is that each now has room for an image and a
--    paragraph rather than a third of a row.
--
--    image_url is seeded BLANK on all four. There is no stock imagery in this
--    repository and inventing a photograph of a family office would be worse
--    than an honest placeholder, so each card renders a navy monogram panel
--    until an operator uploads one through the page builder.
--
-- Idempotent. Every statement is guarded on the state it expects to find, so a
-- re-run after an operator has edited this copy is a no-op rather than a
-- rewrite.

-- ---------------------------------------------------------------------------
-- 1. "What we do": service_cards -> cta_block, moved to 45
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  section_type = 'cta_block',
  display_order = 45,
  content = jsonb_build_object(
    'eyebrow', 'WHAT WE DO',
    'headline', 'Corporate finance, end to end.',
    'subhead',
      'Financial modeling, valuation, due diligence, M&A, project finance, and the investor documentation that closes a transaction. Nine disciplines, one partner leading every one of them.',
    'cta_primary_label', 'View all services',
    'cta_primary_href', '/services',
    'cta_secondary_label', 'Book a Meeting',
    'cta_secondary_href', '/book'
  ),
  updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'service_cards'
  AND content->>'eyebrow' = 'WHAT WE DO';

-- ---------------------------------------------------------------------------
-- 2. Firm credentials: deleted
-- ---------------------------------------------------------------------------
DELETE FROM page_sections
WHERE page_slug = 'home'
  AND section_type = 'founder_credentials'
  AND content->>'heading' = 'Firm credentials';

-- ---------------------------------------------------------------------------
-- 3. "Who we serve": service_cards -> audience_carousel
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  section_type = 'audience_carousel',
  content = jsonb_build_object(
    'eyebrow', 'WHO WE SERVE',
    'headline', 'Capital allocators who buy advisory on judgment, not headcount.',
    'intro', '',
    'autoplay_seconds', 6,
    'items', jsonb_build_array(
      jsonb_build_object(
        'title', 'Family Offices',
        'description', 'Investment structuring, opportunity evaluation, and portfolio-level financial analysis for single-family and multi-family offices in KSA and the GCC.',
        'image_url', '',
        'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Investment Offices',
        'description', 'Deal-level modeling, valuation, and due diligence support, supplementing in-house teams on selective mandates.',
        'image_url', '',
        'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Real Estate Developers',
        'description', 'Feasibility, mixed-use modeling, lender-grade financial structuring, and capital-raising support across residential, commercial, and hospitality.',
        'image_url', '',
        'image_alt', ''
      ),
      jsonb_build_object(
        'title', 'Corporates and Sponsors',
        'description', 'M&A, valuation, project finance, and investor documentation for strategic transactions and capital events.',
        'image_url', '',
        'image_alt', ''
      )
    )
  ),
  updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'service_cards'
  AND content->>'eyebrow' = 'WHO WE SERVE';
