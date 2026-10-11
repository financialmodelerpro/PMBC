// scripts/seed-kaleem-contact.mjs
//
// Applies migration 099_kaleem_farooq_contact.sql through supabase-js: adds
// Kaleem Farooq's email, phone and LinkedIn to the founder_hero section of
// /about/kaleem-farooq.
//
//   node scripts/seed-kaleem-contact.mjs           apply
//   node scripts/seed-kaleem-contact.mjs --dry-run report only
//   npm run seed-kaleem-contact
//
// Safe on re-run, and never destructive. A key is written only when the hero
// does not have it yet, so a re-run never restores a field the operator has
// since edited or cleared in the page builder. Every other key is kept. The
// write is read back before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE_SLUG = 'about-kaleem-farooq';

const CONTACT = {
  contact_email: 'kaleem.farooq@pacemakersglobal.com',
  contact_phone: '+966 50 110 1421',
  contact_linkedin: 'https://www.linkedin.com/in/kaleemfarooq/',
};

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

  const { data: heroes, error } = await db
    .from('page_sections')
    .select('id, content')
    .eq('page_slug', PAGE_SLUG)
    .eq('section_type', 'founder_hero');
  if (error) throw new Error('page_sections read failed: ' + error.message);
  if (!heroes || heroes.length === 0) {
    throw new Error('No founder_hero section on ' + PAGE_SLUG + '. Run npm run seed-kaleem-farooq first.');
  }

  let failed = false;
  for (const hero of heroes) {
    const content = hero.content ?? {};
    const missing = Object.keys(CONTACT).filter((k) => !(k in content));
    if (missing.length === 0) {
      console.log(`  skip  hero ${hero.id} already has all three keys. Left exactly as it is.`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  would add ${missing.join(', ')} to hero ${hero.id}.`);
      continue;
    }
    const next = { ...content };
    for (const k of missing) next[k] = CONTACT[k];
    const { error: upErr } = await db.from('page_sections').update({ content: next }).eq('id', hero.id);
    if (upErr) throw new Error('page_sections update failed: ' + upErr.message);

    const { data: back } = await db.from('page_sections').select('content').eq('id', hero.id).single();
    const wrong = missing.filter((k) => back?.content?.[k] !== CONTACT[k]);
    if (wrong.length > 0) {
      console.error(`  FAIL hero ${hero.id}: ${wrong.join(', ')} did not read back.`);
      failed = true;
    } else {
      console.log(`  ok    hero ${hero.id}: added ${missing.join(', ')}.`);
    }
  }

  if (DRY_RUN) console.log('\nDry run, nothing written.');
  else if (failed) process.exitCode = 1;
  else console.log('\nCOMPLETE.');
}

main().catch((err) => {
  console.error('seed-kaleem-contact failed:', err.message);
  process.exitCode = 1;
});
