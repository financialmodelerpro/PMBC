-- 102_team_shahjahan_modeling.sql
--
-- Two team changes, on the owner's instruction of 2026-10-11:
--
--   1. Muhammad Shahjahan, ACMA (Senior Associate, Corporate Finance) joins
--      /team as the first compact profile: display order 2, after Ahmad Din and
--      Kaleem Farooq, no photo (the initials render until one is set in
--      /admin/team), no contact details. The content is the owner's, verbatim.
--   2. US spelling on Kaleem Farooq's profile: "modelling" becomes "modeling"
--      in the two credential lists that carry it (Sector focus, Areas of
--      expertise). Text only. Other "modelling" on the site is reported to the
--      owner and left as it is until approved.
--
-- DML only, applied by `node scripts/seed-team-shahjahan.mjs` (supports
-- --dry-run). This file is the record; the script is the executable.
--
-- SAFE ON RE-RUN, and never destructive: the card is inserted only when no
-- member of that name exists, and the spelling update matches nothing once
-- applied. Nothing is deleted.
--
-- SAFE TO APPLY: after 101 (the columns the card fills) and after the deploy
-- that renders compact cards. Before that deploy, /team would show his card
-- with the bio only and the new framed portraits absent; the lists are stored
-- and ignored.

BEGIN;

INSERT INTO team_members
  (name, role, credentials, bio, photo, display_order, visible,
   profile_type, experience_items, expertise_items)
SELECT
  'Muhammad Shahjahan, ACMA',
  'Senior Associate, Corporate Finance',
  'Lahore, Pakistan',
  '<p>Qualified Cost and Management Accountant (ICMAP) with 4+ years across corporate finance, investment banking, financial modeling and internal audit. Shahjahan works on valuations, M&A, transaction structuring, corporate restructuring and fundraising for clients in energy, infrastructure, industrials, consumer, healthcare, education and real estate.</p>',
  NULL,
  2,
  true,
  'compact',
  ARRAY[
    'Co-led advisory on an approximately PKR 42 billion acquisition in the fertilizer sector',
    'Reviewed the feasibility of a USD 249 million port and jetty development, covering returns and debt capacity',
    'Built the financial model and investor presentation behind a PKR 350 million equity raise for an auto parts manufacturer',
    'Advised on a joint venture structure, a demerger for IPO readiness and a four-business merger with a share swap'
  ],
  ARRAY[
    'Financial Modeling', 'Business Valuation', 'M&A Advisory', 'Transaction Structuring',
    'Corporate Restructuring', 'Fundraising', 'Feasibility Studies'
  ]
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE lower(trim(name)) LIKE 'muhammad shahjahan%'
);

UPDATE page_sections
SET content = replace(replace(content::text, 'modelling', 'modeling'), 'Modelling', 'Modeling')::jsonb
WHERE page_slug = 'about-kaleem-farooq'
  AND section_type = 'founder_credentials'
  AND content::text ~ '[Mm]odelling';

COMMIT;
