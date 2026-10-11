-- 104_team_urls_us_spelling.sql
--
-- Two content changes, on the owner's instruction of 2026-10-11:
--
--   1. The team profiles moved from /about/<name> to /team/<name>. The code
--      deploy moves the routes and 301s the old paths; this repoints the two
--      stored links that still name the old founder path, so no click goes
--      through a redirect:
--        site_pages "Founder" navbar item     href
--        home founder_block section           cta_primary_href
--      Only an exact '/about/ahmad-din' or '/about/kaleem-farooq' is changed.
--   2. US spelling site-wide: "modelling" becomes "modeling" (and "Modelling"
--      "Modeling") in the five sections still carrying it:
--      service-refm, service-project-finance, service-transaction-advisory
--      (two), financial-modeler-pro feature_cards and the insights hero.
--      Kaleem Farooq's profile was done in 102. The FMP content cache
--      (cms_content _fmp_cache.*) is overwritten from FMP's feed, so it is
--      fixed in FMP, not here.
--
-- DML only, applied by `node scripts/seed-team-urls-spelling.mjs` (supports
-- --dry-run). This file is the record.
--
-- SAFE ON RE-RUN: each update matches nothing once applied. Nothing deleted.
--
-- SAFE TO APPLY: part 1 only after the deploy that serves /team/ahmad-din and
-- /team/kaleem-farooq. Before it, the navbar and home links would point at
-- routes that do not exist yet (the mistake 075 made). Part 2 any time.

BEGIN;

UPDATE site_pages
SET href = replace(replace(href, '/about/ahmad-din', '/team/ahmad-din'), '/about/kaleem-farooq', '/team/kaleem-farooq')
WHERE href IN ('/about/ahmad-din', '/about/kaleem-farooq');

UPDATE page_sections
SET content = jsonb_set(content, '{cta_primary_href}', to_jsonb(replace(replace(content->>'cta_primary_href', '/about/ahmad-din', '/team/ahmad-din'), '/about/kaleem-farooq', '/team/kaleem-farooq')))
WHERE content->>'cta_primary_href' IN ('/about/ahmad-din', '/about/kaleem-farooq');

UPDATE page_sections
SET content = replace(replace(content::text, 'modelling', 'modeling'), 'Modelling', 'Modeling')::jsonb
WHERE page_slug IN ('service-refm', 'service-project-finance', 'service-transaction-advisory',
                    'financial-modeler-pro', 'insights')
  AND content::text ~ '[Mm]odelling';

COMMIT;
