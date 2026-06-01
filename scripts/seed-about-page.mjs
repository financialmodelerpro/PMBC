// scripts/seed-about-page.mjs
// JS-side equivalent of supabase/migrations/014_seed_about_page_content.sql.
// Replaces all page_sections rows for page_slug='about' (including the Phase 6
// smoke-seed founder_block + text_image) with the Phase 9 production content
// (7 sections, display_order 10..70). Safe to re-run; the DELETE + INSERT is
// idempotent.
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
// Facts are grounded in content already established in the repo (home page
// founder block, OrganizationJsonLd founding date, network seed); the full
// professional bio is linked out to Financial Modeler Pro rather than
// duplicated here.
//
// Run: node scripts/seed-about-page.mjs

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
      badge_text: 'ABOUT PACEMAKERS',
      headline: 'A boutique built around senior judgment.',
      subtitle:
        'PaceMakers Business Consultants is a corporate finance and transaction advisory firm serving family offices, investors, and developers across Saudi Arabia, the GCC, and worldwide. Founded in 2017, we run deliberately small, so the partner who wins the mandate is the partner who delivers it.',
      cta_label: 'Start a Conversation',
      cta_href: '/contact',
      cta_secondary_label: 'Our Approach',
      cta_secondary_href: '/approach',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'text_image',
    content: {
      eyebrow: 'THE FIRM',
      heading: 'A boutique by design.',
      body_html:
        '<p>PaceMakers is deliberately small. Every engagement is led by a senior who has personally underwritten transactions on the buy-side, the sell-side, and the lender-side. We do not run a leverage model where the work cascades to first-year analysts once the engagement letter is signed.</p><p>That structure is a choice, not a limitation. It lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee. The result is work that holds up under scrutiny, and clients who come back.</p>',
      image_url: '',
      image_alt: 'PaceMakers Business Consultants',
      image_caption: '',
      image_position: 'right',
      cta_label: 'See how we work',
      cta_href: '/approach',
    },
  },
  {
    display_order: 30,
    section_type: 'stats_block',
    content: {
      intro:
        'A track record built on institutional discipline, across real estate, energy, infrastructure, and industrial mandates.',
      stats: [
        { value: '100+', label: 'Valuations Delivered' },
        { value: 'SAR 20B+', label: 'Real Estate NAV Modeled' },
        { value: 'SAR 300M+', label: 'Capital Deployed via Equity Research' },
        { value: '9+', label: 'Industries Covered' },
      ],
    },
  },
  {
    display_order: 40,
    section_type: 'founder_block',
    content: {
      eyebrow: 'THE FOUNDER',
      headline: 'Led by Ahmad Din.',
      name: 'Ahmad Din',
      credentials_line: 'ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
      photo_url: '',
      bio_html:
        "<p>Ahmad founded PaceMakers to bring senior, analytically grounded advisory to the mandates that larger firms either skip or under-staff. Over twelve years in corporate finance, his work has spanned multi-billion riyal real estate portfolios, ACWA Power's Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects, alongside transactions in biofuel, oil and gas, waste management, data centers, construction, and industrial services across Saudi Arabia and the GCC.</p><p>He is an ACCA Member (UK) and FMVA-certified, and he leads the financial structuring, modeling, valuation, and advisory work on every PaceMakers engagement personally. For the full professional bio, including platforms, prior firms, and selected mandates, see his page on Financial Modeler Pro.</p>",
      cta_primary_label: 'Full bio on Financial Modeler Pro',
      cta_primary_href: 'https://www.financialmodelerpro.com/about/ahmad-din',
      cta_secondary_label: 'Start a Conversation',
      cta_secondary_href: '/contact',
      layout: 'image_left',
    },
  },
  {
    display_order: 50,
    section_type: 'quote',
    content: {
      quote_text:
        'Capital allocators do not buy headcount. They buy judgment, the kind that comes from having sat on every side of the table. That is what we offer, and it is the only thing we offer.',
      attribution_name: 'Ahmad Din',
      attribution_role: 'Founder, PaceMakers Business Consultants',
      attribution_photo_url: '',
      alignment: 'center',
    },
  },
  {
    display_order: 60,
    section_type: 'text_image',
    content: {
      eyebrow: 'REACH WITHOUT THE OVERHEAD',
      heading: 'Boutique focus, regional presence.',
      body_html:
        '<p>A boutique does not have to mean a narrow one. PaceMakers is supported by a focused network across the Gulf. Sky Gulf, headquartered in Al Khobar, brings industrial and project-execution depth in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in the firm, provides Bahrain market access and capital-markets insight.</p><p>The combination gives clients a senior bench with regional reach, without the cost structure of a tier-one firm.</p>',
      image_url: '',
      image_alt: 'PaceMakers strategic network across the GCC',
      image_caption: '',
      image_position: 'left',
      cta_label: 'Meet the network',
      cta_href: '/network',
    },
  },
  {
    display_order: 70,
    section_type: 'cta_block',
    content: {
      headline: 'Have a mandate to discuss?',
      subhead:
        'Whether you are raising capital, evaluating an acquisition, structuring a development, or preparing for an exit, we would be glad to have a conversation.',
      cta_primary_label: 'Start a Conversation',
      cta_primary_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding about page sections');

  console.log('  Deleting existing about page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'about');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'about',
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

  console.log('  Bumping cms_pages.updated_at for about...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'about');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=about)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'about')
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
