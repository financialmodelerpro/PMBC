-- 112_team_abuzar_sadiq.sql
--
-- Muhammad Abuzar Sadiq (Market Research and Feasibility Expert) joins /team,
-- on the owner's instruction of 2026-10-13, in the same pattern as Muhammad
-- Aadil Aamir and Muhammad Shahjahan: a team card and a profile page at
-- /team/muhammad-abuzar-sadiq, both edited on his screen in Team & Advisors.
--
--   1. His member record: name, role, qualification "FMVA" (a professional
--      qualification shows on the card line, as Shahjahan's ACMA does),
--      experience "3+ years", location "Lahore, Pakistan", no photo (the
--      initials render until one is added), no contact details, published,
--      linked to his profile page. Display order 4, after the current
--      members, so /team reads Ahmad Din, Kaleem Farooq, Muhammad Aadil
--      Aamir, Muhammad Shahjahan, Muhammad Abuzar Sadiq.
--   2. His profile page, three sections in Aadil's order:
--        10  founder_hero          the header; intro is his short bio
--        20  founder_credentials   Selected experience  (numbered, shown on
--                                  the card: its first three items)
--        30  founder_credentials   Areas of expertise   (pills)
--      No "His role at PaceMakers" section: no copy was supplied for it.
--
-- The copy is the owner's, verbatim. No other member or page changes.
--
-- DML only. HAND-RUN in the Supabase SQL editor by the owner. Needs 108 and
-- 109 (both applied).
--
-- SAFE TO APPLY: any time; the code that serves it is already live. The card
-- and the page appear together when this commits.
--
-- SAFE ON RE-RUN, never destructive: the member, page and sections are
-- inserted only when absent. Nothing is updated or deleted.
--
-- Check after applying:
--   SELECT name, role, credentials, experience_years, location, profile_slug,
--          display_order
--   FROM team_members ORDER BY display_order;
--   SELECT display_order, section_type, content->>'heading' AS heading,
--          content->'show_on_card' AS on_card
--   FROM page_sections WHERE page_slug = 'about-muhammad-abuzar-sadiq'
--   ORDER BY display_order;

BEGIN;

INSERT INTO cms_pages (slug, title, meta_title, meta_description, status, is_system)
SELECT
  'about-muhammad-abuzar-sadiq',
  'Muhammad Abuzar Sadiq',
  'Muhammad Abuzar Sadiq | Market Research and Feasibility Expert | PaceMakers',
  'Muhammad Abuzar Sadiq is a corporate finance professional at PaceMakers Business Consultants, focused on market research, feasibility studies, investment cases and investor materials across the GCC and Pakistan.',
  'published',
  true
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE slug = 'about-muhammad-abuzar-sadiq');

INSERT INTO page_sections (page_slug, section_type, display_order, visible, styles, content)
SELECT v.page_slug, v.section_type, v.display_order, true, '{}'::jsonb, v.content
FROM (VALUES
  ('about-muhammad-abuzar-sadiq', 'founder_hero', 10, jsonb_build_object(
    'eyebrow', 'Team',
    'name', 'Muhammad Abuzar Sadiq',
    'title_primary', '',
    'title_accent', '',
    'credentials_line', '',
    'intro', 'Corporate finance professional with 3+ years in advisory across the GCC and Pakistan, focused on market research, feasibility studies, investment cases and investor materials. BSc Accounting and Finance, NUST, and FMVA certified.',
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
  ('about-muhammad-abuzar-sadiq', 'founder_credentials', 20, jsonb_build_object(
    'heading', 'Selected experience',
    'intro', '',
    'display', 'numbered',
    'show_on_card', true,
    'items', jsonb_build_array(
      'Market sizing, demand-supply and pricing research across 8+ sectors, including cement, fertilizers, manufacturing, hospitality, real estate and utilities',
      'Screened water banking opportunities in Saudi Arabia for Dallah Investment Holding, recommending desalination and advanced water storage as the more viable investment themes',
      'Real estate feasibility models covering development costs, revenue, cash flows and investment returns',
      'Built the model and Investment Committee materials behind a client''s exit from a 17% stake in Residence Inn by Marriott Sarajevo',
      'Prepared investment memoranda and investor presentations that helped a client win a government manufacturing bid',
      'Financial due diligence on Qatar-based companies to support investment and commercial decisions'
    )
  )),
  ('about-muhammad-abuzar-sadiq', 'founder_credentials', 30, jsonb_build_object(
    'heading', 'Areas of expertise',
    'intro', '',
    'display', 'pills',
    'items', jsonb_build_array(
      'Market Research', 'Feasibility Studies', 'Real Estate Modeling',
      'Investment Memoranda', 'Investor Presentations', 'Due Diligence'
    )
  ))
) AS v(page_slug, section_type, display_order, content)
WHERE NOT EXISTS (
  SELECT 1 FROM page_sections WHERE page_slug = 'about-muhammad-abuzar-sadiq'
);

INSERT INTO team_members
  (name, role, credentials, experience_years, location, bio, photo,
   display_order, visible, profile_type, profile_slug)
SELECT
  'Muhammad Abuzar Sadiq',
  'Market Research and Feasibility Expert',
  'FMVA',
  '3+ years',
  'Lahore, Pakistan',
  NULL,
  NULL,
  4,
  true,
  'full',
  'about-muhammad-abuzar-sadiq'
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE lower(trim(name)) = 'muhammad abuzar sadiq'
);

COMMIT;
