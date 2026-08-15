// scripts/seed-fmp-page-pass.mjs
//
// Applies migration 063_fmp_page_pass.sql through supabase-js.
//
//   1. The intro said "launching soon" while the card said "Live now".
//   2. The intro was four paragraphs of platform marketing and never answered
//      why an advisory firm carries a platform.
//   3. "What you get" had lost two of six items and one title read as a
//      half-finished edit.
//   4. The hero pointed at the platform and the firm at once.
//   5. The certification section restated the Training Hub card above it.
//
//   node scripts/seed-fmp-page-pass.mjs           apply
//   node scripts/seed-fmp-page-pass.mjs --dry-run report only
//   npm run seed-fmp-page-pass
//
// Keys are merged into stored content rather than replacing it, so media,
// styles and anything else an operator has set survive. The one exception is
// the certification section, which is deleted; migration 063 records its full
// content so it can be recreated by hand.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'financial-modeler-pro';

const INTRO_HTML =
  '<p style="text-align: justify;">Financial Modeler Pro is the platform arm of PaceMakers. A Training Hub certifies the modeling method free of charge, and a Modeling Hub runs it: Real Estate Financial Modeling is live now, with business valuation and equity research in build.</p>' +
  '<p style="text-align: justify;">An advisory firm carrying a software platform needs explaining. Much of what a client first asks for is a modeling question, and a modeling question is better answered by a tool than by an engagement letter. The platform answers those, at no cost and without a conversation. What it cannot answer is the judgment underneath: which structure to take to a lender, what a business is worth to this buyer rather than to any buyer, whether a term sheet is worth signing. That is the firm&rsquo;s work.</p>';

const CHECKLIST = [
  {
    title: 'Multi-discipline modeling',
    description:
      'Real estate development, business valuation, project finance, FP&A and corporate finance, each with its own workflow rather than one generic template.',
  },
  {
    title: 'Structured workflows',
    description:
      'A model is built module by module in a fixed order, so nothing is left undefined and no assumption is buried in a cell nobody opens.',
  },
  {
    title: 'Monthly or annual periods',
    description:
      'Choose the periodicity the transaction actually needs. Monthly for construction draws and cash sweeps, annual for long-horizon valuation.',
  },
  {
    title: 'Formula-linked Excel and investor PDF export',
    description:
      'The workbook exports with its formulas intact rather than as pasted values, so every figure shows the basis it was calculated on, alongside a clean PDF report ready to circulate.',
  },
  {
    title: 'Free certification',
    description:
      'Both certification paths are free, with no subscription and no paywall, and the certificate carries a unique ID that anyone can verify.',
  },
  {
    title: 'Built by a practitioner, not a software company',
    description:
      'Every module reflects how a deal was actually structured. When a live mandate exposes a structure the tools handle badly, the tools change.',
  },
];

const TRAINING_DESCRIPTION =
  'The method, taught and assessed rather than merely attended. Video sessions build the model with you, each one ending in a quiz you have to pass before the next unlocks, and the path finishes with a certification exam. Free, and it stays free.';

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

