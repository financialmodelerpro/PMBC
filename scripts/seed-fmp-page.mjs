// scripts/seed-fmp-page.mjs
// JS-side equivalent of supabase/migrations/018_seed_fmp_page_content.sql.
// Replaces all page_sections rows for page_slug='financial-modeler-pro' (the
// Phase 6 smoke fmp_intro) with the Phase 9 production content (4 sections,
// display_order 10..40). Safe to re-run; the DELETE + INSERT is idempotent.
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
// Per the cross-property rule (CLAUDE.md §13), the page introduces FMP and the
// primary CTAs link to https://www.financialmodelerpro.com.
//
// Run: node scripts/seed-fmp-page.mjs

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

const FMP_URL = 'https://www.financialmodelerpro.com';

const SECTIONS = [
  {
    display_order: 10,
    section_type: 'hero',
    content: {
      badge_text: 'FINANCIAL MODELER PRO',
      headline: 'The platform built by practitioners.',
      subtitle:
        "Financial Modeler Pro is PaceMakers' flagship platform: a learning environment, model library, and analyst toolkit built from the same engagement experience that drives the advisory practice.",
      cta_label: 'Visit Financial Modeler Pro',
      cta_href: FMP_URL,
      cta_secondary_label: 'About PaceMakers',
      cta_secondary_href: '/about',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'fmp_intro',
    content: {
      heading: 'Institutional modeling, made learnable.',
      description_html:
        '<p>The advisory practice produces a steady stream of models, methods, and hard-won lessons. Financial Modeler Pro is where that knowledge is turned into something others can use: templates, structured learning, and tools built to the same standard we apply on live mandates.</p>',
      feature_points: [
        'Institutional-grade model templates',
        'Structured learning tracks for analysts',
        'Real, engagement-derived case studies',
        'Built and maintained by working practitioners',
      ],
      cta_label: 'Visit Financial Modeler Pro',
      cta_href: FMP_URL,
      logo_url: '',
    },
  },
  {
    display_order: 30,
    section_type: 'text_image',
    content: {
      eyebrow: 'THE RELATIONSHIP',
      heading: 'One firm, two ways to work with us.',
      body_html:
        '<p>PaceMakers is the advisory practice: senior-led mandates in corporate finance, valuation, and transactions. Financial Modeler Pro is the platform: the templates, training, and tools that come out of that work, made available to a wider audience of analysts and teams.</p><p>If you want the work done for you, that is PaceMakers. If you want to build the capability in-house, that is Financial Modeler Pro. The standard behind both is the same.</p>',
      image_url: '',
      image_alt: 'Financial Modeler Pro, the PaceMakers platform',
      image_caption: '',
      image_position: 'left',
      cta_label: 'Explore the platform',
      cta_href: FMP_URL,
    },
  },
  {
    display_order: 40,
    section_type: 'cta_block',
    content: {
      headline: 'See what the platform can do.',
      subhead:
        'Financial Modeler Pro puts institutional-grade modeling within reach. Explore the templates, the learning tracks, and the toolkit.',
      cta_primary_label: 'Visit Financial Modeler Pro',
      cta_primary_href: FMP_URL,
      cta_secondary_label: 'Talk to PaceMakers',
      cta_secondary_href: '/contact',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding financial-modeler-pro page sections');

  console.log('  Deleting existing financial-modeler-pro page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'financial-modeler-pro');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'financial-modeler-pro',
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

  console.log('  Bumping cms_pages.updated_at for financial-modeler-pro...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'financial-modeler-pro');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=financial-modeler-pro)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'financial-modeler-pro')
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
