-- 111_team_aadil_aamir.sql
--
-- Muhammad Aadil Aamir (M&A and Financial Modeler Expert) joins /team, on the
-- owner's instruction of 2026-10-12, in the same pattern as Muhammad
-- Shahjahan: a team card and a profile page at /team/muhammad-aadil-aamir,
-- both edited on his screen in Team & Advisors.
--
--   1. His member record: name, role, experience "4+ years", location
--      "Lahore, Pakistan", no qualification line (his degree is in his bio),
--      no photo (the initials render until one is added), no contact details,
--      published, linked to his profile page. Display order 2.
--   2. His profile page, three sections in Shahjahan's order:
--        10  founder_hero          the header; intro is his short bio
--        20  founder_credentials   Selected experience  (numbered, shown on
--                                  the card: its first three items)
--        30  founder_credentials   Areas of expertise   (pills)
--      Shahjahan's fourth section, "His role at PaceMakers", has no
--      counterpart: no copy was supplied for it.
--   3. Muhammad Shahjahan moves from display order 2 to 3, so /team reads
--      Ahmad Din, Kaleem Farooq, Muhammad Aadil Aamir, Muhammad Shahjahan.
--
-- The copy is the owner's, verbatim, except "At PMBC" which reads "At
-- PaceMakers" (approved 2026-10-12; "PMBC" never appears in public copy).
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner. Needs 108 and
-- 109 (both applied).
--
-- SAFE TO APPLY: any time; the code that serves it is already live. The card
-- and the page appear together when this commits.
--
-- SAFE ON RE-RUN, never destructive: the member, page and sections are
-- inserted only when absent, and Shahjahan's order changes only from 2.
-- Nothing is deleted.
--
-- Check after applying:
--   SELECT name, role, experience_years, location, profile_slug, display_order
--   FROM team_members ORDER BY display_order;
--   SELECT display_order, section_type, content->>'heading' AS heading,
--          content->'show_on_card' AS on_card
--   FROM page_sections WHERE page_slug = 'about-muhammad-aadil-aamir'
--   ORDER BY display_order;

BEGIN;

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
SELECT
  'about-muhammad-aadil-aamir',
  'Muhammad Aadil Aamir',
  'Muhammad Aadil Aamir | M&A and Financial Modeler Expert | PaceMakers',
  'Muhammad Aadil Aamir is a corporate finance and valuation professional at PaceMakers Business Consultants, building the models behind M&A, IPO and fundraising decisions across KSA, Bahrain and Pakistan.',
  'published',
  true
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE slug = 'about-muhammad-aadil-aamir');

INSERT INTO page_sections (page_slug, section_type, display_order, visible, styles, content)
SELECT v.page_slug, v.section_type, v.display_order, true, '{}'::jsonb, v.content
FROM (VALUES
  ('about-muhammad-aadil-aamir', 'founder_hero', 10, jsonb_build_object(
    'eyebrow', 'Team',
    'name', 'Muhammad Aadil Aamir',
    'title_primary', '',
    'title_accent', '',
    'credentials_line', '',
    'intro', 'Corporate finance and valuation professional with four years across KSA, Bahrain and Pakistan, building the models behind M&A, IPO and fundraising decisions. BSc Accounting and Finance, LUMS.',
    'report_highlights', '',
    'photo_url', '',
    'contact_email', '',
    'contact_phone', '',
    'contact_linkedin', '',
    'hero_bg_image', '',
    'hero_bg_overlay', 60,
    'hero_bg_focal', 'center',
    'cta_primary_label', '',
    'cta_primary_href', '',
    'cta_secondary_label', '',
    'cta_secondary_href', ''
  )),
  ('about-muhammad-aadil-aamir', 'founder_credentials', 20, jsonb_build_object(
    'heading', 'Selected experience',
    'intro', '',
    'display', 'numbered',
    'show_on_card', true,
    'items', jsonb_build_array(
      'Fair value analysis of 10 portfolio companies for a KSA investment fund (Tijan), identifying a SAR 103 million gain (+578%)',
      'Three buy-side acquisitions executed end to end: an insurtech in KSA for Ezdihar Partners and two petrochemical companies in Pakistan for Asiapak',
      'Consolidated IPO model for a technology company and a valuation model for Novu (Himmah Capital)',
      '14+ models and valuations for start-ups, SMEs and leading KSA companies in petrochemicals, healthcare, construction and telecom',
      'At PaceMakers: consolidation and valuation model for a logistics fundraising, and a biodiesel model and investor pitch for Bahrain and KSA'
    )
  )),
  ('about-muhammad-aadil-aamir', 'founder_credentials', 30, jsonb_build_object(
    'heading', 'Areas of expertise',
    'intro', '',
    'display', 'pills',
    'items', jsonb_build_array(
      'Financial Modeling', 'Business Valuation', 'Buy-side M&A', 'IPO Models',
      'Fundraising', 'Feasibility Studies'
    )
  ))
) AS v(page_slug, section_type, display_order, content)
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'about-muhammad-aadil-aamir'
);

UPDATE team_members SET display_order = 3
WHERE lower(trim(name)) LIKE 'muhammad shahjahan%' AND display_order = 2;

INSERT INTO team_members
  (name, role, credentials, experience_years, location, bio, photo,
   display_order, visible, profile_type, profile_slug)
SELECT
  'Muhammad Aadil Aamir',
  'M&A and Financial Modeler Expert',
  NULL,
  '4+ years',
  'Lahore, Pakistan',
  NULL,
  NULL,
  2,
  true,
  'full',
  'about-muhammad-aadil-aamir'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE lower(trim(name)) = 'muhammad aadil aamir'
);

COMMIT;
