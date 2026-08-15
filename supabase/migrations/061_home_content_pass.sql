-- 061_home_content_pass.sql
--
-- Five content corrections on the home page, from a read of the whole page on a
-- built site rather than section by section in the builder.
--
--   1. "Nine disciplines" over a list of six.
--   2. The founder's proof points were unlabelled career figures.
--   3. The engagement model was four generic verbs.
--   4. Five calls to action before the end of the page.
--   5. The closing block asked for something the rest of the site does not.
--
-- DML only, no DDL, so `node scripts/seed-home-content-pass.mjs` applies it
-- through supabase-js. This file is the record; the script is the executable.
--
-- SAFE ON RE-RUN in the sense that it cannot duplicate anything: every statement
-- is an UPDATE against a known key. It is NOT safe in the sense that re-running
-- restores this wording over anything edited in the builder since, which is the
-- same caveat every content migration from 014 onward carries.
--
-- ---------------------------------------------------------------------------
-- 1. WHAT WE DO: the count did not match the list
-- ---------------------------------------------------------------------------
-- The subhead named six things and then claimed nine. Nine is the true number of
-- service pages, so the sentence was not wrong so much as unverifiable from
-- where the reader was standing: the six in front of them did not add up to it.
--
-- Fixed by dropping the count rather than by correcting it to six, which would
-- have understated the practice, or by listing all nine, which would have turned
-- a one-line summary into a directory. The number is a fact about /services, and
-- the CTA already goes there. "One partner leads every one of them" keeps the
-- point the sentence was making.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'subhead',
  'Financial modeling, valuation, due diligence, M&A, project finance, and the investor documentation that closes a transaction. One partner leads every one of them.',
  'cta_secondary_label', '',
  'cta_secondary_href', ''
),
updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'cta_block' AND display_order = 45;

-- ---------------------------------------------------------------------------
-- 2. The founder's proof points, labelled
-- ---------------------------------------------------------------------------
-- The five bullets are career figures: 200+ engagements, 200+ valuations, SAR
-- 60B+ of real estate NAV, ACWA Power and Aramco-backed work. They were earned
-- in senior roles before and alongside PaceMakers, and none of them is a PMBC
-- mandate. The firm's own record, 30+ mandates since 2017, sits in the stats
-- block higher up the same page.
--
-- Two sets of numbers on one page with nothing separating them invites a reader
-- to read the larger set as the firm's. That is exactly the confusion migration
-- 044 was written to undo, and it had crept back in a different form: not a
-- false claim this time, just an unlabelled one. Critical Reminder 3 asks for
-- the two to be kept apart, and the stats block already carries its half of the
-- sentence. This is the other half.
--
-- `credentials_label` is a new key on `founder_block`, rendered above the list
-- and editable in the page builder.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'credentials_label',
  'The partner''s career record, earned across senior roles before and alongside PaceMakers. The firm''s own record is the block above.',
  'cta_secondary_label', '',
  'cta_secondary_href', ''
),
updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'founder_block' AND display_order = 80;

-- ---------------------------------------------------------------------------
-- 3. The engagement model, rewritten
-- ---------------------------------------------------------------------------
-- Understand, Analyse, Model, Advise is the default four-step diagram. Every
-- advisory firm could publish it, most have, and a reader who has seen two of
-- them learns nothing from the third. A process section that describes any firm
-- describes none.
--
-- Replaced with how the work is actually run. Each step is now something a
-- competitor would have to change its practice to claim, not just its copy:
--
--   01  the person who builds the model runs the first conversation, which is
--       the opposite of the win-then-hand-off model Critical Reminder 3b says
--       PaceMakers is structured against
--   02  the model is built and revised with the client as assumptions change,
--       rather than delivered finished
--   03  every document is generated from the approved model rather than
--       rekeyed, so the memorandum, the deck and the board paper cannot drift
--       apart from each other
--   04  the model stays live through diligence and lender terms to close,
--       rather than being filed on delivery
--
-- The heading moves with them, since "built around clarity" was doing the same
-- work as the four verbs: agreeable, and true of anyone.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'heading', 'One model, built with you and live until close.',
  'steps', jsonb_build_array(
    jsonb_build_object(
      'number', '01',
      'title', 'Scoped by the partner',
      'description', 'The partner who will build the model runs the first conversation. The assumptions argued over at the outset are the ones that end up in it, because nothing is handed to a different team afterwards.'
    ),
    jsonb_build_object(
      'number', '02',
      'title', 'Built with you, not for you',
      'description', 'The model is built and revised alongside you as assumptions change, rather than delivered finished. You see it while the numbers are still soft, which is when a wrong premise costs an afternoon instead of a round.'
    ),
    jsonb_build_object(
      'number', '03',
      'title', 'Every document generated, never rekeyed',
      'description', 'The memorandum, the investor deck and the board paper are generated from the approved model. Change one assumption and all three move with it, so the numbers cannot drift apart between the documents a lender reads.'
    ),
    jsonb_build_object(
      'number', '04',
      'title', 'Live until close',
      'description', 'The model stays open through the transaction, updated as diligence findings land and lender terms firm up, through to close. It is a working instrument, not a file delivered on signature.'
    )
  )
),
updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'process_steps' AND display_order = 70;

-- ---------------------------------------------------------------------------
-- 4 and 5. One ask per section, and the same ask the rest of the site makes
-- ---------------------------------------------------------------------------
-- The page asked eight times across four sections: two in the hero, two under
-- what we do, two on the founder card, two at the close. A reader who is asked
-- on every scroll stops reading the asks, and the ones that mattered (see the
-- services, read the partner's profile) were competing with a booking button
-- that also sits in the navbar on every screen.
--
-- Now one per section, each the one that belongs to its section: /services
-- under what we do, the profile under the founder card, booking at the close.
-- The hero keeps two, which is the one place a second is worth having, since a
-- reader who is not ready to book should still have somewhere to go.
--
-- The closing block also said "Start a Conversation" pointing at /contact,
-- while the navbar, the footer and the founder profile all say "Book a Meeting"
-- pointing at /book. Two labels for one action reads as two actions. It now
-- says and does what the rest of the site does. "Email the Firm" goes with it:
-- the address is in the footer, three lines below.
UPDATE page_sections
SET content = content || jsonb_build_object(
  'cta_primary_label', 'Book a Meeting',
  'cta_primary_href', '/book',
  'cta_secondary_label', '',
  'cta_secondary_href', ''
),
updated_at = NOW()
WHERE page_slug = 'home' AND section_type = 'cta_block' AND display_order = 110;
