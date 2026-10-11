// scripts/seed-profile-linkedin-field.mjs
//
// Applies migration 100_profile_linkedin_field.sql through supabase-js.
//
// On both profile heroes, LinkedIn moves from the primary CTA into
// contact_linkedin, the secondary CTA moves up to primary, and the secondary is
// cleared.
//
//   node scripts/seed-profile-linkedin-field.mjs           apply
//   node scripts/seed-profile-linkedin-field.mjs --dry-run report only
//   npm run seed-profile-linkedin-field
//
// Safe on re-run. Each change runs only while the hero is in the state it fixes,
// so a hero edited since is left alone. Every write is read back.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** The keys to merge, or null when the hero is not in the state this fixes. */
const moveLinkedIn = (c) =>
  !str(c.contact_linkedin) && LINKEDIN.test(str(c.cta_primary_href))
    ? {
        contact_linkedin: str(c.cta_primary_href),
        cta_primary_label: str(c.cta_secondary_label),
        cta_primary_href: str(c.cta_secondary_href),
        cta_secondary_label: '',
        cta_secondary_href: '',
      }
    : null;

const WHAT = 'LinkedIn from the primary CTA into contact_linkedin, secondary CTA up to primary';
const FIXES = [
  { slug: 'about-ahmad-din', what: WHAT, patch: moveLinkedIn },
  { slug: 'about-kaleem-farooq', what: WHAT, patch: moveLinkedIn },
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

  let failed = false;
  for (const fix of FIXES) {
    console.log(`\n${fix.slug}: ${fix.what}`);
    const { data: heroes, error } = await db
      .from('page_sections')
      .select('id, content')
      .eq('page_slug', fix.slug)
      .eq('section_type', 'founder_hero');
    if (error) throw new Error('page_sections read failed: ' + error.message);
    if (!heroes || heroes.length === 0) {
      console.log('  skip  no founder_hero on this page.');
      continue;
    }
    for (const hero of heroes) {
      const content = hero.content ?? {};
      const patch = fix.patch(content);
      if (!patch) {
        console.log(`  skip  hero ${hero.id} is not in the state this fixes. Left as it is.`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  would set ${JSON.stringify(patch)}`);
        continue;
      }
      const { error: upErr } = await db
        .from('page_sections')
        .update({ content: { ...content, ...patch } })
        .eq('id', hero.id);
      if (upErr) throw new Error('page_sections update failed: ' + upErr.message);
      const { data: back } = await db.from('page_sections').select('content').eq('id', hero.id).single();
      const wrong = Object.keys(patch).filter((k) => back?.content?.[k] !== patch[k]);
      if (wrong.length > 0) {
        console.error(`  FAIL hero ${hero.id}: ${wrong.join(', ')} did not read back.`);
        failed = true;
      } else {
        console.log(`  ok    hero ${hero.id}: set ${Object.keys(patch).join(', ')}.`);
      }
    }
  }

  if (DRY_RUN) console.log('\nDry run, nothing written.');
  else if (failed) process.exitCode = 1;
  else console.log('\nCOMPLETE.');
}

main().catch((err) => {
  console.error('seed-profile-linkedin-field failed:', err.message);
  process.exitCode = 1;
});
