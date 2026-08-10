-- 044_firm_prominence.sql
-- Reposition the site from "one person" to "a firm led by a partner", without
-- weakening the senior-led promise.
--
-- THE HONESTY PROBLEM THIS FIXES
-- The home and about stats presented the founder's career totals as the firm's
-- track record: 200+ valuations, SAR 20B+ real estate NAV modeled, SAR 300M+
-- capital deployed via equity research. Those are Ahmad's, earned across twelve
-- years and several employers, not PaceMakers' record since 2017. Presenting
-- them as firm statistics overstates the firm and, worse, makes the genuinely
-- strong figures deniable when a prospect checks. They move to the partner's
-- credentials, explicitly labelled as his career. The firm gets its own,
-- smaller, true numbers.
--
-- DELIVERY REALITY REFLECTED
--   * The partner wins and leads every mandate and reviews all work personally.
--   * Analysts and associates are engaged per engagement. No permanent pyramid,
--     no junior handoff. Individual analysts are deliberately not named.
--   * Sky Gulf and Lynkers are referral and market-access relationships. They do
--     not execute mandates. The previous copy called Sky Gulf an "Execution
--     Partner", which was the single most misleading claim on the site.
--
-- WHAT CHANGES
--   1. home + about stats_block  -> firm facts (30+ mandates, 2017, SECP LLP,
--      6 sectors served). Career figures move to the founder cards.
--   2. Founder language -> partner-led phrasing across home, about and the
--      founder profile, with Ahmad named as the partner.
--   3. NEW founder_credentials section on /approach: "How mandates are staffed".
--   4. /network reframed as origination, referral and market access.
--   5. NEW founder_credentials section on /about: "Firm credentials", distinct
--      from the partner's.
--   6. home resequenced so the firm precedes the founder: hero, what we do,
--      track record, who we serve, delivery approach, founder, network, quote,
--      CTA.
--
-- Also fixes a live typo: the home hero CTA read "Book a Meetng".
--
-- The sector list is the firm's real one, per Critical Reminder 3 in CLAUDE.md:
-- biofuel, oil and gas, waste management, data centers, construction, and
-- industrial services. Ahmad's broader sector experience stays on his profile.
--
-- DML only, so `node scripts/seed-firm-prominence.mjs` applies it through
-- supabase-js, and that script is the authoritative applier. It writes only
-- fields whose value differs and reports each one, so a second run immediately
-- after the first changes nothing.
--
-- NOT guarded against later operator edits: re-running restores this copy over
-- any subsequent rewording of the same fields. Run it once.

BEGIN;

-- 1. Firm statistics, replacing the founder's career totals ------------------
UPDATE page_sections
SET content = content || jsonb_build_object(
      'intro', 'The firm''s own record since 2017. The partner''s wider career experience is set out separately, in his profile.',
      'stats', jsonb_build_array(
        jsonb_build_object('value', '30+',  'label', 'Mandates Delivered'),
        jsonb_build_object('value', '2017', 'label', 'Established'),
        jsonb_build_object('value', 'LLP',  'label', 'SECP Registered'),
        jsonb_build_object('value', '6',    'label', 'Sectors Served')
      )
    ),
    updated_at = NOW()
WHERE section_type = 'stats_block'
  AND page_slug IN ('home', 'about');

-- 2. Partner-led founder cards, carrying the career figures ------------------
UPDATE page_sections
SET content = content || jsonb_build_object(
      'eyebrow', 'PARTNER-LED DELIVERY',
      'headline', 'Every mandate is partner-led.',
      'bio_html', '<p>At many boutique firms the partner wins the engagement and hands the work to a junior team. PaceMakers is structured the other way. Ahmad Din, the firm''s founding partner, wins and leads every mandate, and reviews every deliverable personally before it reaches a client. Analysts and associates are engaged for each engagement as the work requires.</p><p>That is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, and every recommendation, with the capacity to resource the work properly.</p>',
      'credentials_line', 'Founding Partner · ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
      'credentials', jsonb_build_array(
        '200+ advisory engagements across his career',
        '200+ business valuations delivered',
        'SAR 20B+ real estate NAV modeled',
        'SAR 300M+ capital deployed via equity research',
        'ACWA Power Central Asia renewables and Saudi Aramco-backed industrial projects'
      )
    ),
    updated_at = NOW()
WHERE section_type = 'founder_block' AND page_slug = 'home';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'eyebrow', 'THE FOUNDING PARTNER',
      'bio_html', '<p>Ahmad founded PaceMakers in 2017 to bring senior, analytically grounded advisory to the mandates that larger firms either skip or under-staff. He is the firm''s founding partner: he wins and leads every mandate and reviews every deliverable personally, supported by analysts and associates engaged for each engagement.</p><p>Over twelve years in corporate finance his own work has spanned multi-billion riyal real estate portfolios, ACWA Power''s Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects. He is an ACCA Member (UK) and FMVA-certified.</p>',
      'credentials_line', 'Founding Partner · ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
      'cta_primary_label', 'Read Full Profile',
      'cta_primary_href', '/about/ahmad-din',
      'credentials', jsonb_build_array(
        '200+ advisory engagements across his career',
        '200+ business valuations delivered',
        'SAR 20B+ real estate NAV modeled',
        'SAR 300M+ capital deployed via equity research',
        'ACWA Power Central Asia renewables and Saudi Aramco-backed industrial projects'
      )
    ),
    updated_at = NOW()
