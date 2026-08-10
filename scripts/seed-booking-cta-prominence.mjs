// scripts/seed-booking-cta-prominence.mjs
//
// Applies migration 039_booking_cta_prominence.sql through supabase-js.
//
// Raises the booking route's prominence in four places, all as data:
//   1. Navbar CTA        header_settings cta_label / cta_href -> Book a Meeting, /book
//   2. Contact callout   cms_content `booking`, two new keys
//   3. Founder card      cms_content `contact`, four new keys
//   4. Home founder CTA  page_sections founder_block on `home` -> /book
//
//   node scripts/seed-booking-cta-prominence.mjs           apply
//   node scripts/seed-booking-cta-prominence.mjs --dry-run report only
//   npm run seed-booking-cta
//
// Idempotent and non-destructive. The navbar CTA is only repointed while it
// still carries the old /contact value, so an operator edit outranks a re-run.
// The founder CTA is only filled when its href is empty. New copy rows are
// inserted only when absent.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const NAV_CTA = [
  { key: 'cta_label', from: 'Start a Conversation', to: 'Book a Meeting' },
  { key: 'cta_href', from: '/contact', to: '/book' },
];

const BOOKING_COPY = [
  ['contact_callout_body', 'Book a 60 minute advisory meeting directly with Ahmad.'],
  ['contact_callout_cta', 'Book a Meeting'],
];

