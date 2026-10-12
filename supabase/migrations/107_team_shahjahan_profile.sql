-- 107_team_shahjahan_profile.sql
--
-- One card shape for every team member except the founding partner (owner's
-- instruction, 2026-10-12): a small standard card on /team (qualification,
-- experience, location and up to three key highlights; see 108) with "Read
-- the full profile" through to a profile page holding everything else.
--
--   1. Muhammad Shahjahan gets a profile page at /team/muhammad-shahjahan: a
--      cms_pages row and four page-builder sections, the same section types
--      /team/kaleem-farooq uses.
--        10  founder_hero          name, role, location, intro (his card bio)
--        20  founder_credentials   Selected experience  (display: numbered)
--        30  founder_credentials   Areas of expertise   (display: pills)
--        40  paragraphs            His role at PaceMakers
--      The hero, experience and expertise are the owner's approved copy from
--      migration 102, verbatim. The role paragraph states the standing delivery
--      model and names no client or figure.
--   2. His team card's profile_type becomes "full" (kept tidy; since 108 the
--      card no longer reads it).
--   3. Kaleem Farooq's card gains three "Selected experience" lines, condensed
--      from his own profile's Career highlights, so his card shows key
--      highlights like every other card. Set only while the list is empty.
--
-- The hero name must equal the team card name ("Muhammad Shahjahan, ACMA"):
-- that is how /team matches a card to its profile page.
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner.
--
-- SAFE TO APPLY: right after the deploy that serves /team/muhammad-shahjahan.
-- Before that deploy, his card would turn "full" with no page to link to and
-- show the bio alone. After the deploy but before this runs, his card stays
-- compact exactly as today and the new route 404s, linked from nowhere but the
-- sitemap.
--
-- SAFE ON RE-RUN, never destructive: the page row and sections are inserted
-- only when absent, Kaleem's lines only while his list is empty, and the
-- profile_type update sets the same value again. Nothing is deleted.
--
-- Check after applying (expect 4 sections; Shahjahan full; Kaleem 3 lines):
--   SELECT section_type, display_order FROM page_sections
--   WHERE page_slug = 'about-muhammad-shahjahan' ORDER BY display_order;
--   SELECT name, profile_type, cardinality(experience_items) AS lines
--   FROM team_members ORDER BY display_order;

BEGIN;

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
SELECT
  'about-muhammad-shahjahan',
  'Muhammad Shahjahan',
  'Muhammad Shahjahan, ACMA | Senior Associate, Corporate Finance | PaceMakers',
  'Muhammad Shahjahan, ACMA is a Senior Associate in Corporate Finance at PaceMakers Business Consultants, working on valuations, M&A, transaction structuring, corporate restructuring and fundraising.',
  'published',
  true
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE slug = 'about-muhammad-shahjahan');

INSERT INTO page_sections (page_slug, section_type, display_order, visible, content)
SELECT v.page_slug, v.section_type, v.display_order, true, v.content
FROM (VALUES
  ('about-muhammad-shahjahan', 'founder_hero', 10, jsonb_build_object(
    'eyebrow', 'Team',
    'name', 'Muhammad Shahjahan, ACMA',
    'title_primary', 'Senior Associate, Corporate Finance',
    'title_accent', '',
    'credentials_line', 'Lahore, Pakistan',
    'intro', 'Qualified Cost and Management Accountant (ICMAP) with 4+ years across corporate finance, investment banking, financial modeling and internal audit. Shahjahan works on valuations, M&A, transaction structuring, corporate restructuring and fundraising for clients in energy, infrastructure, industrials, consumer, healthcare, education and real estate.',
    'photo_url', '',
    'cta_primary_label', '',
    'cta_primary_href', '',
    'cta_secondary_label', '',
    'cta_secondary_href', '',
    'contact_email', '',
    'contact_phone', '',
    'contact_linkedin', '',
    'hero_bg_image', '',
    'hero_bg_overlay', 60,
    'hero_bg_focal', 'center'
  )),
  ('about-muhammad-shahjahan', 'founder_credentials', 20, jsonb_build_object(
    'heading', 'Selected experience',
    'intro', '',
    'display', 'numbered',
    'items', jsonb_build_array(
      'Co-led advisory on an approximately PKR 42 billion acquisition in the fertilizer sector',
      'Reviewed the feasibility of a USD 249 million port and jetty development, covering returns and debt capacity',
      'Built the financial model and investor presentation behind a PKR 350 million equity raise for an auto parts manufacturer',
      'Advised on a joint venture structure, a demerger for IPO readiness and a four-business merger with a share swap'
    )
  )),
  ('about-muhammad-shahjahan', 'founder_credentials', 30, jsonb_build_object(
    'heading', 'Areas of expertise',
    'intro', '',
    'display', 'pills',
    'items', jsonb_build_array(
      'Financial Modeling', 'Business Valuation', 'M&A Advisory', 'Transaction Structuring',
      'Corporate Restructuring', 'Fundraising', 'Feasibility Studies'
    )
  )),
  ('about-muhammad-shahjahan', 'paragraphs', 40, jsonb_build_object(
    'heading', 'His role at PaceMakers',
    'html', '<p>Shahjahan works on PaceMakers mandates in corporate finance, building the models, valuations and transaction materials behind each engagement. He works alongside the Founding Partner, who leads every mandate and reviews all work personally.</p>'
  ))
) AS v(page_slug, section_type, display_order, content)
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'about-muhammad-shahjahan'
);

UPDATE team_members SET profile_type = 'full'
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%';

UPDATE team_members
SET experience_items = ARRAY[
  'Led Royal Cyber''s Regional Headquarters licensing with the Ministry of Investment (MISA), securing 240 visas and a 10-year tax exemption',
  'Ran finance through Rewaa''s Series A fundraise, covering due diligence, the investor data room and the cap table',
  'Led financial reporting for two Ministry of Interior projects worth SAR 7.5 billion'
]
WHERE lower(trim(name)) = 'kaleem farooq'
  AND cardinality(experience_items) = 0;

COMMIT;
