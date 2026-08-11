-- 050_fmp_hero_tags.sql
-- Fold the /fmp capability tags into the hero and retire the orphan section.
--
-- WHAT WAS WRONG
-- Migration 049 put the eight capability tags in their own `founder_credentials`
-- section, displayed as pills. On the page that read as leftover space: a full
-- white band with no heading, no intro and nothing but eight pills, and because
-- they were laid out as a wrapping flex row they broke five then three.
--
-- WHY FOLDING RATHER THAN DECORATING
-- The alternative was to give that section an eyebrow and tighten it. Folding
-- won because the tags are not a section. They qualify the hero's claim: the
-- subtitle says the platform was built by a practitioner on multi-billion riyal
-- deals, and the tags say across what. Read directly under the subtitle they
-- finish that sentence. Read as a separate band with its own heading they would
-- become a list of capabilities the page then never returns to.
--
-- Folding also removes the band outright rather than making an empty one look
-- deliberate, which is the more honest fix for "this looks like leftover space".
--
-- THE HERO GAINS A `tags` KEY
-- Optional and absent by default, so every other hero on the site renders
-- exactly as before. The renderer lays them out as a GRID rather than a
-- wrapping flex row: four columns on desktop, three on tablet, two on mobile,
-- so rows always fill evenly instead of breaking wherever the line runs out.
-- Eight tags therefore read four and four.
--
-- The hero's CTA row also moves from mt-12 to mt-10, since the tags now sit
-- between the subtitle and the buttons and the original gap was measured
-- without them.
--
-- DML only, so `node scripts/seed-fmp-hero-tags.mjs` applies it. Idempotent:
-- the insert of the tags is guarded on the hero not already carrying them, and
-- the delete is a natural no-op once done.

BEGIN;

-- 1. The tags move onto the hero -------------------------------------------
UPDATE page_sections
SET content = content || jsonb_build_object(
      'tags', jsonb_build_array(
        'Real Estate Models',
        'Business Valuation',
        'Project Finance',
        'Renewable Energy',
        'FP&A',
        'Capital Structuring',
        'Debt Sizing',
        'M&A Advisory'
      )
    ),
    updated_at = NOW()
WHERE page_slug = 'financial-modeler-pro'
  AND section_type = 'hero'
  AND COALESCE(jsonb_array_length(content->'tags'), 0) = 0;

-- 2. The orphan section is retired ------------------------------------------
-- Matched on the page and type rather than on its content, since it is the only
-- founder_credentials section on this page and it carried no heading to match.
DELETE FROM page_sections
WHERE page_slug = 'financial-modeler-pro'
  AND section_type = 'founder_credentials';

COMMIT;