const CONTACT_COPY = [
  ['founder_name', 'Ahmad Din'],
  ['founder_heading', 'Speak directly with the founder'],
  [
    'founder_body',
    'Every mandate at PaceMakers is led personally by Ahmad Din. If you would rather discuss your situation before writing it down, book a call.',
  ],
  ['founder_cta_label', 'Book a Meeting'],
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

/** Inserts only the (section, key) pairs that do not already exist. */
async function insertMissingCopy(db, section, rows) {
  const { data: existing, error } = await db
    .from('cms_content')
    .select('key')
    .eq('section', section);
  if (error) throw new Error(`cms_content read (${section}) failed: ` + error.message);
  const have = new Set((existing ?? []).map((r) => r.key));
  const missing = rows.filter(([k]) => !have.has(k));

  if (missing.length === 0) {
    console.log(`skip  cms_content ${section}: all ${rows.length} key(s) already present`);
    return;
  }
  if (DRY_RUN) {
    console.log(`would insert ${missing.length} ${section} key(s): ${missing.map(([k]) => k).join(', ')}`);
    return;
  }
  const { error: insErr } = await db
    .from('cms_content')
    .insert(missing.map(([k, v]) => ({ section, key: k, value: v })));
  if (insErr) throw new Error(`cms_content insert (${section}) failed: ` + insErr.message);
  console.log(`insert ${missing.length} ${section} key(s): ${missing.map(([k]) => k).join(', ')}`);
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

  // ---- 1. Navbar CTA ----------------------------------------------------
  for (const { key: k, from, to } of NAV_CTA) {
    const { data: row, error } = await db
      .from('cms_content')
      .select('id, value')
      .eq('section', 'header_settings')
      .eq('key', k)
      .maybeSingle();
    if (error) throw new Error(`header_settings read (${k}) failed: ` + error.message);

    if (!row) {
      console.log(`skip  header_settings.${k}: row absent, the shipped default applies`);
      continue;
    }
    if (row.value === to) {
      console.log(`skip  header_settings.${k}: already "${to}"`);
      continue;
    }
    if (row.value !== from) {
      console.log(
        `skip  header_settings.${k}: value is "${row.value}", not the expected "${from}". Left alone, an operator edit outranks this migration.`,
      );
      continue;
    }
    if (DRY_RUN) {
      console.log(`would set header_settings.${k} = "${to}" (was "${from}")`);
      continue;
    }
    const { data: updated, error: upErr } = await db
      .from('cms_content')
      .update({ value: to, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id, value');
    if (upErr) throw new Error(`header_settings update (${k}) failed: ` + upErr.message);
    if (!updated || updated.length !== 1 || updated[0].value !== to) {
      throw new Error(`header_settings.${k} did not store what was sent`);
    }
    console.log(`set   header_settings.${k} = "${to}"`);
  }

  // ---- 2 + 3. Copy rows -------------------------------------------------
  await insertMissingCopy(db, 'booking', BOOKING_COPY);
  await insertMissingCopy(db, 'contact', CONTACT_COPY);

  // ---- 2b. Retire the key the old subtle strip used ---------------------
  // The callout that replaced it reads `contact_prompt` and
  // `contact_callout_cta`, so this key now controls nothing. Left in place it
  // would sit in /admin/content inviting an edit with no effect.
  const { data: orphan } = await db
    .from('cms_content')
    .select('id')
    .eq('section', 'booking')
    .eq('key', 'contact_link_label')
    .maybeSingle();
  if (!orphan) {
    console.log('skip  cms_content (booking, contact_link_label): already absent');
  } else if (DRY_RUN) {
    console.log('would delete cms_content (booking, contact_link_label), now unused');
  } else {
    const { error } = await db.from('cms_content').delete().eq('id', orphan.id);
    if (error) throw new Error('contact_link_label delete failed: ' + error.message);
    console.log('delete cms_content (booking, contact_link_label), now unused');
  }

  // ---- 4. Home founder card second CTA ----------------------------------
  const { data: cards, error: cardErr } = await db
    .from('page_sections')
    .select('id, page_slug, content')
    .eq('section_type', 'founder_block')
    .eq('page_slug', 'home');
  if (cardErr) throw new Error('founder_block read failed: ' + cardErr.message);

  for (const card of cards ?? []) {
    const href = String(card.content?.cta_secondary_href ?? '').trim();
    if (href !== '') {
      console.log(`skip  home founder card: secondary CTA already points at ${href}`);
      continue;
    }
    if (DRY_RUN) {
      console.log('would point home founder card secondary CTA at /book');
      continue;
    }
    const next = {
      ...(card.content ?? {}),
      cta_secondary_label: 'Book a Meeting',
      cta_secondary_href: '/book',
    };
    const { data: updated, error } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', card.id)
      .select('id, content');
    if (error) throw new Error('founder_block update failed: ' + error.message);
    if (!updated || updated.length !== 1) {
      throw new Error(`founder_block update matched ${updated?.length ?? 0} rows, expected 1`);
    }
    if (updated[0].content?.cta_secondary_href !== '/book') {
      throw new Error('founder_block update stored something other than what was sent');
    }
    console.log('set   home founder card secondary CTA -> /book');
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification -------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: nav } = await db
    .from('cms_content')
    .select('key, value')
    .eq('section', 'header_settings')
    .in('key', ['cta_label', 'cta_href']);
  const navMap = Object.fromEntries((nav ?? []).map((r) => [r.key, r.value]));
  if (navMap.cta_label !== 'Book a Meeting') {
    failures.push(`header_settings.cta_label is "${navMap.cta_label}"`);
  }
  if (navMap.cta_href !== '/book') {
    failures.push(`header_settings.cta_href is "${navMap.cta_href}"`);
  }

  for (const [section, rows] of [
    ['booking', BOOKING_COPY],
    ['contact', CONTACT_COPY],
  ]) {
    const { data } = await db.from('cms_content').select('key').eq('section', section);
    const have = new Set((data ?? []).map((r) => r.key));
    for (const [k] of rows) {
      if (!have.has(k)) failures.push(`cms_content (${section}, ${k}) is missing`);
    }
  }

  const { data: stillThere } = await db
    .from('cms_content')
    .select('id')
    .eq('section', 'booking')
    .eq('key', 'contact_link_label')
    .maybeSingle();
  if (stillThere) failures.push('cms_content (booking, contact_link_label) was not removed');

  const { data: finalCards } = await db
    .from('page_sections')
    .select('page_slug, content')
    .eq('section_type', 'founder_block')
    .eq('page_slug', 'home');
  for (const c of finalCards ?? []) {
    if (c.content?.cta_secondary_href !== '/book') {
      failures.push(`home founder card secondary href is "${c.content?.cta_secondary_href}"`);
    }
    if (c.content?.cta_primary_href !== '/about/ahmad-din') {
      failures.push('home founder card primary CTA was disturbed');
    }
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
  console.error('seed-booking-cta-prominence failed:', err.message);
  process.exitCode = 1;
});
