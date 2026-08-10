// scripts/seed-footer-logo-sizing.mjs
//
// Applies migration 040_footer_logo_sizing.sql through supabase-js.
//
// Seeds the three footer logo presentation keys under the existing
// `footer_settings` section of cms_content.
//
//   node scripts/seed-footer-logo-sizing.mjs           apply
//   node scripts/seed-footer-logo-sizing.mjs --dry-run report only
//   npm run seed-footer-logo-sizing
//
// Idempotent and non-destructive: only inserts keys that do not already exist,
// so a re-run leaves operator-changed values alone. Every write is read back
// and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const ROWS = [
  ['footer_logo_height_px', '48'],
  ['footer_logo_width_px', ''],
  ['footer_logo_enabled', 'true'],
];

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found at ' + envPath);
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error: readErr } = await db
    .from('cms_content')
    .select('key, value')
    .eq('section', 'footer_settings');
  if (readErr) throw new Error('footer_settings read failed: ' + readErr.message);

  const have = new Map((existing ?? []).map((r) => [r.key, r.value]));
  const missing = ROWS.filter(([k]) => !have.has(k));

  for (const [k] of ROWS) {
    if (have.has(k)) {
      console.log(`skip  (footer_settings, ${k}): already set to ${JSON.stringify(have.get(k))}`);
    }
  }

  if (missing.length === 0) {
    console.log('\nAll three keys already present. Nothing to do.');
  } else if (DRY_RUN) {
    console.log(`\nwould insert ${missing.length} key(s): ${missing.map(([k]) => k).join(', ')}`);
  } else {
    const { error } = await db
      .from('cms_content')
      .insert(missing.map(([k, v]) => ({ section: 'footer_settings', key: k, value: v })));
    if (error) throw new Error('insert failed: ' + error.message);
    console.log(`\ninsert ${missing.length} key(s): ${missing.map(([k]) => k).join(', ')}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  const { data: final } = await db
    .from('cms_content')
    .select('key, value')
    .eq('section', 'footer_settings');
  const finalMap = new Map((final ?? []).map((r) => [r.key, r.value]));

  const failures = [];
  for (const [k] of ROWS) {
    if (!finalMap.has(k)) failures.push(`(footer_settings, ${k}) is missing`);
  }
  // The height must parse to something usable. A present-but-empty height row
  // would render an invisible logo, which is the failure this whole feature
  // exists to prevent.
  const h = Number.parseInt(finalMap.get('footer_logo_height_px') ?? '', 10);
  if (!Number.isFinite(h) || h <= 0) {
    failures.push(`footer_logo_height_px is not a usable number: ${JSON.stringify(finalMap.get('footer_logo_height_px'))}`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  All three keys present, height parses to ${h}px. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-footer-logo-sizing failed:', err.message);
  process.exitCode = 1;
});
