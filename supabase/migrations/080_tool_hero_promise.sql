-- 080_tool_hero_promise.sql
-- The Business Valuation hero subtitle becomes a one-line promise.
--
-- SAFE TO APPLY: any time, before or after the tools v2 code is deployed.
--   The tool page is Hidden, so no visitor sees the change either way. Before
--   the v2 deploy the longer page also reads well with one line; after it, the
--   hero band shows this line above the three trust chips.
--
-- DML. Run in the Supabase SQL editor.
--
-- WHY
-- Version 2 of the tool page puts a navy band at the top with the title, one
-- line of promise and three chips (DCF and comparables, Damodaran market data,
-- free PDF report). Migration 074 seeded a two-sentence subtitle describing the
-- method, which the chips now say more briefly. The subtitle stays page builder
-- content; this only replaces the seeded wording.
--
-- Guarded on the exact text 074 wrote, so an edit made in the page builder
-- since is left alone. Idempotent.

BEGIN;

UPDATE page_sections
SET content = jsonb_set(
  content,
  '{subtitle}',
  to_jsonb('<p>An indicative equity value range for your business in about ten minutes, with a report you can keep.</p>'::text)
)
WHERE page_slug = 'tool-business-valuation'
  AND section_type = 'hero'
  AND content->>'subtitle' = '<p>Enter three years of history and a five year forecast. The tool builds free cash flow, a cost of capital from Damodaran market data, and a comparables check, then shows where your value lands.</p>';

COMMIT;
