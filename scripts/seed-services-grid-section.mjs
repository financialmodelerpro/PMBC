// scripts/seed-services-grid-section.mjs
//
// Applies migration 068_services_grid_section.sql through supabase-js.
//
// Seeds the `service_grid` section on /services at display_order 25, between
// the video and the closing call to action, so the nine cards sit where the
// builder says they sit.
//
//   node scripts/seed-services-grid-section.mjs           apply
//   node scripts/seed-services-grid-section.mjs --dry-run report only
//   npm run seed-services-grid-section
//
// Idempotent: guarded on the section not already existing, so a re-run cannot
// add a second grid or overwrite copy edited in the builder since.
//
// The write is read back and the resulting page order printed before success is
// reported, because the order is the whole point of this migration.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'services';
const TYPE = 'service_grid';
const ORDER = 25;

/** The wording the route file carried, moved rather than rewritten. */
const CONTENT = {
  eyebrow: 'Practice Areas',
  heading: 'Nine disciplines, one standard of work',
  intro:
    'Each engagement is led directly by the partner, modelled to institutional standards, and delivered with the documentation a board, lender, or investor will accept without rework.',
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

async function readSections(db) {
  const { data, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, visible')
    .eq('page_slug', PAGE)
    .order('display_order', { ascending: true });
  if (error) throw new Error('page_sections read failed: ' + error.message);
  return data ?? [];
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

  const before = await readSections(db);
  console.log('page order before:');
  for (const s of before) {
    console.log(`  ${String(s.display_order).padStart(4)}  ${s.section_type}${s.visible ? '' : '  (hidden)'}`);
  }
  console.log('  (the grid rendered here, after everything, from the route file)');

  if (before.some((s) => s.section_type === TYPE)) {
    console.log(`\nskip  ${PAGE}/${TYPE}: already present`);
  } else if (DRY_RUN) {
    console.log(`\nwould create ${PAGE}/${TYPE} at order ${ORDER}`);
  } else {
    const { data: created, error } = await db
      .from('page_sections')
      .insert({
        page_slug: PAGE,
        section_type: TYPE,
        content: CONTENT,
        styles: {},
        display_order: ORDER,
        visible: true,
      })
      .select('id');
    if (error) throw new Error('insert failed: ' + error.message);
    if (!created || created.length !== 1) {
      throw new Error(`insert matched ${created?.length ?? 0} rows, expected 1`);
    }
    console.log(`\ncreate ${PAGE}/${TYPE} at order ${ORDER}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];
  const after = await readSections(db);

  console.log('page order after:');
  for (const s of after) {
    console.log(`  ${String(s.display_order).padStart(4)}  ${s.section_type}${s.visible ? '' : '  (hidden)'}`);
  }

  const grids = after.filter((s) => s.section_type === TYPE);
  if (grids.length !== 1) {
    failures.push(`${PAGE} has ${grids.length} ${TYPE} sections, expected 1`);
  } else if (!grids[0].visible) {
    failures.push(`${PAGE}/${TYPE} is hidden`);
  }

  // The ordering this migration exists to produce: the grid above the closing
  // call to action, not below it.
  const gridAt = after.findIndex((s) => s.section_type === TYPE);
  const ctaAt = after.findIndex((s) => s.section_type === 'cta_block');
  if (gridAt === -1) {
    failures.push('no grid section to order');
  } else if (ctaAt !== -1 && gridAt > ctaAt) {
    failures.push('the grid still sorts below the closing call to action');
  }

  const heroAt = after.findIndex((s) => s.section_type === 'hero');
  if (heroAt !== -1 && gridAt !== -1 && gridAt < heroAt) {
    failures.push('the grid sorts above the hero');
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
  console.error('seed-services-grid-section failed:', err.message);
  process.exitCode = 1;
});
