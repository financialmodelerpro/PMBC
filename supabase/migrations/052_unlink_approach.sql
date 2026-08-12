-- 052_unlink_approach.sql
--
-- Removes every internal link to /approach from CMS content. DML only, so
-- `npm run seed-unlink-approach` applies it through supabase-js.
--
-- The Approach nav item was hidden in Pages & Nav (site_pages.visible = false),
-- which took it out of the navbar and left five links elsewhere pointing at a
-- page a visitor can no longer navigate to on purpose. A page that is reachable
-- only by links scattered through other pages is worse than either state: it is
-- neither properly published nor properly retired, and a visitor who lands on
-- it has no way back into the site's own structure except the browser's back
-- button.
--
-- The page and its route stay exactly as they are. This removes references,
-- not content, so restoring the nav item is the only step needed to bring it
-- back, and any of the five CTAs below can be reinstated in the page builder.
--
-- Five references, all of them a label and an href pair except the first:
--
--   1. home / paragraphs        an inline sentence at the end of the firm
--                               introduction. The whole sentence goes, not
--                               just its anchor: "See how mandates are
--                               staffed" with nothing to click is an
--                               instruction the reader cannot follow, and the
--                               two sentences before it already state the
--                               staffing model. (It also carried
--                               target="_blank" on an internal link, which
--                               was never right.)
--   2. home / process_steps     "Read more about our approach", the footer CTA
--                               under the four-step grid
--   3. network / text_image     "How we work"
--   4. sectors / text_image     "How we work"
--   5. services / hero          "Our Approach", the secondary hero CTA
--
-- Every renderer involved requires BOTH a label and an href before it draws a
-- button, so clearing the pair removes the control rather than leaving a dead
-- one. Clearing the href alone would have left three empty buttons.
--
-- Idempotent. Each statement is guarded on the old value, so a re-run after an
-- operator has repointed one of these CTAs somewhere else is a no-op.

-- ---------------------------------------------------------------------------
-- 1. home: the inline link in the firm introduction
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  content = jsonb_set(
    content,
    '{html}',
    to_jsonb(
      replace(
        content->>'html',
        ' <a target="_blank" rel="noopener noreferrer" href="/approach">See how mandates are staffed</a>.',
        ''
      )
    )
  ),
  updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'paragraphs'
  AND content->>'html' LIKE '%href="/approach"%';

-- ---------------------------------------------------------------------------
-- 2. home: the delivery approach section's footer CTA
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  content = content || jsonb_build_object('footer_cta_label', '', 'footer_cta_href', ''),
  updated_at = NOW()
WHERE page_slug = 'home'
  AND section_type = 'process_steps'
  AND content->>'footer_cta_href' = '/approach';

-- ---------------------------------------------------------------------------
-- 3 and 4. network and sectors: the "How we work" CTA on each text_image
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  content = content || jsonb_build_object('cta_label', '', 'cta_href', ''),
  updated_at = NOW()
WHERE page_slug IN ('network', 'sectors')
  AND section_type = 'text_image'
  AND content->>'cta_href' = '/approach';

-- ---------------------------------------------------------------------------
-- 5. services: the secondary hero CTA
-- ---------------------------------------------------------------------------
UPDATE page_sections
SET
  content = content || jsonb_build_object('cta_secondary_label', '', 'cta_secondary_href', ''),
  updated_at = NOW()
WHERE page_slug = 'services'
  AND section_type = 'hero'
  AND content->>'cta_secondary_href' = '/approach';
