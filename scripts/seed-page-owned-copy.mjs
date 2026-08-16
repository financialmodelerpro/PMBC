// scripts/seed-page-owned-copy.mjs
//
// Applies migration 066_page_owned_copy.sql through supabase-js.
//
// Moves /contact and /book copy out of cms_content and into their pages:
//   cms_content `contact` (13 keys) -> page_sections contact_body  on `contact`
//   cms_content `booking` (8 keys)  -> page_sections booking_body  on `book`
//
//   node scripts/seed-page-owned-copy.mjs           apply
//   node scripts/seed-page-owned-copy.mjs --dry-run report only
//   npm run seed-page-owned-copy
//
// Values are carried at whatever they hold now, never reseeded from a literal,
// so an edit made in the admin survives the move. The empty string is a value
// like any other here: `form_response_note` is empty on purpose and must stay
// empty rather than being dropped, since the renderer treats absent and empty
// differently.
//
// Idempotent. The section is created only when absent, and a cms_content row is
// deleted only once the section demonstrably carries that key, so an
// interrupted run cannot leave a page with its copy in neither place.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const MOVES = [
  {
    fromSection: 'contact',
    pageSlug: 'contact',
    sectionType: 'contact_body',
    displayOrder: 20,
    expectedKeys: [
      'form_eyebrow',
      'form_heading',
      'form_response_note',
      'booking_prompt',
      'booking_body',
      'booking_cta_label',
      'direct_eyebrow',
      'direct_heading',
      'direct_intro',
      'founder_name',
      'founder_heading',
      'founder_body',
      'founder_cta_label',
    ],
  },
  {
    fromSection: 'booking',
    pageSlug: 'book',
    sectionType: 'booking_body',
    displayOrder: 20,
    expectedKeys: [
      'calendar_eyebrow',
      'fallback_prompt',
      'fallback_link_label',
      'empty_heading',
      'empty_body',
      'alternatives_label',
      'alternatives_text',
      'contact_form_label',
    ],
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

async function readCopy(db, section) {
  const { data, error } = await db
    .from('cms_content')
    .select('key, value')
    .eq('section', section);
  if (error) throw new Error(`cms_content read (${section}) failed: ` + error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
}

async function readSection(db, pageSlug, sectionType) {
  const { data, error } = await db
    .from('page_sections')
    .select('id, content, display_order, visible')
    .eq('page_slug', pageSlug)
    .eq('section_type', sectionType)
    .maybeSingle();
  if (error) throw new Error(`page_sections read (${pageSlug}) failed: ` + error.message);
  return data ?? null;
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

  for (const move of MOVES) {
    const label = `${move.pageSlug}/${move.sectionType}`;
    const copy = await readCopy(db, move.fromSection);
    const existing = await readSection(db, move.pageSlug, move.sectionType);

    // ---- Create the section ---------------------------------------------
    let content = existing?.content ?? null;

    if (existing) {
      console.log(`skip  ${label}: section already exists, carrying ${Object.keys(content ?? {}).length} key(s)`);
    } else if (Object.keys(copy).length === 0) {
      console.log(
        `skip  ${label}: no (${move.fromSection}) rows to move and no section. Nothing to do.`,
      );
      continue;
    } else if (DRY_RUN) {
      console.log(
        `would create ${label} at order ${move.displayOrder} with ${Object.keys(copy).length} key(s): ${Object.keys(copy).sort().join(', ')}`,
      );
      content = copy;
    } else {
      const { data: created, error } = await db
        .from('page_sections')
        .insert({
          page_slug: move.pageSlug,
          section_type: move.sectionType,
          content: copy,
          styles: {},
          display_order: move.displayOrder,
          visible: true,
        })
        .select('id, content');
      if (error) throw new Error(`${label} insert failed: ` + error.message);
      if (!created || created.length !== 1) {
        throw new Error(`${label} insert matched ${created?.length ?? 0} rows, expected 1`);
      }
      content = created[0].content;
      console.log(
        `create ${label} at order ${move.displayOrder} with ${Object.keys(copy).length} key(s)`,
      );
    }

    // ---- Retire the cms_content rows it replaces -------------------------
    const carried = new Set(Object.keys(content ?? {}));
    const removable = Object.keys(copy).filter((k) => carried.has(k));
    const stranded = Object.keys(copy).filter((k) => !carried.has(k));

    for (const k of stranded) {
      console.log(
        `keep  (${move.fromSection}, ${k}): the section does not carry this key, so it is left in place`,
      );
    }

    if (removable.length === 0) {
      console.log(`skip  (${move.fromSection}): nothing left to delete`);
    } else if (DRY_RUN) {
      console.log(`would delete ${removable.length} (${move.fromSection}) row(s)`);
    } else {
      const { error } = await db
        .from('cms_content')
        .delete()
        .eq('section', move.fromSection)
        .in('key', removable);
      if (error) throw new Error(`cms_content delete (${move.fromSection}) failed: ` + error.message);
      console.log(`delete ${removable.length} (${move.fromSection}) row(s)`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  for (const move of MOVES) {
    const label = `${move.pageSlug}/${move.sectionType}`;
    const section = await readSection(db, move.pageSlug, move.sectionType);
    if (!section) {
      failures.push(`${label} is missing`);
      continue;
    }
    const content = section.content ?? {};
    for (const k of move.expectedKeys) {
      if (!(k in content)) failures.push(`${label} is missing "${k}"`);
    }
    if (!section.visible) failures.push(`${label} is hidden`);

    // The key-value group must be gone, or the copy lives in two places and
    // whichever one the operator finds first is a coin toss.
    const left = await readCopy(db, move.fromSection);
    const leftKeys = Object.keys(left);
    if (leftKeys.length > 0) {
      failures.push(`cms_content (${move.fromSection}) still has: ${leftKeys.join(', ')}`);
    }
  }

  // Empty is a value here, not an absence. `form_response_note` was cleared by
  // migration 065 and must arrive cleared rather than missing, since the
  // renderer reads absent as "show the shipped sentence".
  const contactSection = await readSection(db, 'contact', 'contact_body');
  const note = contactSection?.content?.form_response_note;
  if (note !== '') {
    failures.push(`contact_body.form_response_note is ${JSON.stringify(note)}, expected ""`);
  }

  // The settings that deliberately stayed put.
  const { data: settingsRow } = await db
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  const settings = settingsRow?.settings ?? {};
  for (const k of ['booking_url', 'contact_email', 'contact_email_advisory']) {
    if (!settings[k]) failures.push(`site_settings.${k} was disturbed`);
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
  console.error('seed-page-owned-copy failed:', err.message);
  process.exitCode = 1;
});
