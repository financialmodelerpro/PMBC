// scripts/seed-approach-page.mjs
// JS-side equivalent of supabase/migrations/016_seed_approach_page_content.sql.
// Replaces all page_sections rows for page_slug='approach' (the Phase 6 smoke
// process_steps + quote + cta_block) with the Phase 9 production content
// (5 sections, display_order 10..50). Safe to re-run; the DELETE + INSERT is
// idempotent.
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
// "Analyse" follows the British spelling used for the canonical methodology
// throughout the repo (CLAUDE.md, home page seed).
//
// Run: node scripts/seed-approach-page.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SECTIONS = [
  {
    display_order: 10,
    section_type: 'hero',
    content: {
      badge_text: 'OUR APPROACH',
      headline: 'How we engage.',
      subtitle:
        'Understand. Analyse. Model. Advise. Senior-led from the first call to the final recommendation, with no black-box deliverables and no junior pass-throughs.',
      cta_label: 'Start a Conversation',
      cta_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'process_steps',
    content: {
      eyebrow: 'THE ENGAGEMENT MODEL',
      heading: 'A four-step model, built around the decision you are making.',
      intro:
        'The same discipline applies whether the mandate is a valuation, a development model, or a full transaction. The output changes; the rigor does not.',
      steps: [
        {
          number: '01',
          title: 'Understand',
          description:
            'We begin with the decision the work must support and the audience it must convince: a board, a lender, a sponsor, or an investment committee. The mandate is scoped around that, not around a template.',
        },
        {
          number: '02',
          title: 'Analyse',
          description:
            'Commercial diligence, sector benchmarking, and a structural review of the transaction. We interrogate the inputs before we build, because a precise model on the wrong assumptions is just confident error.',
        },
        {
          number: '03',
          title: 'Model',
          description:
            'Lender-grade construction. Every assumption visible and sourced, every output traceable to its driver, every line defensible under scrutiny. No black boxes, no hidden plugs.',
        },
        {
          number: '04',
          title: 'Advise',
          description:
            'Clear recommendations, structuring options, and the capital-raising or transaction support to act on them, through to close. You get judgment, not just a file.',
        },
      ],
    },
  },
  {
    display_order: 30,
    section_type: 'text_image',
    content: {
      eyebrow: 'WHAT STAYS CONSTANT',
      heading: 'Senior judgment, start to finish.',
      body_html:
        '<p>Every engagement is led personally by the partner who scoped it. There are no junior pass-throughs and no black-box deliverables you cannot interrogate. If a number moves, you will know which assumption moved it.</p><p>Three things hold across every mandate: the model is built to be read, not just run; the assumptions are honest about risk, not tuned to flatter; and the advice is the advice we would act on with our own capital.</p>',
      image_url: '',
      image_alt: 'PaceMakers engagement principles',
      image_caption: '',
      image_position: 'left',
      cta_label: 'View our services',
      cta_href: '/services',
    },
  },
  {
    display_order: 40,
    section_type: 'quote',
    content: {
      quote_text:
        'We would rather tell you a deal does not work than hand you a model that says it does. Credibility is the only asset we cannot rebuild.',
      attribution_name: 'Ahmad Din',
      attribution_role: 'Founder, PaceMakers Business Consultants',
      attribution_photo_url: '',
      alignment: 'center',
    },
  },
  {
    display_order: 50,
    section_type: 'cta_block',
    content: {
      headline: 'Ready to put the approach to work?',
      subhead:
        'Bring us the mandate. We will walk you through exactly how we would scope, model, and advise on it before you commit to anything.',
      cta_primary_label: 'Start a Conversation',
      cta_primary_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding approach page sections');

  console.log('  Deleting existing approach page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'approach');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'approach',
    section_type: s.section_type,
    content: s.content,
    styles: {},
    display_order: s.display_order,
    visible: true,
  }));
  const { data: inserted, error: insErr } = await sb
    .from('page_sections')
    .insert(rows)
    .select('section_type, display_order');
  if (insErr) throw insErr;
  console.log(`  Inserted ${inserted?.length ?? 0} rows.`);

  console.log('  Bumping cms_pages.updated_at for approach...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'approach');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=approach)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'approach')
    .order('display_order', { ascending: true });
  if (verifyErr) throw verifyErr;
  for (const row of verify ?? []) {
    console.log(`  ${String(row.display_order).padStart(3, ' ')}  ${row.section_type}`);
  }
  console.log(`Total rows: ${verify?.length ?? 0}`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
