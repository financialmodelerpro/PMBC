// scripts/seed-services-engagement-block.mjs
//
// Applies migration 069_services_engagement_block.sql through supabase-js.
//
// Adds "How an engagement runs" to /services as a `paragraphs` section at
// display_order 27, between the nine cards at 25 and the closing call to action
// at 30.
//
//   node scripts/seed-services-engagement-block.mjs           apply
//   node scripts/seed-services-engagement-block.mjs --dry-run report only
//   npm run seed-services-engagement-block
//
// Idempotent: guarded on no `paragraphs` section already existing on this page,
// so a re-run cannot add a second copy or overwrite wording edited since.
//
// The write is read back and the resulting page order printed, because where
// this block lands is half the point of it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'services';
const TYPE = 'paragraphs';
const ORDER = 27;

const BODY =
  'Every mandate is scoped by the partner who will do the work, so nothing is ' +
  'handed to a different team afterwards. The model is built with you and ' +
  'revised as assumptions change, rather than delivered once and defended. ' +
  'Every document is generated from the approved model rather than rekeyed, so ' +
  'the numbers cannot drift. And the model stays live through the transaction, ' +
  'updated as diligence findings land and lender terms firm up.';

const CONTENT = {
  eyebrow: 'HOW AN ENGAGEMENT RUNS',
  heading: 'Scoped by the partner who delivers it.',
  align: 'left',
  html: `<p>${BODY}</p>`,
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
    .select('id, section_type, display_order, visible, content')
    .eq('page_slug', PAGE)
    .order('display_order', { ascending: true });
  if (error) throw new Error('page_sections read failed: ' + error.message);
  return data ?? [];
}

function printOrder(sections) {
  for (const s of sections) {
    const label =
      s.section_type === TYPE
        ? `${s.section_type}  "${String(s.content?.heading ?? '').slice(0, 40)}"`
        : s.section_type;
    console.log(`  ${String(s.display_order).padStart(4)}  ${label}${s.visible ? '' : '  (hidden)'}`);
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

  const before = await readSections(db);
  console.log('page order before:');
  printOrder(before);

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
  printOrder(after);

  const blocks = after.filter((s) => s.section_type === TYPE);
  if (blocks.length !== 1) {
    failures.push(`${PAGE} has ${blocks.length} ${TYPE} sections, expected 1`);
  } else {
    const c = blocks[0].content ?? {};
    if (!blocks[0].visible) failures.push('the block is hidden');
    if (c.eyebrow !== CONTENT.eyebrow) failures.push(`eyebrow is ${JSON.stringify(c.eyebrow)}`);
    if (c.heading !== CONTENT.heading) failures.push(`heading is ${JSON.stringify(c.heading)}`);
    if (c.html !== CONTENT.html) failures.push('the body is not what was sent');
  }

  // Between the cards and the closing call to action, which is the whole ask.
  const at = (type) => after.findIndex((s) => s.section_type === type);
  const blockAt = at(TYPE);
  const gridAt = at('service_grid');
  const ctaAt = at('cta_block');
  if (gridAt !== -1 && blockAt !== -1 && blockAt < gridAt) {
    failures.push('the block sorts above the card grid');
  }
  if (ctaAt !== -1 && blockAt !== -1 && blockAt > ctaAt) {
    failures.push('the block sorts below the closing call to action');
  }
  if (gridAt !== -1 && ctaAt !== -1 && blockAt !== gridAt + 1) {
    failures.push('the block is not immediately after the card grid');
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
  console.error('seed-services-engagement-block failed:', err.message);
  process.exitCode = 1;
});
