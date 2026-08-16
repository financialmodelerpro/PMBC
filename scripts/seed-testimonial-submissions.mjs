// scripts/seed-testimonial-submissions.mjs
//
// Checks whether migration 072_testimonial_submissions.sql has been applied,
// and reports precisely what is missing.
//
//   node scripts/seed-testimonial-submissions.mjs
//   npm run seed-testimonial-submissions
//
// **It cannot apply the migration.** 072 is DDL, supabase-js cannot execute
// ALTER TABLE or CREATE TABLE, and this repository has no direct Postgres
// connection string. Paste the file into the Supabase SQL editor, then run this
// to confirm. Same situation as migrations 031, 032 and 033.
//
// Everything in the app degrades gracefully until then, which this script also
// checks: it reports the state rather than failing, so it is safe to run before
// or after.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const NEW_COLUMNS = [
  'linkedin_url',
  'photo_url',
  'source',
  'consent_given',
  'submitted_at',
  'submitted_via_link_id',
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

  let applied = true;

  // 1. The new columns on testimonials, each asked for by name so the report
  //    says which one is missing rather than that something is.
  const missing = [];
  for (const col of NEW_COLUMNS) {
    const { error } = await db.from('testimonials').select(col).limit(1);
    if (error) missing.push(col);
  }
  if (missing.length === 0) {
    console.log(`ok    testimonials carries all ${NEW_COLUMNS.length} new columns`);
  } else {
    applied = false;
    console.log(`MISSING  testimonials columns: ${missing.join(', ')}`);
  }

  // 2. The links table.
  const { error: linksError } = await db.from('testimonial_links').select('id').limit(1);
  if (linksError) {
    applied = false;
    console.log('MISSING  table testimonial_links');
  } else {
    const { count } = await db
      .from('testimonial_links')
      .select('id', { count: 'exact', head: true });
    console.log(`ok    testimonial_links exists, ${count ?? 0} link(s)`);
  }

  // 3. The bucket submitted photos are written to.
  const { data: buckets, error: bucketError } = await db.storage.listBuckets();
  if (bucketError) {
    console.log('warn  could not list storage buckets: ' + bucketError.message);
  } else {
    const target = (buckets ?? []).find((b) => b.name === 'cms-assets');
    if (!target) console.log('MISSING  storage bucket cms-assets');
    else if (!target.public) console.log('warn  cms-assets is not public, so submitted photos will not render');
    else console.log('ok    storage bucket cms-assets is present and public');
  }

  console.log('');
  if (applied) {
    console.log('Migration 072 is applied. Client testimonial submission is fully live.');
    return;
  }
  console.log('Migration 072 is NOT applied.');
  console.log('');
  console.log('  Paste supabase/migrations/072_testimonial_submissions.sql into the');
  console.log('  Supabase SQL editor and run it, then run this script again.');
  console.log('');
  console.log('  Until then the app degrades rather than breaking: the form still');
  console.log('  accepts a testimonial and stores it pending without its new fields,');
  console.log('  the links screen says it is unavailable, and the public block');
  console.log('  renders exactly as it does today.');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('seed-testimonial-submissions failed:', err.message);
  process.exitCode = 1;
});
