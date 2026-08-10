-- 045_merge_about_into_home.sql
-- Merge /about into the home page and retire /about.
--
-- WHY THE MERGE IS MOSTLY DELETION
-- After 044 put the firm first on home, /about and / said largely the same
-- things. /about carried eight sections; six of them duplicated home in
-- substance: the same firm statistics, the same network summary, a hero that
-- restated the firm description, a founder card, a quote, and a closing CTA.
-- Only two pieces existed on /about and nowhere else, and only those two move.
--
-- WHAT MOVES
--   * "A boutique by design" (the firm introduction plus the short delivery
--     model summary) becomes a `paragraphs` section on home. Converted from
--     `text_image` on purpose: that renderer draws an empty gold-framed box when
--     it has no image, and /about had none, so importing the row as-is would put
--     an empty placeholder on the home page. The /about hero's firm description
--     is folded into the same copy rather than lost.
--   * "Firm credentials" moves by changing page_slug, so the row keeps its id
--     and content and nothing is retyped.
--
-- WHAT IS RETIRED
-- The founder card on home is replaced by a short mention. The brief is
-- explicit: name Ahmad as founding partner, link to the full profile, and do not
-- repeat the bio, the proof-point list, or the photo. `founder_block` cannot do
-- that, since it renders a monogram card even with no photo set, so the mention
-- is a `paragraphs` section with an inline link.
--
-- The /about quote is retired with the page. Recorded here so the wording is not
-- lost with the row:
--   "Capital allocators do not buy headcount. They buy judgment, the kind that
--    comes from having sat on every side of the table. That is what we offer,
--    and it is the only thing we offer."
--   Ahmad Din, Founding Partner, PaceMakers Business Consultants
--
-- FINAL HOME ORDER
--   hero, firm introduction, what we do, firm track record, firm credentials,
--   who we serve, delivery approach, founder mention, network, quote, CTA.
--
-- ORPHAN CLEANUP
-- Both the eight `page_sections` rows and the `cms_pages` row for `about` are
-- removed. `is_system` is cleared first: the admin delete guard refuses to
-- remove a system page, and that guard is the correct default, so this lifts it
-- deliberately for this one row rather than working around it.
--
-- Two hero CTAs elsewhere pointed at /about ("About the Firm" on /network,
-- "About PaceMakers" on the FMP page). Both now point at /, which is where that
-- content lives. The redirect would have caught them, but a link that redirects
-- is a link that is quietly wrong.
--
-- DML only, so `node scripts/seed-merge-about.mjs` applies it through
-- supabase-js. Idempotent: every statement is guarded on the state it changes,
-- so a second run does nothing.

BEGIN;

-- 1. Firm introduction, on home ---------------------------------------------
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT 'home', 'paragraphs', jsonb_build_object(
    'heading', 'A boutique by design.',
    'align', 'left',
    'html', '<p>PaceMakers Business Consultants is a corporate finance and transaction advisory firm serving family offices, investors, and developers across Saudi Arabia, the GCC, and worldwide. Founded in 2017 and restructured as a limited liability partnership in 2023, the firm is deliberately small, and structured so that seniority is not a scarce resource on your mandate.</p><p>The partner wins the engagement, leads it, and reviews every deliverable personally. Analysts and associates are engaged per engagement, so the work is properly resourced without a permanent pyramid to feed. That is a choice, not a limitation: it lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee. <a href="/approach">See how mandates are staffed</a>.</p>'
  ), '{}'::jsonb, 20, true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'home' AND content->>'heading' = 'A boutique by design.'
);

-- 2. Founder mention replaces the founder card on home -----------------------
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT 'home', 'paragraphs', jsonb_build_object(
    'heading', 'Led by Ahmad Din, founding partner.',
    'align', 'left',
    'html', '<p>Ahmad founded PaceMakers in 2017 and is the firm''s founding partner. He wins and leads every mandate and reviews every deliverable personally, drawing on twelve years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan. He is an ACCA Member (UK) and FMVA certified. <a href="/about/ahmad-din">Read the full profile</a>.</p>'
  ), '{}'::jsonb, 80, true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'home' AND content->>'heading' = 'Led by Ahmad Din, founding partner.'
);

DELETE FROM page_sections WHERE page_slug = 'home' AND section_type = 'founder_block';

-- 3. Firm credentials moves from /about to home, row and id intact -----------
UPDATE page_sections
SET page_slug = 'home', display_order = 50, updated_at = NOW()
WHERE page_slug = 'about'
  AND section_type = 'founder_credentials'
  AND content->>'heading' = 'Firm credentials';

-- 4. Home resequencing --------------------------------------------------------
UPDATE page_sections SET display_order = 10,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'hero';
UPDATE page_sections SET display_order = 20,  updated_at = NOW()
  WHERE page_slug = 'home' AND content->>'heading' = 'A boutique by design.';
UPDATE page_sections SET display_order = 30,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'service_cards' AND content->>'eyebrow' = 'WHAT WE DO';
UPDATE page_sections SET display_order = 40,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'stats_block';
UPDATE page_sections SET display_order = 50,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'founder_credentials';
UPDATE page_sections SET display_order = 60,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'service_cards' AND content->>'eyebrow' = 'WHO WE SERVE';
UPDATE page_sections SET display_order = 70,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'process_steps';
UPDATE page_sections SET display_order = 80,  updated_at = NOW()
  WHERE page_slug = 'home' AND content->>'heading' = 'Led by Ahmad Din, founding partner.';
UPDATE page_sections SET display_order = 90,  updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'text_image';
UPDATE page_sections SET display_order = 100, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'quote';
UPDATE page_sections SET display_order = 110, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'cta_block';

-- 5. Repoint the two CTAs that pointed at /about -----------------------------
UPDATE page_sections
SET content = content || jsonb_build_object('cta_secondary_href', '/'),
    updated_at = NOW()
WHERE section_type = 'hero'
  AND page_slug IN ('network', 'financial-modeler-pro')
  AND content->>'cta_secondary_href' = '/about';

-- 6. Navigation ---------------------------------------------------------------
-- "About" pointing at a personal profile would be a small bait and switch now
-- that the firm story lives on home, so the slot is relabelled rather than
-- repointed under the old name.
UPDATE site_pages
SET label = 'Founder', href = '/about/ahmad-din', updated_at = NOW()
WHERE href = '/about';

-- 7. Retire the page ----------------------------------------------------------
DELETE FROM page_sections WHERE page_slug = 'about';

UPDATE cms_pages SET is_system = false WHERE slug = 'about';
DELETE FROM cms_pages WHERE slug = 'about';

COMMIT;
