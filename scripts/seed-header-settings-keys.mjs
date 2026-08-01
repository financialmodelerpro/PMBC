// scripts/seed-header-settings-keys.mjs
// JS-side equivalent of supabase/migrations/029_header_settings_keys.sql.
// Seeds the 13 header presentation keys the consolidated Header Settings page
// writes, so a dev run does not need the Supabase SQL editor. The migration
// file stays the source of truth for production.
//
// Idempotent: existing rows are left exactly as they are, matching the
// migration's ON CONFLICT DO NOTHING. Re-running only fills genuine gaps, so
// it can never clobber an admin's saved values.
//
// Usage:
//   node scripts/seed-header-settings-keys.mjs            (report + insert missing)
//   node scripts/seed-header-settings-keys.mjs --dry-run  (report only)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const SECTION = 'header_settings';

// Must stay in step with migration 029 and DEFAULT_HEADER_CONFIG.
const DEFAULTS = {
  logo_enabled: 'true',
  logo_width_px: '',
  logo_height_px: '40',
  logo_position: 'left',
  show_brand_name: 'true',
  show_tagline: 'false',
  icon_url: '',
  icon_as_favicon: 'false',
  icon_in_header: 'false',
  icon_size_px: '20',
  header_height_px: '',
  header_padding_top_px: '',
  header_padding_bottom_px: '',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  loadEnvLocal();

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Fail closed: an unset secret must mean stop, never "carry on unauthenticated".
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', SECTION);
  if (error) {
    console.error('Read failed:', error.message);
    process.exit(1);
  }

  const existing = new Map((data ?? []).map((r) => [r.key, r.value]));
  const missing = Object.entries(DEFAULTS).filter(([k]) => !existing.has(k));

  console.log(`Section '${SECTION}': ${existing.size} key(s) present.`);
  for (const [k, v] of existing) {
    console.log(`  keep    ${k.padEnd(26)} = ${JSON.stringify(v)}`);
  }
  for (const [k, v] of missing) {
    console.log(`  ${dryRun ? 'would insert' : 'insert '} ${k.padEnd(26)} = ${JSON.stringify(v)}`);
  }

  if (missing.length === 0) {
    console.log('\nNothing to do. All 13 presentation keys already exist.');
    return;
  }
  if (dryRun) {
    console.log(`\nDry run: ${missing.length} key(s) would be inserted.`);
    return;
  }

  const rows = missing.map(([key_, value]) => ({
    section: SECTION,
    key: key_,
    value,
    updated_at: new Date().toISOString(),
  }));
  const { error: insErr } = await supabase.from('cms_content').insert(rows);
  if (insErr) {
    console.error('Insert failed:', insErr.message);
    process.exit(1);
  }
  console.log(`\nInserted ${rows.length} key(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
