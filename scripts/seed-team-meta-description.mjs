// scripts/seed-team-meta-description.mjs
//
// Applies migration 071_team_meta_description.sql through supabase-js.
//
// The /team meta description said "Senior practitioners who lead every mandate
// directly", which is plural where the rest of the site says partner-led. It now
// matches the hero on the same page.
//
//   node scripts/seed-team-meta-description.mjs           apply
//   node scripts/seed-team-meta-description.mjs --dry-run report only
//   npm run seed-team-meta-description
//
// Guarded on the old wording, so an edit made in the page builder since (that
// field became editable on 2026-08-16) outranks a re-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FROM =
  'The people behind PaceMakers. Senior practitioners who lead every mandate directly.';
const TO =
  'The people behind PaceMakers. Every mandate is partner-led, supported by a focused analytical bench.';

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

  const { data: row, error } = await db
    .from('cms_pages')
    .select('slug, meta_description')
    .eq('slug', 'team')
    .maybeSingle();
  if (error) throw new Error('cms_pages read failed: ' + error.message);
  if (!row) {
    console.log('skip  no /team page row. Run seed-collection-page-heroes first.');
    return;
  }

  if (row.meta_description === TO) {
    console.log('skip  already updated');
  } else if (row.meta_description !== FROM) {
    console.log(
      `skip  meta_description is "${row.meta_description}", not the expected wording. Left alone, an admin edit outranks this migration.`,
    );
  } else if (DRY_RUN) {
    console.log('would set the /team meta description to the partner-led wording');
  } else {
    const { data: updated, error: upErr } = await db
      .from('cms_pages')
      .update({ meta_description: TO, updated_at: new Date().toISOString() })
      .eq('slug', 'team')
      .select('meta_description');
    if (upErr) throw new Error('update failed: ' + upErr.message);
    if (!updated || updated.length !== 1 || updated[0].meta_description !== TO) {
      throw new Error('the new description did not store');
    }
    console.log('set   /team meta description to the partner-led wording');
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  const { data: after } = await db
    .from('cms_pages')
    .select('meta_description')
    .eq('slug', 'team')
    .maybeSingle();
  if (after?.meta_description?.includes('Senior practitioners who lead every mandate')) {
    console.error('  FAIL the plural claim is still there');
    process.exitCode = 1;
    return;
  }
  console.log('  All checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-team-meta-description failed:', err.message);
  process.exitCode = 1;
});
