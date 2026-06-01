// scripts/seed-sectors-page.mjs
// JS-side equivalent of supabase/migrations/015_seed_sectors_page_content.sql.
// Replaces all page_sections rows for page_slug='sectors' (the Phase 6 smoke
// sector_grid) with the Phase 9 production content (4 sections, display_order
// 10..40). Safe to re-run; the DELETE + INSERT is idempotent.
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
// The nine sectors map to PMBC's established track record (CLAUDE.md §15 reminder
// #3: real estate, energy incl. biofuel, oil & gas, waste management, data
// centers, construction, industrial services), plus the family-office audience
// the firm explicitly serves. icon_name values are keys from
// src/lib/cms/sectorIcons.tsx.
//
// Run: node scripts/seed-sectors-page.mjs

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
      badge_text: 'SECTOR COVERAGE',
      headline: 'Sectors we know from the inside.',
      subtitle:
        'We do not cover every industry. We cover the ones where we have modeled the assets, valued the deals, and structured the capital, across Saudi Arabia, the GCC, and worldwide mandates.',
      cta_label: 'Discuss Your Sector',
      cta_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'sector_grid',
    content: {
      eyebrow: 'WHERE WE WORK',
      heading: 'Nine sectors, underwritten firsthand.',
      intro:
        'Each represents mandates we have delivered, not a capability statement. The depth comes from having sat with the numbers, the lenders, and the operators in each.',
      sectors: [
        {
          icon_name: 'building2',
          title: 'Real Estate & Development',
          description:
            'Mixed-use, residential, commercial, and hospitality developments. Feasibility, phased construction modeling, debt waterfalls, and lender-grade structuring. Over SAR 20 billion in real estate NAV modeled.',
        },
        {
          icon_name: 'zap',
          title: 'Energy & Renewables',
          description:
            "Power, renewable infrastructure, and biofuel projects. Tariff calculation, debt sizing, debt sculpting, and CFADS modeling, including ACWA Power's Central Asia renewable portfolio.",
        },
        {
          icon_name: 'droplet',
          title: 'Oil & Gas',
          description:
            'Upstream and downstream mandates, including Saudi Aramco-backed industrial projects. Valuation, project finance, and transaction support.',
        },
        {
          icon_name: 'wrench',
          title: 'Industrial Services',
          description:
            'Service businesses across the industrial value chain. Valuation, M&A, and CFO-level financial structuring for owners and acquirers.',
        },
        {
          icon_name: 'hammer',
          title: 'Construction & Contracting',
          description:
            'Contractors and developers. Project feasibility, working-capital modeling, and capital-raising support for build programs.',
        },
        {
          icon_name: 'server',
          title: 'Data Centers & Digital Infrastructure',
          description:
            'Hyperscale and colocation assets. Demand modeling, capital structuring, and valuation for a fast-moving asset class.',
        },
        {
          icon_name: 'trees',
          title: 'Waste Management & Environment',
          description:
            'Waste, recycling, and environmental services. Valuation and transaction advisory for an increasingly institutional sector.',
        },
        {
          icon_name: 'factory',
          title: 'Manufacturing & Heavy Industry',
          description:
            'Plants, processing, and heavy industry. Independent valuation, due diligence support, and acquisition modeling.',
        },
        {
          icon_name: 'banknote',
          title: 'Family Offices & Private Capital',
          description:
            'Single-family and multi-family offices. Opportunity evaluation, portfolio-level analysis, and investment structuring across asset classes.',
        },
      ],
    },
  },
  {
    display_order: 30,
    section_type: 'text_image',
    content: {
      eyebrow: 'WHY IT MATTERS',
      heading: 'Sector fluency changes the model.',
      body_html:
        '<p>A discount rate, a construction schedule, a tariff curve, an offtake assumption: each carries sector-specific judgment that a generalist model quietly gets wrong. We build from the assumptions that actually drive value in your industry, then pressure-test them against how the deal will be read by a board, a lender, or an investment committee.</p><p>That is the difference between a model that calculates and a model that convinces.</p>',
      image_url: '',
      image_alt: 'Sector-specific financial modeling at PaceMakers',
      image_caption: '',
      image_position: 'right',
      cta_label: 'How we work',
      cta_href: '/approach',
    },
  },
  {
    display_order: 40,
    section_type: 'cta_block',
    content: {
      headline: 'Working on a mandate in one of these sectors?',
      subhead:
        'Tell us about the asset or the transaction. We will tell you candidly whether it is a fit for our bench.',
      cta_primary_label: 'Start a Conversation',
      cta_primary_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding sectors page sections');

  console.log('  Deleting existing sectors page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'sectors');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'sectors',
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

  console.log('  Bumping cms_pages.updated_at for sectors...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'sectors');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=sectors)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'sectors')
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