WHERE section_type = 'founder_block' AND page_slug = 'about';

-- Quote attributions move from Founder to Founding Partner.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'attribution_role', 'Founding Partner, PaceMakers Business Consultants'
    ),
    updated_at = NOW()
WHERE section_type = 'quote'
  AND content->>'attribution_role' = 'Founder, PaceMakers Business Consultants';

-- Home hero typo, and the "Email Ahmad Directly" CTA which framed the firm as
-- one inbox.
UPDATE page_sections
SET content = content || jsonb_build_object('cta_label', 'Book a Meeting'),
    updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'hero'
  AND content->>'cta_label' = 'Book a Meetng';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'cta_secondary_label', 'Email the Firm',
      'cta_secondary_href', 'mailto:advisory@pacemakersglobal.com'
    ),
    updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'cta_block';

-- Home "what we do" intro said each engagement is led by Ahmad by name.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'intro', 'Six core capabilities, applied to the moments that matter most: capital raises, acquisitions, structuring decisions, and exits. Every engagement is partner-led and built on lender-grade modeling discipline.'
    ),
    updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'service_cards'
  AND content->>'eyebrow' = 'WHAT WE DO';

-- 3. Delivery model on /approach ---------------------------------------------
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT 'approach', 'founder_credentials', jsonb_build_object(
    'eyebrow', 'DELIVERY MODEL',
    'heading', 'How mandates are staffed',
    'display', 'cards',
    'intro', 'Every mandate is won and led by the partner, and every deliverable is reviewed by him personally before it leaves the firm. Analysts and associates are engaged for each engagement as the work requires. PaceMakers does not carry a permanent pyramid, and no mandate is handed down to a junior team once the engagement letter is signed.',
    'items', jsonb_build_array(
      'Partner-led. Ahmad Din wins the mandate, scopes it, and stays accountable for it through to close.',
      'Personally reviewed. Every model, memorandum, and recommendation is reviewed by the partner before it reaches a client.',
      'Resourced per engagement. Analysts and associates are brought in for the work a mandate actually needs, rather than staffed to fill a bench.'
    )
  ), '{}'::jsonb, 25, true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'approach' AND content->>'heading' = 'How mandates are staffed'
);

-- 5. Firm credentials on /about, distinct from the partner's -----------------
INSERT INTO page_sections (page_slug, section_type, content, styles, display_order, visible)
SELECT 'about', 'founder_credentials', jsonb_build_object(
    'eyebrow', 'THE FIRM',
    'heading', 'Firm credentials',
    'display', 'cards',
    'intro', 'PaceMakers Business Consultants LLP is a registered limited liability partnership. These are the firm''s own credentials, distinct from the partner''s career record.',
    'items', jsonb_build_array(
      'Established 2017',
      'Restructured as a limited liability partnership in 2023',
      'Registered with the Securities and Exchange Commission of Pakistan',
      '30+ mandates delivered',
      'Sectors served: biofuel, oil and gas, waste management, data centers, construction, and industrial services',
      'Clients across Saudi Arabia, the GCC, and worldwide'
    )
  ), '{}'::jsonb, 35, true
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections
  WHERE page_slug = 'about' AND content->>'heading' = 'Firm credentials'
);

-- The /about firm block gains the short delivery-model summary and points at
-- the full explanation on /approach.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'body_html', '<p>PaceMakers is deliberately small, and structured so that seniority is not a scarce resource on your mandate. The partner wins the engagement, leads it, and reviews every deliverable personally. Analysts and associates are engaged per engagement, so the work is properly resourced without a permanent pyramid to feed.</p><p>That is a choice, not a limitation. It lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee.</p>',
      'cta_label', 'How mandates are staffed',
      'cta_href', '/approach'
    ),
    updated_at = NOW()
WHERE page_slug = 'about' AND section_type = 'text_image'
  AND content->>'eyebrow' = 'THE FIRM';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'body_html', '<p>Every engagement is led personally by the partner who scoped it, and every deliverable is reviewed by him before it reaches you. There are no junior pass-throughs and no black-box deliverables you cannot interrogate. If a number moves, you will know which assumption moved it.</p><p>Three things hold across every mandate: the model is built to be read, not just run; the assumptions are honest about risk, not tuned to flatter; and the advice is the advice we would act on with our own capital.</p>'
    ),
    updated_at = NOW()
