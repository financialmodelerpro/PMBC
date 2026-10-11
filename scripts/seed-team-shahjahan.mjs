// scripts/seed-team-shahjahan.mjs
//
// Applies migration 102_team_shahjahan_modeling.sql through supabase-js:
//   1. Muhammad Shahjahan's compact card in team_members, display order 2.
//   2. "modelling" to "modeling" in Kaleem Farooq's credential lists.
//
//   node scripts/seed-team-shahjahan.mjs           apply
//   node scripts/seed-team-shahjahan.mjs --dry-run report only
//   npm run seed-team-shahjahan
//
// Safe on re-run, and never destructive. The card is inserted only when no
// member of that name exists, so a re-run cannot overwrite wording edited in
// /admin/team since; the spelling fix touches only strings that still carry
// "modelling". Every write is read back before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const NAME = 'Muhammad Shahjahan, ACMA';

// The owner's content, verbatim.
const CARD = {
  name: NAME,
  role: 'Senior Associate, Corporate Finance',
  // The location slot, as on Kaleem Farooq's card.
  credentials: 'Lahore, Pakistan',
  // Wrapped so `.pmbc-prose p` applies, as for the other cards.
  bio:
    '<p>Qualified Cost and Management Accountant (ICMAP) with 4+ years across corporate finance, investment banking, financial modeling and internal audit. Shahjahan works on valuations, M&A, transaction structuring, corporate restructuring and fundraising for clients in energy, infrastructure, industrials, consumer, healthcare, education and real estate.</p>',
  // No portrait yet: the card renders the initials until one is set in /admin/team.
  photo: null,
  display_order: 2,
  visible: true,
  profile_type: 'compact',
  experience_items: [
    'Co-led advisory on an approximately PKR 42 billion acquisition in the fertilizer sector',
    'Reviewed the feasibility of a USD 249 million port and jetty development, covering returns and debt capacity',
    'Built the financial model and investor presentation behind a PKR 350 million equity raise for an auto parts manufacturer',
    'Advised on a joint venture structure, a demerger for IPO readiness and a four-business merger with a share swap',
  ],
  expertise_items: [
    'Financial Modeling',
    'Business Valuation',
    'M&A Advisory',
    'Transaction Structuring',
    'Corporate Restructuring',
    'Fundraising',
    'Feasibility Studies',
  ],
};

const KALEEM_SLUG = 'about-kaleem-farooq';
const usSpelling = (s) => s.replace(/modelling/g, 'modeling').replace(/Modelling/g, 'Modeling');

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

async function seedCard(db) {
  console.log('\n1. Team card: ' + NAME);
  const { data: rows, error } = await db.from('team_members').select('id, name, profile_type');
  if (error) throw new Error('team_members read failed: ' + error.message);
  if (rows?.[0] && !('profile_type' in rows[0])) {
    throw new Error('team_members has no profile_type column. Apply migration 101 first.');
  }
  if ((rows ?? []).some((r) => r.name.trim().toLowerCase().startsWith('muhammad shahjahan'))) {
    console.log('  skip  already in the team list. Left exactly as it is.');
    return true;
  }
  if (DRY_RUN) {
    console.log(`  would insert the card at display_order ${CARD.display_order}.`);
    return true;
  }
  const { error: insErr } = await db.from('team_members').insert(CARD);
  if (insErr) throw new Error('team_members insert failed: ' + insErr.message);
  const { data: back } = await db
    .from('team_members')
    .select('name, profile_type, experience_items, expertise_items, display_order')
    .eq('name', NAME)
    .single();
  const ok =
    back?.profile_type === 'compact' &&
    back.experience_items?.length === CARD.experience_items.length &&
    back.expertise_items?.length === CARD.expertise_items.length &&
    back.display_order === CARD.display_order;
  console.log(ok ? '  ok    inserted and read back.' : '  FAIL the card did not read back as written.');
  return ok;
}

async function fixSpelling(db) {
  console.log('\n2. US spelling on ' + KALEEM_SLUG);
  const { data: sections, error } = await db
    .from('page_sections')
    .select('id, section_type, content')
    .eq('page_slug', KALEEM_SLUG)
    .eq('section_type', 'founder_credentials');
  if (error) throw new Error('page_sections read failed: ' + error.message);

  let ok = true;
  for (const s of sections ?? []) {
    const before = JSON.stringify(s.content);
    const after = usSpelling(before);
    if (before === after) {
      console.log(`  skip  section ${s.id}: no "modelling".`);
      continue;
    }
    const hits = (before.match(/[Mm]odelling/g) ?? []).length;
    if (DRY_RUN) {
      console.log(`  would replace ${hits} occurrence(s) in section ${s.id} (${s.content?.heading ?? ''}).`);
      continue;
    }
    const { error: upErr } = await db
      .from('page_sections')
      .update({ content: JSON.parse(after) })
      .eq('id', s.id);
    if (upErr) throw new Error('page_sections update failed: ' + upErr.message);
    const { data: back } = await db.from('page_sections').select('content').eq('id', s.id).single();
    if (JSON.stringify(back?.content) === after) {
      console.log(`  ok    section ${s.id} (${s.content?.heading ?? ''}): ${hits} replaced.`);
    } else {
      console.error(`  FAIL section ${s.id} did not read back.`);
      ok = false;
    }
  }
  return ok;
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

  const a = await seedCard(db);
  const b = await fixSpelling(db);

  if (DRY_RUN) console.log('\nDry run, nothing written.');
  else if (a && b) console.log('\nCOMPLETE.');
  else process.exitCode = 1;
}

main().catch((err) => {
  console.error('seed-team-shahjahan failed:', err.message);
  process.exitCode = 1;
});
