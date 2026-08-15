// scripts/seed-home-content-pass.mjs
//
// Applies migration 061_home_content_pass.sql through supabase-js.
//
// Five content corrections on the home page:
//   1. "Nine disciplines" over a list of six.
//   2. The founder's proof points were unlabelled career figures.
//   3. The engagement model was four generic verbs.
//   4. Five calls to action before the end of the page.
//   5. The closing block asked for something the rest of the site does not.
//
//   node scripts/seed-home-content-pass.mjs           apply
//   node scripts/seed-home-content-pass.mjs --dry-run report only
//   npm run seed-home-content-pass
//
// Each section is patched by merging keys into the stored content rather than
// replacing it, so media slots, styles and anything else an operator has set are
// left alone. Sections are matched on section_type plus display_order, and a
// match that does not find exactly one row is reported and skipped rather than
// guessed at.
//
// Re-running restores this wording over anything edited in the builder since.
// That is the same caveat every content migration from 014 onward carries.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'home';

const PATCHES = [
  {
    order: 45,
    type: 'cta_block',
    what: 'What we do: drop the count that did not match the list, and the second CTA',
    patch: {
      subhead:
        'Financial modeling, valuation, due diligence, M&A, project finance, and the investor documentation that closes a transaction. One partner leads every one of them.',
      cta_secondary_label: '',
      cta_secondary_href: '',
    },
  },
  {
    order: 80,
    type: 'founder_block',
    what: 'Founder card: label the proof points as career figures, and drop the second CTA',
    patch: {
      credentials_label:
        "The partner's career record, earned across senior roles before and alongside PaceMakers. The firm's own record is the block above.",
      cta_secondary_label: '',
      cta_secondary_href: '',
    },
  },
  {
    order: 70,
    type: 'process_steps',
    what: 'How we work: replace the four generic verbs with how the work is actually run',
    patch: {
      heading: 'One model, built with you and live until close.',
      steps: [
        {
          number: '01',
          title: 'Scoped by the partner',
          description:
            'The partner who will build the model runs the first conversation. The assumptions argued over at the outset are the ones that end up in it, because nothing is handed to a different team afterwards.',
        },
        {
          number: '02',
          title: 'Built with you, not for you',
          description:
            'The model is built and revised alongside you as assumptions change, rather than delivered finished. You see it while the numbers are still soft, which is when a wrong premise costs an afternoon instead of a round.',
        },
        {
          number: '03',
          title: 'Every document generated, never rekeyed',
          description:
            'The memorandum, the investor deck and the board paper are generated from the approved model. Change one assumption and all three move with it, so the numbers cannot drift apart between the documents a lender reads.',
        },
        {
          number: '04',
          title: 'Live until close',
          description:
            'The model stays open through the transaction, updated as diligence findings land and lender terms firm up, through to close. It is a working instrument, not a file delivered on signature.',
        },
      ],
    },
  },
  {
    order: 110,
    type: 'cta_block',
    what: 'Closing block: say and do what the rest of the site does, and ask once',
    patch: {
      cta_primary_label: 'Book a Meeting',
      cta_primary_href: '/book',
      cta_secondary_label: '',
      cta_secondary_href: '',
    },
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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function applyPatch(db, p) {
  console.log(`\n  ${p.order}  ${p.what}`);

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, content')
    .eq('page_slug', PAGE)
    .eq('section_type', p.type)
    .eq('display_order', p.order);
  if (error) throw new Error(`read failed at ${p.order}: ` + error.message);

  if (!rows || rows.length !== 1) {
    console.log(
      `    SKIP  expected one ${p.type} at display_order ${p.order}, found ${rows?.length ?? 0}.`,
    );
    return false;
  }

  const row = rows[0];
  const before = row.content ?? {};
  const changed = Object.keys(p.patch).filter((k) => !same(before[k], p.patch[k]));

  if (changed.length === 0) {
    console.log('    skip  already applied.');
    return true;
  }

  for (const k of changed) {
    const from = JSON.stringify(before[k] ?? null);
    const to = JSON.stringify(p.patch[k]);
    const trim = (s) => (s.length > 90 ? s.slice(0, 90) + '...' : s);
    console.log(`    ${k}`);
    console.log(`      from ${trim(from)}`);
    console.log(`      to   ${trim(to)}`);
  }

  if (DRY_RUN) return true;

  // Merge rather than replace, so media, styles and any other keys survive.
  const { error: upErr } = await db
    .from('page_sections')
    .update({ content: { ...before, ...p.patch }, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (upErr) throw new Error(`update failed at ${p.order}: ` + upErr.message);
  return true;
}

/** Counts the calls to action a reader is offered, section by section. */
async function ctaAudit(db) {
  const { data } = await db
    .from('page_sections')
    .select('display_order, section_type, content, visible')
    .eq('page_slug', PAGE)
    .eq('visible', true)
    .order('display_order');

  let total = 0;
  let offenders = 0;
  console.log('\n  Calls to action, per visible section:');
  for (const s of data ?? []) {
    const c = s.content ?? {};
    const labels = Object.keys(c)
      .filter((k) => /^(cta_primary_label|cta_secondary_label|cta_label|cta_secondary_label|footer_cta_label)$/.test(k))
      .map((k) => c[k])
      .filter((v) => typeof v === 'string' && v.trim());
    if (labels.length === 0) continue;
    total += labels.length;
    const isHero = s.section_type === 'hero';
    const over = !isHero && labels.length > 1;
    if (over) offenders++;
    console.log(
      `    ${String(s.display_order).padStart(3)}  ${s.section_type.padEnd(18)} ${labels.length}  ${labels.join(' | ')}${over ? '   OVER' : ''}`,
    );
  }
  console.log(`  ${total} in total across the page.`);
  return offenders;
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

  console.log('Home content pass');
  let allFound = true;
  for (const p of PATCHES) {
    const found = await applyPatch(db, p);
    if (!found) allFound = false;
  }

  if (DRY_RUN) {
    await ctaAudit(db);
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  let ok = allFound;

  const { data: sections } = await db
    .from('page_sections')
    .select('display_order, section_type, content')
    .eq('page_slug', PAGE)
    .order('display_order');
  const byOrder = new Map((sections ?? []).map((s) => [s.display_order, s.content ?? {}]));

  // 1. No count claimed over a list that does not support it.
  const whatWeDo = String(byOrder.get(45)?.subhead ?? '');
  if (/\b(nine|eight|seven|six|five|four|three|two)\s+disciplines\b/i.test(whatWeDo)) {
    console.error('  FAIL  the what-we-do subhead still claims a count.');
    ok = false;
  } else {
    console.log('  ok    the what-we-do subhead claims no count.');
  }

  // 2. The proof points say whose they are.
  const label = String(byOrder.get(80)?.credentials_label ?? '');
  if (label.trim()) {
    console.log(`  ok    the founder proof points are labelled: "${label.slice(0, 60)}..."`);
  } else {
    console.error('  FAIL  the founder proof points have no label.');
    ok = false;
  }

  // 3. The engagement model no longer reads as the default diagram.
  const steps = byOrder.get(70)?.steps ?? [];
  const titles = steps.map((s) => String(s?.title ?? ''));
  const generic = ['Understand', 'Analyse', 'Model', 'Advise'];
  if (titles.length !== 4) {
    console.error(`  FAIL  expected four steps, found ${titles.length}.`);
    ok = false;
  } else if (titles.some((t) => generic.includes(t))) {
    console.error(`  FAIL  the steps are still the generic set: ${titles.join(', ')}`);
    ok = false;
  } else {
    console.log(`  ok    four steps, none generic: ${titles.join(' / ')}`);
  }

  // 5. One label for the booking action.
  const closing = byOrder.get(110) ?? {};
  if (closing.cta_primary_label === 'Book a Meeting' && closing.cta_primary_href === '/book') {
    console.log('  ok    the closing block says Book a Meeting and points at /book.');
  } else {
    console.error(
      `  FAIL  the closing block is ${JSON.stringify(closing.cta_primary_label)} to ${JSON.stringify(closing.cta_primary_href)}.`,
    );
    ok = false;
  }

  // 4. At most one call to action per section, except the hero.
  const offenders = await ctaAudit(db);
  if (offenders === 0) {
    console.log('  ok    one call to action per section, two only in the hero.');
  } else {
    console.error(`  FAIL  ${offenders} section(s) still offer more than one.`);
    ok = false;
  }

  if (ok) {
    console.log('\nCOMPLETE.');
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('seed-home-content-pass failed:', err.message);
  process.exitCode = 1;
});