WHERE page_slug = 'approach' AND section_type = 'text_image'
  AND content->>'eyebrow' = 'WHAT STAYS CONSTANT';

-- 4. /network as origination and market access, not delivery -----------------
UPDATE page_sections
SET content = content || jsonb_build_object(
      'headline', 'Origination, referral, and market access.',
      'subtitle', 'Two long-standing relationships extend PaceMakers'' reach across the Gulf. They introduce opportunities and open doors. They do not deliver mandates: every engagement is executed by PaceMakers, partner-led.'
    ),
    updated_at = NOW()
WHERE page_slug = 'network' AND section_type = 'hero';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'heading', 'Two relationships, one standard.',
      'intro', 'These are referral and market-access relationships, not delivery partners. PaceMakers executes every mandate itself. The network is how work reaches us, and how clients reach markets they do not already sit in.',
      'partners', jsonb_build_array(
        jsonb_build_object(
          'name', 'Sky Gulf',
          'location', 'Al Khobar, Saudi Arabia',
          'role_tag', 'Referral Relationship',
          'logo_url', '', 'link', '',
          'description', 'Headquartered in the Eastern Province, Sky Gulf originates and refers industrial and project mandates in Saudi Arabia, and opens doors to counterparties where the assets are. Sky Gulf does not execute PaceMakers engagements.'
        ),
        jsonb_build_object(
          'name', 'Lynkers',
          'location', 'Manama, Bahrain',
          'role_tag', 'Equity Shareholder and Referral',
          'logo_url', '', 'link', '',
          'description', 'Based in Manama and a strategic equity shareholder in PaceMakers, Lynkers provides Bahrain market access, capital-markets insight, and introductions to the regional banking and investor network. Delivery of any resulting mandate stays with PaceMakers.'
        )
      )
    ),
    updated_at = NOW()
WHERE page_slug = 'network' AND section_type = 'network_partners';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'heading', 'Reach that opens doors, delivery that stays in house.',
      'body_html', '<p>A large firm sells you its logo and staffs you with whoever is available. PaceMakers works the other way. The network is how mandates originate and how clients reach markets they do not already sit in: introductions, local presence, and capital-markets contacts.</p><p>Execution does not travel with it. Every engagement is delivered by PaceMakers, led by the partner, and resourced with analysts and associates engaged for that mandate. The people who win the work are the people accountable for it.</p>'
    ),
    updated_at = NOW()
WHERE page_slug = 'network' AND section_type = 'text_image';

-- The network summaries on home and about carry the same correction.
UPDATE page_sections
SET content = content || jsonb_build_object(
      'eyebrow', 'ORIGINATION AND MARKET ACCESS',
      'heading', 'Reach across the Gulf, delivery in house.',
      'body_html', '<p>Two long-standing relationships extend PaceMakers'' reach across the Gulf. Sky Gulf, headquartered in Al Khobar, originates and refers industrial and project mandates in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in the firm, provides Bahrain market access and capital-markets introductions.</p><p>Both are referral and market-access relationships. Neither executes mandates: every engagement is delivered by PaceMakers, partner-led.</p>'
    ),
    updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'text_image';

UPDATE page_sections
SET content = content || jsonb_build_object(
      'eyebrow', 'ORIGINATION AND MARKET ACCESS',
      'heading', 'Reach that opens doors.',
      'body_html', '<p>Two long-standing relationships extend PaceMakers'' reach across the Gulf. Sky Gulf, headquartered in Al Khobar, originates and refers industrial and project mandates in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in the firm, provides Bahrain market access and capital-markets introductions.</p><p>Both are referral and market-access relationships. Neither executes mandates: every engagement is delivered by PaceMakers, partner-led.</p>'
    ),
    updated_at = NOW()
WHERE page_slug = 'about' AND section_type = 'text_image'
  AND content->>'eyebrow' = 'REACH WITHOUT THE OVERHEAD';

-- 2b. Founder profile: partner framing plus the career figures ---------------
UPDATE page_sections
SET content = content || jsonb_build_object(
      'eyebrow', 'Founding Partner',
      'intro', 'Founding partner of PaceMakers Business Consultants. 12+ years in corporate finance and transaction advisory across KSA and Pakistan. ACCA Member (UK) and FMVA certified. He wins and leads every PaceMakers mandate and reviews every deliverable personally.'
    ),
    updated_at = NOW()
WHERE page_slug = 'about-ahmad-din' AND section_type = 'founder_hero';

-- 6. Home resequencing: the firm before the founder --------------------------
UPDATE page_sections SET display_order = 20, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'service_cards' AND content->>'eyebrow' = 'WHAT WE DO';
UPDATE page_sections SET display_order = 40, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'service_cards' AND content->>'eyebrow' = 'WHO WE SERVE';
UPDATE page_sections SET display_order = 50, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'process_steps';
UPDATE page_sections SET display_order = 60, updated_at = NOW()
  WHERE page_slug = 'home' AND section_type = 'founder_block';

COMMIT;
