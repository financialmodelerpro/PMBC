// scripts/seed-contact-page-copy.mjs
//
// Applies migration 064_contact_page_copy.sql through supabase-js.
//
// Moves the /contact page's body copy into cms_content under `contact`:
//   1. Six strings that were hardcoded in the route file
//   2. Three booking-callout strings filed under `booking` by migration 039,
//      carried across at their current values, then deleted from `booking`
//
//   node scripts/seed-contact-page-copy.mjs           apply
//   node scripts/seed-contact-page-copy.mjs --dry-run report only
//   npm run seed-contact-page-copy
//
// Idempotent and non-destructive. Rows are inserted only when absent, so a
// re-run cannot overwrite wording edited in the admin since. The carry-across
// reads the live value rather than the shipped default for the same reason.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The three keys moved out of `booking`.
 *
 * `from` is where 039 filed it, `to` is where the contact page now reads it.
 * `fallback` is the wording shipped in the route, used only when the source row
 * is absent entirely (a database that never ran 039).
 */
const MOVES = [
  {
    from: 'contact_prompt',
    to: 'booking_prompt',
    fallback: 'Prefer to talk?',
  },
  {
    from: 'contact_callout_body',
    to: 'booking_body',
    fallback: 'Book a 60 minute advisory meeting directly with Ahmad.',
  },
  {
    from: 'contact_callout_cta',
    to: 'booking_cta_label',
    fallback: 'Book a Meeting',
  },
];

/** The six strings that were literals in the route file. Wording unchanged. */
const NEW_COPY = [
  ['form_eyebrow', 'Start a conversation'],
  ['form_heading', 'Tell us about the mandate'],
  [
    'form_response_note',
    'We respond to every credible enquiry within one to two business days.',
  ],
  ['direct_eyebrow', 'Direct'],
  ['direct_heading', 'Other ways to reach us'],
  ['direct_intro', 'For urgent matters or referrals, you can reach the firm directly.'],
];

/** Filed under `contact` by migration 039 and read by the card unchanged. */
const EXPECTED_EXISTING = [
  'founder_name',
  'founder_heading',
  'founder_body',
  'founder_cta_label',
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

async function readSection(db, section) {
  const { data, error } = await db
    .from('cms_content')
    .select('id, key, value')
    .eq('section', section);
  if (error) throw new Error(`cms_content read (${section}) failed: ` + error.message);
  return new Map((data ?? []).map((r) => [r.key, r]));
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

  const booking = await readSection(db, 'booking');
  const contact = await readSection(db, 'contact');

  // ---- 1. Carry the three booking-callout keys across -------------------
  const toInsert = [];

  for (const move of MOVES) {
    if (contact.has(move.to)) {
      console.log(`skip  (contact, ${move.to}): already present`);
      continue;
    }
    const source = booking.get(move.from);
    const value = source ? source.value : move.fallback;
    const origin = source
      ? `carried from (booking, ${move.from})`
      : `source row absent, using the shipped wording`;
    console.log(`${DRY_RUN ? 'would move ' : 'move  '}(contact, ${move.to}): ${origin}`);
    toInsert.push({ section: 'contact', key: move.to, value });
  }

  // ---- 2. The six that were hardcoded ------------------------------------
  for (const [k, v] of NEW_COPY) {
    if (contact.has(k)) {
      console.log(`skip  (contact, ${k}): already present`);
      continue;
    }
    console.log(`${DRY_RUN ? 'would insert ' : 'insert '}(contact, ${k})`);
    toInsert.push({ section: 'contact', key: k, value: v });
  }

  if (!DRY_RUN && toInsert.length > 0) {
    const { error } = await db.from('cms_content').insert(toInsert);
    if (error) throw new Error('cms_content insert failed: ' + error.message);
  }
  if (toInsert.length === 0) console.log('skip  nothing to insert, all keys present');

  // ---- 3. Retire the originals -------------------------------------------
  // Only once all three replacements exist, so an interrupted run cannot leave
  // the callout with no row on either side.
  const present = new Set([...contact.keys(), ...toInsert.map((r) => r.key)]);
  const allMoved = MOVES.every((m) => present.has(m.to));
  const stale = MOVES.filter((m) => booking.has(m.from));

  if (!allMoved) {
    console.log('skip  delete: not every replacement key is in place');
  } else if (stale.length === 0) {
    console.log('skip  delete: no (booking, contact_*) rows remain');
  } else if (DRY_RUN) {
    console.log(`would delete ${stale.length} booking key(s): ${stale.map((m) => m.from).join(', ')}`);
  } else {
    const { error } = await db
      .from('cms_content')
      .delete()
      .eq('section', 'booking')
      .in('key', stale.map((m) => m.from));
    if (error) throw new Error('cms_content delete failed: ' + error.message);
    console.log(`delete ${stale.length} booking key(s): ${stale.map((m) => m.from).join(', ')}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const finalContact = await readSection(db, 'contact');
  const finalBooking = await readSection(db, 'booking');

  for (const [k] of NEW_COPY) {
    if (!finalContact.has(k)) failures.push(`(contact, ${k}) is missing`);
  }
  for (const move of MOVES) {
    if (!finalContact.has(move.to)) failures.push(`(contact, ${move.to}) is missing`);
    if (finalBooking.has(move.from)) {
      failures.push(`(booking, ${move.from}) was not removed`);
    }
  }
  for (const k of EXPECTED_EXISTING) {
    if (!finalContact.has(k)) failures.push(`(contact, ${k}) was disturbed`);
  }

  // The wording is a move, not a rewrite, so anything the route still carries
  // as a fallback must match the stored value character for character.
  const SHIPPED = new Map([...NEW_COPY, ...MOVES.map((m) => [m.to, m.fallback])]);
  for (const [k, expected] of SHIPPED) {
    const row = finalContact.get(k);
    if (row && row.value !== expected) {
      console.log(`  note (contact, ${k}) differs from the shipped wording, an edit was kept`);
    }
  }

  // /book reads its own keys and must be unaffected by the three deletions.
  for (const k of ['calendar_eyebrow', 'alternatives_label', 'empty_heading']) {
    if (!finalBooking.has(k)) failures.push(`(booking, ${k}) was disturbed`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log('  All checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-contact-page-copy failed:', err.message);
  process.exitCode = 1;
});
