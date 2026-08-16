// scripts/seed-testimonial-sections.mjs
//
// Applies migration 073_place_testimonial_sections.sql through supabase-js.
//
//   node scripts/seed-testimonial-sections.mjs           apply
//   node scripts/seed-testimonial-sections.mjs --dry-run report only
//   npm run seed-testimonial-sections
//
// All three sections ship hidden, so nothing changes for a visitor. The
// submission form has a second lock as well: `testimonial_form_public` is
// absent, which reads as off, so making a form section visible still shows it
// to nobody until that switch is turned on under Testimonials.
//
// Idempotent: each page gets at most one of each type.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FORM_CONTENT = {
  eyebrow: 'In your words',
  heading: 'Share your experience',
  intro:
    'If we have worked together and you would be willing to say so publicly, we would be glad to hear it. Nothing you write appears anywhere until you have approved the wording and we have published it.',
  consent_label:
    'I agree that PaceMakers may publish this testimonial, with my name, role and company, on its website and in its materials.',
  button_label: 'Submit testimonial',
  success_message:
    'Thank you. Your testimonial has been received and will be reviewed before anything is published.',
};

const PLACEMENTS = [
  {
    page: 'contact',
    type: 'testimonial_form',
    order: 30,
    content: FORM_CONTENT,
    why: 'below the enquiry form',
  },
  {
    page: 'home',
    type: 'testimonials',
    order: 85,
    content: {
      eyebrow: 'In their words',
      heading: 'What clients say',
      only_landing: false,
      max_items: '2',
    },
    why: 'after the founder card, before the network line, capped at two',
  },
  {
    page: 'home',
    type: 'testimonial_form',
    order: 200,
    content: FORM_CONTENT,
    why: 'at the foot of the page',
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

  for (const p of PLACEMENTS) {
    const { data: existing, error } = await db
      .from('page_sections')
      .select('id, display_order, visible')
      .eq('page_slug', p.page)
      .eq('section_type', p.type);
    if (error) throw new Error(`read (${p.page}/${p.type}) failed: ` + error.message);

    if ((existing ?? []).length > 0) {
      console.log(`skip  ${p.page}/${p.type}: already present`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`would create ${p.page}/${p.type} at order ${p.order}, hidden (${p.why})`);
      continue;
    }
    const { error: insErr } = await db.from('page_sections').insert({
      page_slug: p.page,
      section_type: p.type,
      content: p.content,
      styles: {},
      display_order: p.order,
      visible: false,
    });
    if (insErr) throw new Error(`insert (${p.page}/${p.type}) failed: ` + insErr.message);
    console.log(`create ${p.page}/${p.type} at order ${p.order}, hidden (${p.why})`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  const failures = [];
  for (const p of PLACEMENTS) {
    const { data } = await db
      .from('page_sections')
      .select('id, display_order, visible')
      .eq('page_slug', p.page)
      .eq('section_type', p.type);
    if (!data || data.length !== 1) {
      failures.push(`${p.page}/${p.type}: ${data?.length ?? 0} row(s), expected 1`);
      continue;
    }
    if (data[0].visible) failures.push(`${p.page}/${p.type} is VISIBLE, it must ship hidden`);
  }

  // Ordering on home, which is the placement that had to be reasoned about.
  const { data: home } = await db
    .from('page_sections')
    .select('section_type, display_order')
    .eq('page_slug', 'home')
    .order('display_order', { ascending: true });
  const at = (t) => (home ?? []).findIndex((s) => s.section_type === t);
  const founder = at('founder_block');
  const quotes = at('testimonials');
  const form = at('testimonial_form');
  if (founder !== -1 && quotes !== -1 && quotes < founder) {
    failures.push('home: the quotes sort above the founder card');
  }
  if (quotes !== -1 && form !== -1 && form < quotes) {
    failures.push('home: the submission form sorts above the quotes');
  }
  console.log(
    '  home order: ' + (home ?? []).map((s) => `${s.display_order} ${s.section_type}`).join(' | '),
  );

  // The switch must still be off, or these would not be as invisible as they look.
  const { data: settings } = await db.from('site_settings').select('settings').eq('id', 1).single();
  if (settings?.settings?.testimonial_form_public === true) {
    console.log('  note the public form switch is ON, so any visible form section renders');
  } else {
    console.log('  ok   the public form switch is off, so no form renders even if unhidden');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  All checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-testimonial-sections failed:', err.message);
  process.exitCode = 1;
});
