// scripts/seed-service-media-keys.mjs
//
// Applies migration 043_service_media_keys.sql through supabase-js.
//
// Seeds the five shared media keys, blank, for each of the nine service detail
// pages, so they appear as editable fields at /admin/content. Blank media_url
// is the "no media" state, so this changes nothing about how the pages render.
//
//   node scripts/seed-service-media-keys.mjs           apply
//   node scripts/seed-service-media-keys.mjs --dry-run report only
//   npm run seed-service-media-keys
//
// Idempotent and non-destructive: only inserts (section, key) pairs that do not
// already exist, so a re-run leaves an operator's image alone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SERVICE_SLUGS = [
  'financial-modeling',
  'business-valuation',
  'financial-due-diligence',
  'transaction-advisory',
  'mergers-acquisitions',
  'real-estate-modeling',
  'project-finance',
  'investment-memorandums',
  'cfo-advisory',
];

const MEDIA_KEYS = [
  'media_url',
  'media_type',
  'media_poster_url',
  'media_position',
  'media_caption',
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

  const sections = SERVICE_SLUGS.map((s) => `service_${s}`);
  const { data: existing, error } = await db
    .from('cms_content')
    .select('section, key')
    .in('section', sections);
  if (error) throw new Error('cms_content read failed: ' + error.message);

  const have = new Set((existing ?? []).map((r) => `${r.section}|${r.key}`));
  const missing = [];
  for (const section of sections) {
    for (const k of MEDIA_KEYS) {
      if (!have.has(`${section}|${k}`)) missing.push({ section, key: k, value: '' });
    }
  }

  console.log(`${sections.length} service sections, ${MEDIA_KEYS.length} media keys each.`);
  console.log(`${missing.length} row(s) missing, ${sections.length * MEDIA_KEYS.length - missing.length} already present.`);

  if (missing.length === 0) {
    console.log('\nNothing to do.');
    return;
  }
  if (DRY_RUN) {
    console.log(`\nwould insert ${missing.length} row(s). Dry run, nothing written.`);
    return;
  }

  const { error: insErr } = await db.from('cms_content').insert(missing);
  if (insErr) throw new Error('insert failed: ' + insErr.message);
  console.log(`\ninserted ${missing.length} row(s)`);

  console.log('\nVerifying...');
  const { data: final } = await db
    .from('cms_content')
    .select('section, key, value')
    .in('section', sections);
  const finalSet = new Set((final ?? []).map((r) => `${r.section}|${r.key}`));

  const failures = [];
  for (const section of sections) {
    for (const k of MEDIA_KEYS) {
      if (!finalSet.has(`${section}|${k}`)) failures.push(`${section} is missing ${k}`);
    }
  }
  // Every seeded media_url must be blank, or these pages would start rendering
  // a frame that nobody asked for.
  const nonBlank = (final ?? []).filter(
    (r) => r.key === 'media_url' && String(r.value ?? '').trim() !== '',
  );
  if (nonBlank.length) {
    console.log(`  note: ${nonBlank.length} service(s) already carry an image, left untouched:`);
    for (const r of nonBlank) console.log(`        ${r.section}`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  All ${sections.length * MEDIA_KEYS.length} media keys present. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-service-media-keys failed:', err.message);
  process.exitCode = 1;
});
