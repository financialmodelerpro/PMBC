// scripts/seed-fmp-parent-page.mjs
//
// Applies migration 048_fmp_parent_page.sql through supabase-js.
//
// Rebuilds /financial-modeler-pro as a nine section overview of PMBC's platform
// arm, replacing four sections that restated "FMP exists and PMBC built it"
// three different ways without ever saying what the platform does.
//
// The copy here is PMBC's own and is authored in the CMS like any other page.
// Only the three sub-pages under /financial-modeler-pro fetch from FMP.
//
//   node scripts/seed-fmp-parent-page.mjs           apply
//   node scripts/seed-fmp-parent-page.mjs --dry-run report only
//   npm run seed-fmp-parent-page
//
// Idempotent in the sense that it cannot duplicate rows: it deletes this page's
// sections and reinserts. That also means a re-run RESTORES this copy over
// later edits to this page, the same caveat migration 034 carries. Nothing
// outside this one page is touched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 'financial-modeler-pro';

const SECTIONS = [
  {
    order: 10,
    type: 'hero',
    content: {
      badge_text: 'THE PLATFORM ARM',
      headline: 'Financial Modeler Pro',
      subtitle:
        'The software and training arm of PaceMakers Business Consultants. The same modeling discipline we bring to a mandate, built into a platform that anyone can use.',
      cta_label: 'Explore the Modeling Hub',
      cta_href: '/financial-modeler-pro/modeling-hub',
      cta_secondary_label: 'Visit the platform',
      cta_secondary_href: 'https://www.financialmodelerpro.com',
    },
  },
  {
    order: 20,
    type: 'paragraphs',
    content: {
      heading: 'Why it exists.',
      align: 'left',
      html:
        "<p>Advisory work does not scale. A mandate takes the partner's time, and the firm takes on a limited number each year by design. That leaves a large number of people who need the same analytical rigor and will never be a PaceMakers client: an analyst at a developer, a family office reviewing its own numbers, a founder preparing for a first institutional round.</p>" +
        '<p>Financial Modeler Pro exists for them. It takes the frameworks the firm uses on live transactions and makes them usable directly, as structured tools rather than as a consulting engagement. The distinction matters: it is not a course about modeling and it is not a template library. It is the working method, made operable.</p>',
    },
  },
  {
    order: 30,
    type: 'service_cards',
    content: {
      eyebrow: 'WHAT IS ON THE PLATFORM',
      headline: 'Three areas, one standard of work.',
      intro: 'Each has its own page here, with the current detail read live from the platform.',
      cards: [
        {
          number: '01',
          title: 'Modeling Hub',
          description:
            'The core of the platform. Guided modeling workflows for valuation, project finance, leveraged transactions and FP and A, each producing a formula-linked Excel workbook and a presentation-ready PDF.',
          link: '/financial-modeler-pro/modeling-hub',
        },
        {
          number: '02',
          title: 'Real Estate Financial Modeling',
          description:
            'Development feasibility for multi-asset projects, from land acquisition and construction draws through financing structures to investor returns and exit.',
          link: '/financial-modeler-pro/refm',
        },
        {
          number: '03',
          title: 'Training Hub',
          description:
            'Assessed certification for financial modeling, with verifiable certificates. Free, and built on the same material as the rest of the platform.',
          link: '/financial-modeler-pro/training-hub',
        },
      ],
    },
  },
  {
    order: 40,
    type: 'paragraphs',
    content: {
      heading: 'The Modeling Hub is the platform.',
      align: 'left',
      html:
        '<p>Everything else on Financial Modeler Pro supports the Modeling Hub. It replaces the blank spreadsheet with a structured workflow: the model is built module by module, each assumption is flagged where it is made, and every calculation stays traceable to the input that drives it.</p>' +
        '<p>What comes out is the part that usually costs the most time. A fully formula-linked Excel workbook that can be taken apart and rebuilt, and a clean PDF that can go to a lender or an investment committee without reformatting. Most of the effort in a modeling exercise is not the analysis. It is the presentation of the analysis, and that is the part the Hub removes.</p>' +
        '<p><a href="/financial-modeler-pro/modeling-hub">See what the Modeling Hub covers</a>.</p>',
    },
  },
  {
    order: 50,
    type: 'paragraphs',
    content: {
      heading: 'Real estate, modeled properly.',
      align: 'left',
      html:
        "<p>Real Estate Financial Modeling is the platform's deepest single discipline, and the one closest to the firm's own mandate history. It handles what a general-purpose model cannot: a phased development with a mixed unit programme, construction drawn down against a facility with interest capitalised during the build, revenue arriving on instalment terms across residential, hospitality and retail at once, and an equity waterfall that has to survive a lender's review.</p>" +
        "<p>It is the reason the firm's real estate work is called Real Estate Financial Modeling rather than real estate modeling. The financial structure is the hard part.</p>" +
        '<p><a href="/financial-modeler-pro/refm">See the REFM platform</a>.</p>',
    },
  },
  {
    order: 60,
    type: 'paragraphs',
    content: {
      heading: 'Training, for the people who will do the work.',
      align: 'left',
      html:
        '<p>The Training Hub certifies financial modeling competence through assessed sessions rather than attendance. It is free, and it stays free. It exists because the firm would rather the analysts it works across the table from were good at this.</p>' +
        '<p><a href="/financial-modeler-pro/training-hub">See the Training Hub</a>.</p>',
    },
  },
  {
    order: 70,
    type: 'founder_credentials',
    content: {
      heading: 'Who it is built for',
      intro: 'The platform assumes a working knowledge of finance and no patience for a course.',
      display: 'cards',
      items: [
        'Analysts and associates at developers, investors and advisory firms',
        'Family offices reviewing their own holdings rather than outsourcing the review',
        'Founders and CFOs preparing for a raise, a facility or a board',
        "Lenders and credit teams testing a sponsor's numbers",
        'Students and career changers moving into corporate finance',
      ],
    },
  },
  {
    order: 80,
    type: 'paragraphs',
    content: {
      heading: 'How it connects to the advisory practice.',
      align: 'left',
      html:
        '<p>The two are one firm, and the traffic runs both ways. The platform is built from advisory work: every module reflects how a transaction was actually structured, not how a textbook says it should be. When a mandate turns up a structure the tools handle badly, the tools change.</p>' +
        '<p>In the other direction, the platform is often where a client relationship starts. Someone uses the Hub, reaches the point where the question stops being a modeling question and becomes a judgment question, and gets in touch. That is the right order. Software is good at method. It is not good at telling you whether a deal is worth doing.</p>' +
        '<p>PaceMakers takes the mandates. Financial Modeler Pro takes everything that does not need a mandate. <a href="/contact">Speak to the firm</a> if the question has moved past the model.</p>',
    },
  },
  {
    order: 90,
    type: 'cta_block',
    content: {
      eyebrow: 'THE PLATFORM',
      headline: 'Use the platform.',
      subhead:
        'Registration is free and the Modeling Hub is open. No mandate, no engagement letter, no call required.',
      cta_primary_label: 'Go to Financial Modeler Pro',
      cta_primary_href: 'https://www.financialmodelerpro.com',
      cta_secondary_label: 'Speak to the firm',
      cta_secondary_href: '/contact',
    },
  },
];

