// scripts/seed-unlink-approach.mjs
//
// Applies migration 052_unlink_approach.sql through supabase-js.
//
//   node scripts/seed-unlink-approach.mjs           apply
//   node scripts/seed-unlink-approach.mjs --dry-run report only
//   npm run seed-unlink-approach
//
// Removes the five CMS links to /approach after the nav item was hidden. The
// page and its route stay in place; see the migration header for why the whole
// sentence goes in the first case rather than only its anchor.
//
// The final sweep is over every content-bearing table rather than only the five
// rows this script edits, so a reference an operator added somewhere else is
// reported rather than missed.
//
// Idempotent: each row is only written while it still holds the old value.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const TARGET = '/approach';

/** The exact sentence removed from the home firm introduction, anchor included. */
const INLINE_LINK =
  ' <a target="_blank" rel="noopener noreferrer" href="/approach">See how mandates are staffed</a>.';

/**
 * The four label/href pairs. Every renderer involved requires both before it
 * draws a button, so both are cleared: clearing the href alone would leave a
 * button that goes nowhere.
 */
const CTA_PAIRS = [
  {
    page: 'home',
    type: 'process_steps',
    labelKey: 'footer_cta_label',
    hrefKey: 'footer_cta_href',
    what: 'the delivery approach footer CTA',
  },
  {
    page: 'network',
    type: 'text_image',
    labelKey: 'cta_label',
    hrefKey: 'cta_href',
    what: 'the "How we work" CTA',
  },
  {
    page: 'sectors',
    type: 'text_image',
    labelKey: 'cta_label',
    hrefKey: 'cta_href',
    what: 'the "How we work" CTA',
  },
  {
    page: 'services',
    type: 'hero',
    labelKey: 'cta_secondary_label',
    hrefKey: 'cta_secondary_href',
    what: 'the secondary hero CTA',
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

let changes = 0;
const act = (msg) => {
  changes += 1;
  console.log(`  ${DRY_RUN ? 'would ' : ''}${msg}`);
};

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, page_slug, section_type, content');
  if (error) throw new Error('read: ' + error.message);

  const before = (rows ?? []).filter((r) => JSON.stringify(r.content).includes(TARGET));
  console.log(`=== ${before.length} section(s) reference ${TARGET} ===`);
  for (const r of before) console.log(`  ${r.page_slug} / ${r.section_type}`);
  console.log('');

  // ---- 1. the inline sentence -----------------------------------------------
  const intro = (rows ?? []).find(
    (r) =>
      r.page_slug === 'home' &&
      r.section_type === 'paragraphs' &&
      typeof r.content?.html === 'string' &&
      r.content.html.includes(`href="${TARGET}"`),
  );
  if (!intro) {
    console.log('  skip  the firm introduction no longer links to the page');
  } else if (!intro.content.html.includes(INLINE_LINK)) {
    // Guarded rather than a loose regex: if the sentence has been reworded, a
    // blind strip could take a neighbouring clause with it.
    console.error(
      '  FAIL  the firm introduction links to the page but not with the expected sentence.',
    );
    console.error('        Edit it in the page builder instead.');
    process.exitCode = 1;
    return;
  } else {
    act('remove the "See how mandates are staffed" sentence from the firm introduction');
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          content: { ...intro.content, html: intro.content.html.replace(INLINE_LINK, '') },
          updated_at: new Date().toISOString(),
        })
        .eq('id', intro.id);
      if (e) throw new Error('intro update: ' + e.message);
    }
  }

  // ---- 2 to 5. the label and href pairs -------------------------------------
  for (const pair of CTA_PAIRS) {
    const row = (rows ?? []).find(
      (r) =>
        r.page_slug === pair.page &&
        r.section_type === pair.type &&
        r.content?.[pair.hrefKey] === TARGET,
    );
    if (!row) {
      console.log(`  skip  ${pair.page}: ${pair.what} no longer points at ${TARGET}`);
      continue;
    }
    act(
      `clear ${pair.page}: ${pair.what} ("${row.content[pair.labelKey] ?? ''}")`,
    );
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          content: { ...row.content, [pair.labelKey]: '', [pair.hrefKey]: '' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (e) throw new Error(`${pair.page} update: ` + e.message);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  // A sweep over every content-bearing table, not just the rows edited above.
  // Trusting the four steps to have been the only four is how a reference
  // added later survives a cleanup that reports success.
  const { data: afterSections } = await db
    .from('page_sections')
    .select('page_slug, section_type, content');
  for (const r of afterSections ?? []) {
    if (JSON.stringify(r.content).includes(TARGET)) {
      failures.push(`page_sections still references it: ${r.page_slug} / ${r.section_type}`);
    }
  }

  const { data: afterContent } = await db.from('cms_content').select('section, key, value');
  for (const r of afterContent ?? []) {
    if ((r.value ?? '').includes(TARGET)) {
      failures.push(`cms_content still references it: (${r.section}, ${r.key})`);
    }
  }

  const { data: settings } = await db.from('site_settings').select('settings').eq('id', 1);
  if (JSON.stringify(settings?.[0]?.settings ?? {}).includes(TARGET)) {
    failures.push('site_settings still references it');
  }

  // The nav row itself stays, hidden. Deleting it would make restoring the page
  // a rebuild rather than one switch, and the route is deliberately still live.
  const { data: nav } = await db.from('site_pages').select('label, href, visible');
  const navRow = (nav ?? []).find((r) => r.href === TARGET);
  if (navRow && navRow.visible) {
    failures.push('the Approach nav item is visible again, so this cleanup is out of date');
  }
  if (!navRow) {
    console.log('  note  the Approach nav row has been deleted, not just hidden');
  } else {
    console.log('  ok    the Approach nav row is retained and hidden, so it can be restored');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied. No CMS content references ${TARGET}. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-unlink-approach failed:', err.message);
  process.exitCode = 1;
});
