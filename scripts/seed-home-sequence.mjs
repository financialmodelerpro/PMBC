// scripts/seed-home-sequence.mjs
//
// Applies migration 051_home_sequence_and_carousel.sql through supabase-js.
//
//   node scripts/seed-home-sequence.mjs           apply
//   node scripts/seed-home-sequence.mjs --dry-run report only
//   npm run seed-home-sequence
//
// Three changes to the home page, all described in the migration header:
//   1. "What we do" becomes a short statement with a CTA to /services and
//      moves below the firm track record
//   2. "Firm credentials" is deleted, since the stats block above it already
//      carries the same six facts
//   3. "Who we serve" becomes an audience_carousel with an image slot per card
//
// Idempotent: each step is guarded on the state it expects to find, so a re-run
// after an operator has edited this copy reports a skip rather than a rewrite.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 'home';

/** Where "What we do" lands: immediately after the stats block at 40. */
const WHAT_WE_DO_ORDER = 45;

const WHAT_WE_DO = {
  eyebrow: 'WHAT WE DO',
  headline: 'Corporate finance, end to end.',
  subhead:
    'Financial modeling, valuation, due diligence, M&A, project finance, and the investor documentation that closes a transaction. Nine disciplines, one partner leading every one of them.',
  cta_primary_label: 'View all services',
  cta_primary_href: '/services',
  cta_secondary_label: 'Book a Meeting',
  cta_secondary_href: '/book',
};

const AUDIENCES = [
  {
    title: 'Family Offices',
    description:
      'Investment structuring, opportunity evaluation, and portfolio-level financial analysis for single-family and multi-family offices in KSA and the GCC.',
    image_url: '',
    image_alt: '',
  },
  {
    title: 'Investment Offices',
    description:
      'Deal-level modeling, valuation, and due diligence support, supplementing in-house teams on selective mandates.',
    image_url: '',
    image_alt: '',
  },
  {
    title: 'Real Estate Developers',
    description:
      'Feasibility, mixed-use modeling, lender-grade financial structuring, and capital-raising support across residential, commercial, and hospitality.',
    image_url: '',
    image_alt: '',
  },
  {
    title: 'Corporates and Sponsors',
    description:
      'M&A, valuation, project finance, and investor documentation for strategic transactions and capital events.',
    image_url: '',
    image_alt: '',
  },
];

const CAROUSEL = {
  eyebrow: 'WHO WE SERVE',
  headline: 'Capital allocators who buy advisory on judgment, not headcount.',
  intro: '',
  autoplay_seconds: 6,
  items: AUDIENCES,
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

/** Em and en dash detector, written as escapes so this file cannot itself
 *  trip the repository's zero-dash gate. */
const DASH_RX = new RegExp('[\u2013\u2014]');

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
    .select('id, section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');
  if (error) throw new Error('read: ' + error.message);

  const line = (list) =>
    '  ' + (list ?? []).map((r) => `${r.display_order} ${r.section_type}`).join(' | ');
  console.log(`=== ${PAGE} ===`);
  console.log(line(rows));

  // ---- 1. "What we do" ------------------------------------------------------
  const whatWeDo = (rows ?? []).find(
    (r) => r.content?.eyebrow === 'WHAT WE DO' && r.section_type === 'service_cards',
  );
  if (!whatWeDo) {
    console.log('  skip  "What we do" is no longer a six-card grid');
  } else {
    act(
      `replace the ${(whatWeDo.content?.cards ?? []).length} service cards with a short ` +
        `statement and a CTA to /services, moved to display_order ${WHAT_WE_DO_ORDER}`,
    );
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          section_type: 'cta_block',
          display_order: WHAT_WE_DO_ORDER,
          content: WHAT_WE_DO,
          updated_at: new Date().toISOString(),
        })
        .eq('id', whatWeDo.id);
      if (e) throw new Error('what-we-do update: ' + e.message);
    }
  }

  // ---- 2. Firm credentials --------------------------------------------------
  const credentials = (rows ?? []).find(
    (r) =>
      r.section_type === 'founder_credentials' && r.content?.heading === 'Firm credentials',
  );
  if (!credentials) {
    console.log('  skip  the firm credentials section is already gone');
  } else {
    act('delete the firm credentials section, duplicated by the stats block above it');
    if (!DRY_RUN) {
      const { error: e } = await db.from('page_sections').delete().eq('id', credentials.id);
      if (e) throw new Error('credentials delete: ' + e.message);
    }
  }

  // ---- 3. Who we serve ------------------------------------------------------
  const audience = (rows ?? []).find(
    (r) => r.content?.eyebrow === 'WHO WE SERVE' && r.section_type === 'service_cards',
  );
  if (!audience) {
    console.log('  skip  "Who we serve" is already a carousel');
  } else {
    act(`convert "Who we serve" to a ${AUDIENCES.length} card carousel with image slots`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          section_type: 'audience_carousel',
          content: CAROUSEL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', audience.id);
      if (e) throw new Error('carousel update: ' + e.message);
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
  console.log(line(after));

  const list = after ?? [];
  const byOrder = list.map((r) => r.section_type);

  const cta = list.find((r) => r.content?.eyebrow === 'WHAT WE DO');
  if (!cta) failures.push('no "What we do" section');
  else {
    if (cta.section_type !== 'cta_block') {
      failures.push(`"What we do" is ${cta.section_type}, expected cta_block`);
    }
    if (Array.isArray(cta.content?.cards) && cta.content.cards.length) {
      failures.push('"What we do" still carries service cards');
    }
    if (cta.content?.cta_primary_href !== '/services') {
      failures.push('"What we do" does not link to /services');
    }
    const stats = list.find((r) => r.section_type === 'stats_block');
    if (!stats) failures.push('no stats block to position "What we do" against');
    else if (cta.display_order <= stats.display_order) {
      failures.push(
        `"What we do" is at ${cta.display_order}, not after the track record at ${stats.display_order}`,
      );
    }
  }

  if (list.some((r) => r.content?.heading === 'Firm credentials')) {
    failures.push('the firm credentials section is still on the page');
  }

  const carousel = list.find((r) => r.section_type === 'audience_carousel');
  if (!carousel) failures.push('no audience carousel');
  else {
    const items = Array.isArray(carousel.content?.items) ? carousel.content.items : [];
    if (items.length !== AUDIENCES.length) {
      failures.push(`carousel has ${items.length} cards, expected ${AUDIENCES.length}`);
    }
    for (const a of AUDIENCES) {
      const found = items.find((i) => i?.title === a.title);
      if (!found) failures.push(`carousel is missing "${a.title}"`);
      // The image slot must exist even while empty, so an operator can see
      // where to upload rather than having to know the key name.
      else if (typeof found.image_url !== 'string') {
        failures.push(`"${a.title}" has no image_url slot`);
      }
    }
    if (!Number.isFinite(carousel.content?.autoplay_seconds)) {
      failures.push('carousel has no autoplay interval');
    }
  }

  if (list.some((r) => r.section_type === 'service_cards')) {
    failures.push('a service_cards grid is still on the home page');
  }

  // Escaped rather than literal, so this detector does not trip the repo gate.
  if (DASH_RX.test(JSON.stringify(list))) {
    failures.push('em or en dash in the page content');
  }

  console.log('  order: ' + byOrder.join(' > '));

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-home-sequence failed:', err.message);
  process.exitCode = 1;
});
