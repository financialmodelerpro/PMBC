-- 054_footer_links.sql
-- The footer's links become content, with a visibility switch on each one.
--
-- WHAT WAS HARDCODED
-- Every link in the footer was written into Footer.tsx: the nine service pages
-- as a column of their own, then eight more under "Firm". Nothing about the
-- footer was editable, so hiding a link meant a code change and a deploy. Three
-- of those links point at /case-studies, /insights and /team, whose collections
-- are empty, so the footer has been advertising three pages that open onto an
-- empty state.
--
-- WHAT THIS SEEDS
-- One row, (footer_settings, links), holding the whole list as a JSON array of
-- { id, label, href, column, visible }. Edited at /admin/footer-links, which is
-- the footer's counterpart to Pages and Nav.
--
-- Case Studies, Insights and Team are seeded visible = false. They stay in the
-- list rather than being dropped, so turning each one on once its page has
-- content is one switch rather than remembering the link ever existed.
--
-- WHY A JSON ARRAY AND NOT A footer_links TABLE
-- A table would mirror site_pages more closely, and it is not one because
-- CREATE TABLE is DDL: supabase-js cannot run DDL and this repository has no
-- direct Postgres connection string, so 031, 032 and 033 all had to be pasted
-- into the SQL editor by hand. A visibility control that only starts working
-- after someone runs SQL has not been delivered. (header_settings, nav_items)
-- is the standing precedent for a list-shaped value in one row.
--
-- TWO CONTENT DECISIONS RECORDED HERE
-- The nine service links collapse to a single "Services" link. /services lists
-- all nine with a summary each, so the footer copy of that list was the longest
-- thing in the footer and the least informative part of it.
--
-- "Book a Meeting" moves to the Contact column, which is what the `column` key
-- is for. It is a way of reaching the firm, like the email address it now sits
-- beside, rather than another page in the Firm list.
--
-- DML only, so `npm run seed-footer-links` applies it. Idempotent: the row is
-- only written when it is absent, so a re-run never discards an operator's
-- later edits in the admin.

BEGIN;

INSERT INTO cms_content (section, key, value)
VALUES (
  'footer_settings',
  'links',
  jsonb_build_array(
    jsonb_build_object('id', 'services',     'label', 'Services',                'href', '/services',     'column', 'firm',    'visible', true),
    jsonb_build_object('id', 'network',      'label', 'Network',                 'href', '/network',      'column', 'firm',    'visible', true),
    jsonb_build_object('id', 'sectors',      'label', 'Sectors',                 'href', '/sectors',      'column', 'firm',    'visible', true),
    jsonb_build_object('id', 'case-studies', 'label', 'Case Studies',            'href', '/case-studies', 'column', 'firm',    'visible', false),
    jsonb_build_object('id', 'insights',     'label', 'Insights',                'href', '/insights',     'column', 'firm',    'visible', false),
    jsonb_build_object('id', 'team',         'label', 'Team',                    'href', '/team',         'column', 'firm',    'visible', false),
    jsonb_build_object('id', 'fmp',          'label', 'Financial Modeler Pro',   'href', '/fmp',          'column', 'firm',    'visible', true),
    jsonb_build_object('id', 'contact',      'label', 'Contact',                 'href', '/contact',      'column', 'firm',    'visible', true),
    jsonb_build_object('id', 'book',         'label', 'Book a Meeting',          'href', '/book',         'column', 'contact', 'visible', true)
  )::text
)
ON CONFLICT (section, key) DO NOTHING;

COMMIT;
