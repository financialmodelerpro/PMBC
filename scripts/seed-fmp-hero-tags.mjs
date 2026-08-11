// scripts/seed-fmp-hero-tags.mjs
//
// Applies migration 050_fmp_hero_tags.sql through supabase-js.
//
// Folds the eight /fmp capability tags into the hero and deletes the standalone
// pills section they were in. See the migration header for why folding beat
// giving that section a heading.
//
//   node scripts/seed-fmp-hero-tags.mjs           apply
//   node scripts/seed-fmp-hero-tags.mjs --dry-run report only
//   npm run seed-fmp-hero-tags
//
// Idempotent: the hero is only written while it carries no tags, and the delete
// is a no-op once done.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 'financial-modeler-pro';

const TAGS = [
  'Real Estate Models',
  'Business Valuation',
  'Project Finance',
  'Renewable Energy',
  'FP&A',
  'Capital Structuring',
  'Debt Sizing',
  'M&A Advisory',
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
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');
  if (error) throw new Error('read: ' + error.message);

  console.log(`=== ${PAGE} ===`);
  console.log('  ' + (rows ?? []).map((r) => `${r.display_order} ${r.section_type}`).join(' | '));

  // ---- 1. hero gains the tags ----------------------------------------------
  const hero = (rows ?? []).find((r) => r.section_type === 'hero');
  if (!hero) throw new Error('no hero on ' + PAGE);
  const existing = Array.isArray(hero.content?.tags) ? hero.content.tags : [];
  if (existing.length > 0) {
    console.log(`  skip  hero already carries ${existing.length} tag(s)`);
  } else {
    act(`add ${TAGS.length} capability tags to the hero`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          content: { ...hero.content, tags: TAGS },
          updated_at: new Date().toISOString(),
        })
        .eq('id', hero.id);
      if (e) throw new Error('hero update: ' + e.message);
    }
  }

  // ---- 2. the orphan pills section goes -------------------------------------
  const orphan = (rows ?? []).find((r) => r.section_type === 'founder_credentials');
  if (!orphan) {
    console.log('  skip  standalone tags section already removed');
  } else {
    act('delete the standalone capability tags section');
    if (!DRY_RUN) {
      const { error: e } = await db.from('page_sections').delete().eq('id', orphan.id);
      if (e) throw new Error('delete: ' + e.message);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];
  const { data: after } = await db
    .from('page_sections')
    .select('section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');

  console.log('  ' + (after ?? []).map((r) => `${r.display_order} ${r.section_type}`).join(' | '));

  const heroAfter = (after ?? []).find((r) => r.section_type === 'hero');
  const tagsAfter = Array.isArray(heroAfter?.content?.tags) ? heroAfter.content.tags : [];
  if (tagsAfter.length !== TAGS.length) {
    failures.push(`hero carries ${tagsAfter.length} tag(s), expected ${TAGS.length}`);
  }
  for (const t of TAGS) {
    if (!tagsAfter.includes(t)) failures.push(`hero is missing the tag "${t}"`);
  }
  // Eight tags across a four-column grid is what makes the rows even.
  if (tagsAfter.length % 4 !== 0) {
    failures.push(`${tagsAfter.length} tags will not fill four-column rows evenly`);
  }
  if ((after ?? []).some((r) => r.section_type === 'founder_credentials')) {
    failures.push('the standalone tags section is still on the page');
  }
  if ((after ?? []).length !== 6) {
    failures.push(`expected 6 sections after the fold, found ${(after ?? []).length}`);
  }
  // Escaped rather than literal, so this detector does not trip the repo gate.
  if (/[\u2013\u2014]/.test(JSON.stringify(after ?? []))) {
    failures.push('em or en dash in the page content');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-fmp-hero-tags failed:', err.message);
  process.exitCode = 1;
});
