-- 047_rename_real_estate_service.sql
-- Rename service 06 to "Real Estate Financial Modeling" and move it to /services/refm.
--
-- WHAT THE SLUG TOUCHES
-- The service slug is not just a URL segment. It is the join key between four
-- separate places, and a rename that misses any one of them leaves a live page
-- reading from a namespace nobody writes to:
--
--   1. `cms_pages.slug`   stored as `service-<slug>`, supplies meta title,
--                         description and OG image to the live route through
--                         generateMetadata
--   2. `cms_content.section` stored as `service_<slug>`, holds the four body
--                         fields plus the five shared media keys. This is the
--                         one that fails SILENTLY: a missed rename renders the
--                         page with an empty description and no deliverables,
--                         with no error anywhere
--   3. `services.slug`    drives the /services grid and the admin collection
--   4. `page_sections`    the home "what we do" card carries the title and a
--                         hardcoded /services/<slug> link in its JSONB
--
-- The static `SERVICES` config in src/config/services.ts is the fifth, and is
-- changed in code rather than here. It drives the contact dropdown, the footer
-- service list, the sitemap, generateStaticParams and the JSON-LD.
--
-- OLD URL
-- /services/real-estate-modeling 301s to /services/refm via next.config.ts,
-- pointed straight at the final URL so an indexed link resolves in one hop.
--
-- WHY UPDATE RATHER THAN DELETE AND REINSERT
-- Every row keeps its id. `cms_pages` carries is_system, `services` carries a
-- display_order and a published status, and the cms_content rows carry copy an
-- operator may have edited since migration 010. Recreating any of them would
-- either lose that or require restating it here, and restating it is how a
-- migration quietly reverts an admin edit.
--
-- DML only, so `node scripts/seed-rename-refm.mjs` applies it through
-- supabase-js. Idempotent: every statement is guarded on the old value, so a
-- second run does nothing and a partially applied run completes.

BEGIN;

-- 1. Page metadata -----------------------------------------------------------
UPDATE cms_pages
SET slug = 'service-refm',
    title = 'Real Estate Financial Modeling',
    meta_title = 'Real Estate Financial Modeling | PaceMakers Business Consultants',
    updated_at = NOW()
WHERE slug = 'service-real-estate-modeling';

-- 2. Detail page body content, nine rows -------------------------------------
-- The section name is the namespace the live route reads. Renaming it here is
-- what keeps /services/refm from rendering an empty body.
UPDATE cms_content
SET section = 'service_refm',
    updated_at = NOW()
WHERE section = 'service_real-estate-modeling';

-- 3. Managed services collection ---------------------------------------------
UPDATE services
SET slug = 'refm',
    title = 'Real Estate Financial Modeling',
    updated_at = NOW()
WHERE slug = 'real-estate-modeling';

-- 4. Home "what we do" card ---------------------------------------------------
-- The cards live in a JSONB array, so this rewrites the array element by
-- element rather than patching a top level key. Guarded on the old link, so a
-- re-run cannot touch a card an operator has since retitled.
UPDATE page_sections
SET content = jsonb_set(
      content,
      '{cards}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN card->>'link' = '/services/real-estate-modeling'
              THEN card
                   || jsonb_build_object(
                        'link', '/services/refm',
                        'title', 'Real Estate Financial Modeling'
                      )
            ELSE card
          END
          ORDER BY ord
        )
        FROM jsonb_array_elements(content->'cards') WITH ORDINALITY AS t(card, ord)
      )
    ),
    updated_at = NOW()
WHERE section_type = 'service_cards'
  AND content->'cards' @> '[{"link": "/services/real-estate-modeling"}]'::jsonb;

COMMIT;
