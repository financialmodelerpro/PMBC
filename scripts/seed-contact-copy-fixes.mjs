// scripts/seed-contact-copy-fixes.mjs
//
// Applies migration 065_contact_copy_fixes.sql through supabase-js.
//
// Three corrections to the /contact copy:
//   1. (contact, form_eyebrow)       stops repeating the hero headline
//   2. (contact, form_response_note) cleared, the hero already says it
//   3. (contact, founder_body)       partner-led, not one named individual
//
//   node scripts/seed-contact-copy-fixes.mjs           apply
//   node scripts/seed-contact-copy-fixes.mjs --dry-run report only
//   npm run seed-contact-copy-fixes
//
// Each change is guarded on the value it expects to find. A row already
// carrying the new wording is skipped, and a row carrying something else is
// left alone and reported, so an edit made in the admin outranks a re-run.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const RESPONSE_NOTE =
  'We respond to every credible enquiry within one to two business days.';
const FOUNDER_TAIL =
  'If you would rather discuss your situation before writing it down, book a call.';

const CHANGES = [
  {
    key: 'form_eyebrow',
    from: 'Start a conversation',
    to: 'Enquiry',
    why: 'the hero headline already says it',
  },
  {
    key: 'form_response_note',
    from: RESPONSE_NOTE,
    to: '',
    why: 'the hero says it two lines above',
  },
  {
    key: 'founder_body',
    from: `Every mandate at PaceMakers is led personally by Ahmad Din. ${FOUNDER_TAIL}`,
    to: `Every mandate at PaceMakers is partner-led. ${FOUNDER_TAIL}`,
    why: 'the delivery model belongs to the role, not one named individual',
  },
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

  const { data: rows, error } = await db
    .from('cms_content')
    .select('id, key, value')
    .eq('section', 'contact')
    .in('key', CHANGES.map((c) => c.key));
  if (error) throw new Error('cms_content read failed: ' + error.message);
  const byKey = new Map((rows ?? []).map((r) => [r.key, r]));

  for (const change of CHANGES) {
    const row = byKey.get(change.key);
    const label = `(contact, ${change.key})`;

    if (!row) {
      console.log(`skip  ${label}: row absent, the shipped default applies`);
      continue;
    }
    if ((row.value ?? '') === change.to) {
      console.log(`skip  ${label}: already ${change.to === '' ? 'cleared' : 'updated'}`);
      continue;
    }
    if ((row.value ?? '') !== change.from) {
      console.log(
        `skip  ${label}: value is "${row.value}", not the expected wording. Left alone, an admin edit outranks this migration.`,
      );
      continue;
    }
    if (DRY_RUN) {
      console.log(`would ${change.to === '' ? 'clear' : 'set'} ${label}: ${change.why}`);
      continue;
    }

    const { data: updated, error: upErr } = await db
      .from('cms_content')
      .update({ value: change.to, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id, value');
    if (upErr) throw new Error(`${label} update failed: ` + upErr.message);
    if (!updated || updated.length !== 1 || (updated[0].value ?? '') !== change.to) {
      throw new Error(`${label} did not store what was sent`);
    }
    console.log(`${change.to === '' ? 'clear' : 'set  '} ${label}: ${change.why}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: after } = await db
    .from('cms_content')
    .select('key, value')
    .eq('section', 'contact');
  const now = new Map((after ?? []).map((r) => [r.key, r.value ?? '']));

  for (const change of CHANGES) {
    if (!now.has(change.key)) {
      failures.push(`(contact, ${change.key}) is missing`);
      continue;
    }
    if (now.get(change.key) !== change.to) {
      failures.push(`(contact, ${change.key}) is "${now.get(change.key)}"`);
    }
  }

  // The cleared row must still exist. Deleted, the route would fall back to the
  // shipped default and put the sentence straight back on the page.
  if (!now.has('form_response_note')) {
    failures.push('(contact, form_response_note) was deleted rather than cleared');
  }

  // The six keys this migration does not touch.
  for (const k of [
    'form_heading',
    'booking_prompt',
    'booking_body',
    'booking_cta_label',
    'direct_eyebrow',
    'direct_heading',
    'direct_intro',
    'founder_heading',
    'founder_name',
    'founder_cta_label',
  ]) {
    if (!now.has(k)) failures.push(`(contact, ${k}) was disturbed`);
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
  console.error('seed-contact-copy-fixes failed:', err.message);
  process.exitCode = 1;
});