const strip = (html) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function sections(db) {
  const { data, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');
  if (error) throw new Error('read failed: ' + error.message);
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

  const rows = await sections(db);
  const at = (order, type) =>
    rows.find((r) => r.display_order === order && (!type || r.section_type === type));

  const intro = at(20, 'prose_checklist');
  const hero = at(10, 'hero');
  const cards = at(40, 'feature_cards');
  const cert = at(50, 'cta_block');
  const closing = at(60, 'cta_block');

  if (!intro) throw new Error('no prose_checklist at display_order 20.');
  if (!hero) throw new Error('no hero at display_order 10.');
  if (!cards) throw new Error('no feature_cards at display_order 40.');
  if (!closing) throw new Error('no cta_block at display_order 60.');

  console.log('FMP page pass\n');

  // 1 and 2. The intro.
  const introBefore = strip(intro.content?.html);
  console.log('  20  intro');
  console.log(`      was ${introBefore.split('. ').length} sentences, ${introBefore.length} characters`);
  console.log(
    `      launching-soon contradiction present: ${/launching soon/i.test(introBefore)}`,
  );
  const introAfter = strip(INTRO_HTML);
  console.log(`      now ${introAfter.length} characters, contradiction removed`);

  // 3. The checklist.
  const itemsBefore = Array.isArray(intro.content?.items) ? intro.content.items : [];
  console.log(`  20  "What you get": ${itemsBefore.length} items becomes ${CHECKLIST.length}`);
  const restored = CHECKLIST.map((c) => c.title).filter(
    (t) => !itemsBefore.some((i) => i?.title === t),
  );
  for (const t of restored) console.log(`        + ${t}`);

  // 4. The hero.
  console.log(
    `  10  hero secondary CTA ${JSON.stringify(hero.content?.cta_secondary_label ?? null)} removed`,
  );

  // 5. Certification.
  console.log('  40  Training Hub description gains "assessed rather than merely attended"');
  console.log(`  50  certification section ${cert ? 'deleted' : 'already gone'}`);
  console.log('  60  closing block gives up the rationale, asks once');

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  const merge = async (row, patch) => {
    const { error } = await db
      .from('page_sections')
      .update({
        content: { ...(row.content ?? {}), ...patch },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw new Error(`update failed at ${row.display_order}: ` + error.message);
  };

  await merge(intro, { html: INTRO_HTML, items: CHECKLIST });
  await merge(hero, { cta_secondary_label: '', cta_secondary_href: '' });

  // The Training Hub is the second card. Patched by index against a length
  // check rather than by rebuilding the array, so the media, bullets and CTA
  // an operator may have changed are untouched.
  const cardList = Array.isArray(cards.content?.cards) ? [...cards.content.cards] : [];
  if (cardList.length !== 2 || cardList[1]?.title !== 'Training Hub') {
    throw new Error(
      `expected two cards with Training Hub second, found ${cardList.length}: ${cardList.map((c) => c?.title).join(', ')}`,
    );
  }
  cardList[1] = { ...cardList[1], description: TRAINING_DESCRIPTION };
  await merge(cards, { cards: cardList });

  if (cert) {
    const { error } = await db.from('page_sections').delete().eq('id', cert.id);
    if (error) throw new Error('delete failed at 50: ' + error.message);
  }

  await merge(closing, {
    headline: 'Start on the platform. Bring us the rest.',
    subhead:
      'Registration is free and both certification paths cost nothing. A mandate begins where the modeling leaves off.',
    cta_primary_label: 'Speak to the firm',
    cta_primary_href: '/contact',
    cta_secondary_label: '',
    cta_secondary_href: '',
  });

  console.log('\nVerifying...');
  let ok = true;
  const after = await sections(db);
  const a = (order) => after.find((r) => r.display_order === order)?.content ?? {};

  const introText = strip(a(20).html);
  if (/launching soon/i.test(introText)) {
    console.error('  FAIL  the intro still says launching soon.');
    ok = false;
  } else if (/real estate financial modeling is live now/i.test(introText)) {
    console.log('  ok    the intro states the live status the card states.');
  } else {
    console.error('  FAIL  the intro does not state the Modeling Hub status.');
    ok = false;
  }

  const paras = (a(20).html ?? '').split('</p>').filter((p) => p.trim()).length;
  if (paras <= 2) {
    console.log(`  ok    the intro is ${paras} paragraphs, down from 4.`);
  } else {
    console.error(`  FAIL  the intro is still ${paras} paragraphs.`);
    ok = false;
  }
  if (/advisory firm carrying a software platform/i.test(introText)) {
    console.log('  ok    the intro answers why a firm carries a platform.');
  } else {
    console.error('  FAIL  the intro does not answer the platform question.');
    ok = false;
  }

  const items = a(20).items ?? [];
  if (items.length === 6) {
    console.log('  ok    "What you get" holds six items.');
  } else {
    console.error(`  FAIL  "What you get" holds ${items.length} items.`);
    ok = false;
  }
  if (items.some((i) => /^Formula-linked Excel and investor PDF export$/.test(i?.title ?? ''))) {
    console.log('  ok    the export item title is restored.');
  } else {
    console.error('  FAIL  the export item title is not restored.');
    ok = false;
  }

  const trainingDesc = (a(40).cards ?? [])[1]?.description ?? '';
  if (/rather than merely attended/i.test(trainingDesc)) {
    console.log('  ok    the Training Hub card carries the assessed-not-attended point.');
  } else {
    console.error('  FAIL  the Training Hub card did not take the folded-in point.');
    ok = false;
  }

  if (after.some((r) => r.display_order === 50)) {
    console.error('  FAIL  the certification section is still present.');
    ok = false;
  } else {
    console.log('  ok    the certification section is gone.');
  }

  // One call to action per section, the discipline applied on home.
  let over = 0;
  console.log('\n  Calls to action, per section:');
  for (const r of after) {
    const c = r.content ?? {};
    const labels = ['cta_label', 'cta_primary_label', 'cta_secondary_label']
      .map((k) => c[k])
      .filter((v) => typeof v === 'string' && v.trim());
    // Card CTAs belong to their card, not to the section as an ask.
    if (labels.length === 0) continue;
    if (labels.length > 1) over++;
    console.log(
      `    ${String(r.display_order).padStart(3)}  ${r.section_type.padEnd(16)} ${labels.length}  ${labels.join(' | ')}${labels.length > 1 ? '   OVER' : ''}`,
    );
  }
  if (over === 0) {
    console.log('  ok    one call to action per section, including the hero.');
  } else {
    console.error(`  FAIL  ${over} section(s) offer more than one.`);
    ok = false;
  }

  if (ok) {
    console.log('\nCOMPLETE.');
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('seed-fmp-page-pass failed:', err.message);
  process.exitCode = 1;
});
