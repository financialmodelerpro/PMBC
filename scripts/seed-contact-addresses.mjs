// scripts/seed-contact-addresses.mjs
//
// Applies migration 042_contact_addresses.sql through supabase-js.
//
// Seeds the three published contact addresses and their labels into
// site_settings, and repoints admin_email (where contact notifications are
// delivered) from the personal Gmail address to advisory@pacemakersglobal.com.
//
//   node scripts/seed-contact-addresses.mjs           apply
//   node scripts/seed-contact-addresses.mjs --dry-run report only
//   npm run seed-contact-addresses
//
// Idempotent and non-destructive: each key is only written when absent or
// blank, and admin_email only moves while it still holds the old Gmail value.
// The whole blob is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** Written only when the existing value is absent or blank. */
const FILL_IF_BLANK = [
  ['contact_email', 'info@pacemakersglobal.com'],
  ['contact_email_advisory', 'advisory@pacemakersglobal.com'],
  ['contact_email_founder', 'ahmad.din@pacemakersglobal.com'],
  ['contact_label_general', 'General enquiries'],
  ['contact_label_advisory', 'Mandate and advisory enquiries'],
  ['contact_label_founder', 'Direct to the founder'],
];

const ADMIN_EMAIL_FROM = 'meetahmadch@gmail.com';
const ADMIN_EMAIL_TO = 'advisory@pacemakersglobal.com';

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
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error('site_settings read failed: ' + error.message);

  const current =
    row?.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? row.settings
      : {};
  const next = { ...current };
  let changes = 0;

  for (const [k, v] of FILL_IF_BLANK) {
    const existing = String(current[k] ?? '').trim();
    if (existing !== '') {
      console.log(`skip  ${k}: already ${JSON.stringify(existing)}`);
      continue;
    }
    console.log(`${DRY_RUN ? 'would set' : 'set   '} ${k} = ${JSON.stringify(v)}`);
    next[k] = v;
    changes += 1;
  }

  const admin = String(current.admin_email ?? '').trim();
  if (admin === ADMIN_EMAIL_TO) {
    console.log(`skip  admin_email: already ${JSON.stringify(ADMIN_EMAIL_TO)}`);
  } else if (admin !== ADMIN_EMAIL_FROM) {
    console.log(
      `skip  admin_email: is ${JSON.stringify(admin)}, not the expected ${JSON.stringify(ADMIN_EMAIL_FROM)}. Left alone, an operator edit outranks this migration.`,
    );
  } else {
    console.log(
      `${DRY_RUN ? 'would set' : 'set   '} admin_email = ${JSON.stringify(ADMIN_EMAIL_TO)} (was ${JSON.stringify(admin)})`,
    );
    console.log('        NOTE: this changes where contact-form notifications are delivered.');
    next.admin_email = ADMIN_EMAIL_TO;
    changes += 1;
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }
  if (changes === 0) {
    console.log('\nNothing to change.');
    return;
  }

  const { error: upErr } = await db
    .from('site_settings')
    .update({ settings: next, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (upErr) throw new Error('update failed: ' + upErr.message);

  console.log('\nVerifying...');
  const { data: final } = await db
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  const after = final?.settings ?? {};
  const failures = [];

  for (const [k] of FILL_IF_BLANK) {
    if (!String(after[k] ?? '').trim()) failures.push(`${k} is still empty`);
  }
  if (!String(after.admin_email ?? '').trim()) failures.push('admin_email is empty');

  // Nothing outside the keys this script owns may have moved: site_settings is
  // a single blob, so a botched merge here would silently drop unrelated
  // settings such as the booking URL or the office location.
  const owned = new Set([...FILL_IF_BLANK.map(([k]) => k), 'admin_email']);
  for (const [k, v] of Object.entries(current)) {
    if (owned.has(k)) continue;
    if (JSON.stringify(after[k]) !== JSON.stringify(v)) {
      failures.push(`unrelated key ${k} changed`);
    }
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  All addresses set, every unrelated setting byte-identical. COMPLETE');
}

main().catch((err) => {
  console.error('seed-contact-addresses failed:', err.message);
  process.exitCode = 1;
});