const META = {
  meta_title: 'Financial Modeler Pro | PaceMakers Business Consultants',
  meta_description:
    'Financial Modeler Pro is the platform arm of PaceMakers Business Consultants: guided financial modeling workflows, real estate development feasibility, and free assessed certification.',
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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing, error: readErr } = await db
    .from('page_sections')
    .select('id, section_type, display_order')
    .eq('page_slug', PAGE)
    .order('display_order');
  if (readErr) throw new Error('read: ' + readErr.message);

  console.log(`=== ${PAGE} ===`);
  console.log(`  current: ${(existing ?? []).map((r) => r.section_type).join(', ') || 'none'}`);
  console.log(`  target:  ${SECTIONS.map((s) => s.type).join(', ')}`);

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. Would replace ${existing?.length ?? 0} section(s) with ${SECTIONS.length}.`);
    return;
  }

  const { error: delErr } = await db.from('page_sections').delete().eq('page_slug', PAGE);
  if (delErr) throw new Error('delete: ' + delErr.message);

  const rows = SECTIONS.map((s) => ({
    page_slug: PAGE,
    section_type: s.type,
    content: s.content,
    styles: {},
    display_order: s.order,
    visible: true,
  }));
  const { error: insErr } = await db.from('page_sections').insert(rows);
  if (insErr) throw new Error('insert: ' + insErr.message);

  const { error: metaErr } = await db
    .from('cms_pages')
    .update({ ...META, updated_at: new Date().toISOString() })
    .eq('slug', PAGE);
  if (metaErr) throw new Error('meta: ' + metaErr.message);

  console.log('\nVerifying...');
  const failures = [];
  const { data: after } = await db
    .from('page_sections')
    .select('section_type, display_order, content')
    .eq('page_slug', PAGE)
    .order('display_order');

  console.log('  ' + (after ?? []).map((r) => `${r.display_order} ${r.section_type}`).join(' | '));
  if ((after ?? []).length !== SECTIONS.length) {
    failures.push(`expected ${SECTIONS.length} sections, found ${after?.length ?? 0}`);
  }

  // The three sub-pages must be reachable from this page, which is the whole
  // point of the cards block.
  const blob = JSON.stringify(after ?? []);
  for (const sub of ['modeling-hub', 'refm', 'training-hub']) {
    if (!blob.includes(`/financial-modeler-pro/${sub}`)) {
      failures.push(`no link to /financial-modeler-pro/${sub}`);
    }
  }
  if (!blob.includes('https://www.financialmodelerpro.com')) {
    failures.push('no CTA out to financialmodelerpro.com');
  }
  // Escaped rather than literal, so this detector does not trip the repo-wide gate.
  if (/[\u2013\u2014]/.test(blob)) {
    failures.push('em or en dash in the seeded copy');
  }

  const { data: page } = await db
    .from('cms_pages')
    .select('meta_title, meta_description')
    .eq('slug', PAGE)
    .maybeSingle();
  if (page?.meta_description !== META.meta_description) failures.push('meta_description not applied');

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  applied and verified. COMPLETE');
}

main().catch((err) => {
  console.error('seed-fmp-parent-page failed:', err.message);
  process.exitCode = 1;
});
