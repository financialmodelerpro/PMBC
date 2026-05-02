-- 009_split_header_settings.sql
--
-- Split the legacy (header_settings, config) JSON-blob row into discrete keys
-- under the same section, matching the FMP namespace convention:
--
--   (header_settings, nav_items)            JSON array of {label, href}
--   (header_settings, cta_label)            text
--   (header_settings, cta_href)             text
--   (header_settings, show_cta)             text  ('true' | 'false')
--   (header_settings, mobile_menu_enabled)  text  ('true' | 'false')
--
-- Migration is idempotent: re-running with no `config` row leaves discrete
-- rows alone; re-running with already-split keys preserves their values.

DO $$
DECLARE
  cfg jsonb;
  cfg_text text;
BEGIN
  -- Pull the legacy blob if present.
  SELECT value INTO cfg_text
  FROM cms_content
  WHERE section = 'header_settings' AND key = 'config'
  LIMIT 1;

  IF cfg_text IS NOT NULL THEN
    BEGIN
      cfg := cfg_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
      cfg := NULL;
    END;
  ELSE
    cfg := NULL;
  END IF;

  -- nav_items: from the blob if available, else default list.
  INSERT INTO cms_content (section, key, value)
  VALUES (
    'header_settings',
    'nav_items',
    COALESCE(
      (cfg->'nav_items')::text,
      '[{"label":"Services","href":"/services"},{"label":"Sectors","href":"/sectors"},{"label":"Approach","href":"/approach"},{"label":"Network","href":"/network"},{"label":"About","href":"/about"},{"label":"Contact","href":"/contact"}]'
    )
  )
  ON CONFLICT (section, key) DO NOTHING;

  -- cta_label / cta_href / show_cta: prefer existing rows (006 seeded these
  -- already), fall back to blob, fall back to defaults. ON CONFLICT DO
  -- NOTHING means we don't clobber a legitimate edit.
  INSERT INTO cms_content (section, key, value)
  VALUES ('header_settings', 'cta_label', COALESCE(cfg->>'cta_label', 'Start a Conversation'))
  ON CONFLICT (section, key) DO NOTHING;

  INSERT INTO cms_content (section, key, value)
  VALUES ('header_settings', 'cta_href', COALESCE(cfg->>'cta_href', '/contact'))
  ON CONFLICT (section, key) DO NOTHING;

  INSERT INTO cms_content (section, key, value)
  VALUES (
    'header_settings',
    'show_cta',
    COALESCE(
      CASE
        WHEN cfg ? 'show_cta' THEN (cfg->>'show_cta')::text
        ELSE NULL
      END,
      'true'
    )
  )
  ON CONFLICT (section, key) DO NOTHING;

  INSERT INTO cms_content (section, key, value)
  VALUES (
    'header_settings',
    'mobile_menu_enabled',
    COALESCE(
      CASE
        WHEN cfg ? 'mobile_menu_enabled' THEN (cfg->>'mobile_menu_enabled')::text
        ELSE NULL
      END,
      'true'
    )
  )
  ON CONFLICT (section, key) DO NOTHING;

  -- Drop the legacy blob row only after the discrete rows are confirmed.
  DELETE FROM cms_content
  WHERE section = 'header_settings' AND key = 'config';
END
$$;
