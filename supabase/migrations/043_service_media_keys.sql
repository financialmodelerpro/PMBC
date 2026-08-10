-- 043_service_media_keys.sql
-- Shared optional media keys for the nine service detail pages.
--
-- Every `page_sections` row gained optional media through the shared panel in
-- the page builder, which needs no seeding because the keys are simply absent
-- until an operator sets one. The nine service detail pages are different: they
-- are driven by `cms_content` under the `service_<slug>` namespace, and
-- /admin/content only lists rows that exist. Without this, an operator would
-- have to know the exact five key names and add each by hand, nine times.
--
-- Seeded blank on purpose. A blank `media_url` is exactly the "no media" state,
-- so these rows change nothing about how the pages render. They exist to make
-- the fields visible and fillable.
--
--   media_url         the asset
--   media_type        image | gif | video, blank means detect from the URL
--   media_poster_url  still frame for video
--   media_position    left | right | above | below, blank means below
--   media_caption     small-caps caption under the frame
--
-- 45 rows, five keys across nine services.
--
-- DML only, so `node scripts/seed-service-media-keys.mjs` applies it through
-- supabase-js. No hand-run SQL editor step needed.
--
-- Idempotent and non-destructive: ON CONFLICT DO NOTHING, so a re-run after an
-- operator has set an image leaves that image alone.

BEGIN;

INSERT INTO cms_content (section, key, value)
SELECT s.section, k.key, ''
FROM (
  VALUES
    ('service_financial-modeling'),
    ('service_business-valuation'),
    ('service_financial-due-diligence'),
    ('service_transaction-advisory'),
    ('service_mergers-acquisitions'),
    ('service_real-estate-modeling'),
    ('service_project-finance'),
    ('service_investment-memorandums'),
    ('service_cfo-advisory')
) AS s(section)
CROSS JOIN (
  VALUES
    ('media_url'),
    ('media_type'),
    ('media_poster_url'),
    ('media_position'),
    ('media_caption')
) AS k(key)
ON CONFLICT (section, key) DO NOTHING;

COMMIT;
