// scripts/seed-header-background.mjs
//
// Applies migration 058_header_background.sql through supabase-js.
//
// Seeds one key, (header_settings, header_background), with the shipped default
// so the control in Header Settings opens on a real stored value rather than on
// a fallback.
//
//   node scripts/seed-header-background.mjs           apply
//   node scripts/seed-header-background.mjs --dry-run report only
//   npm run seed-header-background
//
// Idempotent and non-destructive: the key is only inserted when absent, so a
// re-run leaves a background an operator has since chosen exactly as it is. The
// write is read back and checked against the accepted values before success is
// reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SECTION = 'header_settings';
const KEY = 'header_background';
const DEFAULT_VALUE = 'white';
const ALLOWED = ['white', 'cream', 'navy_deep'];

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
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();
  if (readErr) throw new Error(`${SECTION}.${KEY} read failed: ` + readErr.message);

  if (existing) {
    console.log(`skip  (${SECTION}, ${KEY}): already set to ${JSON.stringify(existing.value)}`);
  } else if (DRY_RUN) {
    console.log(`would insert (${SECTION}, ${KEY}) = ${JSON.stringify(DEFAULT_VALUE)}`);
  } else {
    const { error } = await db
      .from('cms_content')
      .insert({ section: SECTION, key: KEY, value: DEFAULT_VALUE });
    if (error) throw new Error('insert failed: ' + error.message);
    console.log(`insert (${SECTION}, ${KEY}) = ${JSON.stringify(DEFAULT_VALUE)}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  const { data: final } = await db
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();

  if (!final) {
    console.error(`  FAIL (${SECTION}, ${KEY}) is missing after the write.`);
    process.exitCode = 1;
    return;
  }
  // A value outside the three accepted ones would fall back to white at render
  // time, which is safe but silent. Better to say so here than to leave an
  // operator wondering why their chosen background did nothing.
  if (!ALLOWED.includes(final.value)) {
    console.error(
      `  FAIL value ${JSON.stringify(final.value)} is not one of ${ALLOWED.join(', ')}. The header will render white.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`  (${SECTION}, ${KEY}) = ${JSON.stringify(final.value)}. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-header-background failed:', err.message);
  process.exitCode = 1;
});
