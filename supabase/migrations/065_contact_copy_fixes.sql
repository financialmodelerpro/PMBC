-- 065_contact_copy_fixes.sql
-- Three corrections to the /contact copy that migration 064 made editable.
--
-- 1. form_eyebrow repeated the hero. The page led with "Start a conversation."
--    as its headline and then used the same three words as the eyebrow over the
--    form panel a screen below. An eyebrow's job is to say which panel this is,
--    so it becomes "Enquiry".
--
-- 2. form_response_note said what the hero had already said two lines above:
--    that we respond within one to two business days. Cleared rather than
--    rewritten, because the sentence is not wrong, it is just already made.
--
--    Cleared means an empty row, not a deleted one, and the two are different
--    states on purpose. The route reads `contactCopy.form_response_note ??
--    <shipped default>`, so an absent key still renders the line (a database
--    that never ran 064 is unchanged) while an empty value renders nothing.
--    Deleting the row here would have put the sentence straight back.
--
-- 3. founder_body attributed the delivery model to one named individual:
--    "led personally by Ahmad Din". Everywhere else on the site the same claim
--    is made about the role, not the person: "Every mandate is won and led by
--    the partner" on /approach, "The partner wins the engagement, leads it, and
--    reviews every deliverable personally" on home. Critical Reminder 3b is the
--    standing rule. The rest of the sentence is untouched.
--
-- Each UPDATE is guarded on the value it expects to find, so a re-run cannot
-- overwrite wording edited in the admin since: if the string has moved on, the
-- statement matches nothing and the operator's edit stands.
--
-- DML only, so `node scripts/seed-contact-copy-fixes.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.

BEGIN;

-- 1. The eyebrow stops repeating the hero headline.
UPDATE cms_content
SET value = 'Enquiry', updated_at = NOW()
WHERE section = 'contact'
  AND key = 'form_eyebrow'
  AND value = 'Start a conversation';

-- 2. The response-time line is cleared. Empty, not deleted: see the header.
UPDATE cms_content
SET value = '', updated_at = NOW()
WHERE section = 'contact'
  AND key = 'form_response_note'
  AND value = 'We respond to every credible enquiry within one to two business days.';

-- 3. The founder card states the delivery model the way the rest of the site
--    states it.
UPDATE cms_content
SET value = 'Every mandate at PaceMakers is partner-led. If you would rather discuss your situation before writing it down, book a call.',
    updated_at = NOW()
WHERE section = 'contact'
  AND key = 'founder_body'
  AND value = 'Every mandate at PaceMakers is led personally by Ahmad Din. If you would rather discuss your situation before writing it down, book a call.';

COMMIT;
