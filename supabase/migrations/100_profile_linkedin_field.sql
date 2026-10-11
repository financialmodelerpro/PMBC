-- 100_profile_linkedin_field.sql
--
-- Moves both profile heroes onto the LinkedIn standard of 2026-10-11, on the
-- owner's instruction of the same day. Neither page changes on screen.
--
-- On /about/ahmad-din and /about/kaleem-farooq alike, LinkedIn moves from the
-- primary CTA into contact_linkedin (the field the gold "Connect on LinkedIn"
-- button reads), the secondary CTA moves up to the primary, and the secondary
-- is cleared. For Ahmad that leaves "Book a Meeting" as the primary CTA; Kaleem
-- has no secondary, so his CTAs end empty. Runs only while contact_linkedin is
-- empty and the primary CTA still points at linkedin.com.
--
-- Planned also to clear a LinkedIn URL typed into Kaleem's CTA label; the owner
-- corrected that CTA in the admin at 09:35 UTC the same day, so it was dropped.
--
-- DML only, applied by `node scripts/seed-profile-linkedin-field.mjs` (supports
-- --dry-run). This file is the record.
--
-- SAFE ON RE-RUN: each update is guarded by the state it fixes, so once applied
-- it matches nothing, and it never touches a hero edited since.
--
-- SAFE TO APPLY: only after the deploy of 1817cf5 (the hero that draws the
-- LinkedIn button from contact_linkedin). Before it, Ahmad's page would lose its
-- LinkedIn button. That deploy is live.

BEGIN;

UPDATE page_sections
SET content = content || jsonb_build_object(
      'contact_linkedin', content->>'cta_primary_href',
      'cta_primary_label', coalesce(content->>'cta_secondary_label', ''),
      'cta_primary_href', coalesce(content->>'cta_secondary_href', ''),
      'cta_secondary_label', '',
      'cta_secondary_href', ''
    )
WHERE page_slug IN ('about-ahmad-din', 'about-kaleem-farooq')
  AND section_type = 'founder_hero'
  AND coalesce(content->>'contact_linkedin', '') = ''
  AND content->>'cta_primary_href' ~* '^https://([a-z]{2,3}\.)?linkedin\.com/';

COMMIT;
