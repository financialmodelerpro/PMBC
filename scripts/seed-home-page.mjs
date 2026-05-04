// scripts/seed-home-page.mjs
// JS-side equivalent of supabase/migrations/011_seed_home_page_content.sql.
// Replaces all page_sections rows for page_slug='home' with the Phase 9
// production content (9 sections, display_order 10..90), then merges
// site_settings with the real contact details. Safe to re-run; the DELETE
// + INSERT is idempotent.
//
// Run: node scripts/seed-home-page.mjs

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
      badge_text: 'PACEMAKERS BUSINESS CONSULTANTS',
      headline: 'Advisory from Structure to Exit',
      subtitle:
        'Senior-led corporate finance, valuation, and transaction advisory for family offices, investors, and developers across Saudi Arabia and the GCC.',
      cta_label: 'Start a Conversation',
      cta_href: '/contact',
      cta_secondary_label: 'View Services',
      cta_secondary_href: '/services',
      background_style: 'light',
    },
  },
  {
    display_order: 20,
    section_type: 'founder_block',
    content: {
      eyebrow: 'LED BY THE FOUNDER',
      headline: 'Every mandate is led personally by Ahmad Din.',
      name: 'Ahmad Din',
      credentials_line: 'ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
      photo_url: '',
      bio_html:
        "<p>At most boutique firms, the founder closes the engagement and hands the work to a junior team. PaceMakers operates differently. When you engage us, Ahmad leads the financial structuring, modeling, valuation, and advisory work directly, drawing on twelve years of experience on mandates including multi-billion riyal real estate portfolios, ACWA Power's Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects.</p><p>This is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, every recommendation.</p>",
      cta_primary_label: 'About Ahmad',
      cta_primary_href: '/about',
      cta_secondary_label: '',
      cta_secondary_href: '',
      layout: 'image_left',
    },
  },
  {
    display_order: 30,
    section_type: 'stats_block',
    content: {
      intro: 'A track record built on institutional discipline.',
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
    section_type: 'service_cards',
    content: {
      eyebrow: 'WHAT WE DO',
      headline: 'Built for transactions that need to hold up under scrutiny.',
      intro:
        'Six core capabilities, applied to the moments that matter most: capital raises, acquisitions, structuring decisions, and exits. Each engagement is led by Ahmad and built on lender-grade modeling discipline.',
      cards: [
        {
          number: '01',
          title: 'Financial Modeling',
          description:
            'Lender-grade operating, valuation, and project finance models. IRR, DSCR, debt sizing, and debt sculpting built to institutional standard.',
          link: '/services/financial-modeling',
        },
        {
          number: '02',
          title: 'Business Valuation',
          description:
            'Independent valuations using DCF, trading comparables, and transaction multiples for fundraising, M&A, joint ventures, and shareholder transactions.',
          link: '/services/business-valuation',
        },
        {
          number: '03',
          title: 'M&A Advisory',
          description:
            'Buy-side and sell-side support: target screening, structuring, valuation, negotiation support, and integration analysis through to close.',
          link: '/services/mergers-acquisitions',
        },
        {
          number: '04',
          title: 'Real Estate Modeling',
          description:
            'Mixed-use development modeling: phased construction, installment-based revenue, debt waterfalls, IRR optimization, and DSCR-compliant lender models.',
          link: '/services/real-estate-modeling',
        },
        {
          number: '05',
          title: 'Project Finance',
          description:
            'Tariff calculation, debt sizing, debt sculpting, and CFADS modeling for energy, infrastructure, and PPP transactions.',
          link: '/services/project-finance',
        },
        {
          number: '06',
          title: 'Investment Memorandums',
          description:
            'Investor-ready pitch decks, business plans, and information memorandums. The documentation capital actually closes on.',
          link: '/services/investment-memorandums',
        },
      ],
      footer_cta_label: 'View all services',
      footer_cta_href: '/services',
    },
  },
  {
    display_order: 50,
    section_type: 'service_cards',
    content: {
      eyebrow: 'WHO WE SERVE',
      headline: 'Capital allocators who buy advisory on judgment, not headcount.',
      cards: [
        {
          number: '',
          title: 'Family Offices',
          description:
            'Investment structuring, opportunity evaluation, and portfolio-level financial analysis for single-family and multi-family offices in KSA and the GCC.',
          link: '',
        },
        {
          number: '',
          title: 'Investment Offices',
          description:
            'Deal-level modeling, valuation, and due diligence support, supplementing in-house teams on selective mandates.',
          link: '',
        },
        {
          number: '',
          title: 'Real Estate Developers',
          description:
            'Feasibility, mixed-use modeling, lender-grade financial structuring, and capital-raising support across residential, commercial, and hospitality.',
          link: '',
        },
        {
          number: '',
          title: 'Corporates & Sponsors',
          description:
            'M&A, valuation, project finance, and investor documentation for strategic transactions and capital events.',
          link: '',
        },
      ],
    },
  },
  {
    display_order: 60,
    section_type: 'process_steps',
    content: {
      eyebrow: 'HOW WE WORK',
      heading: 'A four-step engagement model, built around clarity.',
      steps: [
        {
          number: '01',
          title: 'Understand',
          description:
            'We start by understanding the mandate, the decision it must support, and the audience the output must convince: board, lender, sponsor, or investor.',
        },
        {
          number: '02',
          title: 'Analyse',
          description:
            "Commercial diligence, sector benchmarking, and structural review. Numbers don't exist in a vacuum; we make sure the inputs reflect reality.",
        },
        {
          number: '03',
          title: 'Model',
          description:
            'Lender-grade construction. Every assumption visible, every output traceable, every line defensible under scrutiny.',
        },
        {
          number: '04',
          title: 'Advise',
          description:
            'Recommendations, structuring options, and capital-raising or transaction support, through to close.',
        },
      ],
      footer_cta_label: 'Read more about our approach',
      footer_cta_href: '/approach',
    },
  },
  {
    display_order: 70,
    section_type: 'text_image',
    content: {
      eyebrow: 'STRATEGIC NETWORK',
      heading: 'A focused network across the Gulf.',
      body_html:
        '<p>PaceMakers is supported by two long-standing relationships that extend our reach across the GCC. Sky Gulf, headquartered in Al Khobar, brings industrial and project execution depth in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in PaceMakers, provides Bahrain market access and capital-markets insight.</p><p>Together, the network gives clients a senior bench with regional presence, without the overhead of a tier-one firm.</p>',
      image_url: '',
      image_alt: 'PaceMakers strategic network across the GCC',
      image_position: 'right',
      cta_label: 'Meet the network',
      cta_href: '/network',
    },
  },
  {
    display_order: 80,
    section_type: 'quote',
    content: {
      quote_text:
        "A good financial model is not just a calculation. It's a communication tool. Every assumption should be visible, every output should be traceable, and the final product should be something you'd be proud to present to a board or an investor committee without reformatting.",
      attribution_name: 'Ahmad Din',
      attribution_role: 'Founder, PaceMakers Business Consultants',
      attribution_photo_url: '',
      alignment: 'center',
    },
  },
  {
    display_order: 90,
    section_type: 'cta_block',
    content: {
      headline: 'Have a mandate to discuss?',
      subhead:
        "Whether you're raising capital, evaluating an acquisition, structuring a development, or preparing for an exit, we'd be glad to have a conversation.",
      cta_primary_label: 'Start a Conversation',
      cta_primary_href: '/contact',
      cta_secondary_label: 'Email Ahmad Directly',
      cta_secondary_href: 'mailto:info@pacemakersglobal.com',
      background_style: 'dark',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding home page sections + site_settings');

  console.log('  Deleting existing home page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'home');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new sections...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'home',
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

  console.log('  Bumping cms_pages.updated_at for home...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'home');
  if (pageErr) throw pageErr;

  console.log('  Updating site_settings...');
  const { data: existing, error: settingsReadErr } = await sb
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  if (settingsReadErr) throw settingsReadErr;
  const merged = {
    ...(existing?.settings ?? {}),
    contact_email: 'info@pacemakersglobal.com',
    admin_email: 'meetahmadch@gmail.com',
    office_location_text: 'Lahore, Pakistan · Riyadh, KSA',
  };
  const { error: settingsErr } = await sb
    .from('site_settings')
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (settingsErr) throw settingsErr;

  console.log('\nVerifying page_sections (page_slug=home)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'home')
    .order('display_order', { ascending: true });
  if (verifyErr) throw verifyErr;
  for (const row of verify ?? []) {
    console.log(`  ${String(row.display_order).padStart(3, ' ')}  ${row.section_type}`);
  }
  console.log(`Total rows: ${verify?.length ?? 0}`);

  console.log('\nVerifying site_settings...');
  const { data: settingsAfter } = await sb
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  console.log('  contact_email:        ', settingsAfter?.settings?.contact_email);
  console.log('  admin_email:          ', settingsAfter?.settings?.admin_email);
  console.log('  office_location_text: ', settingsAfter?.settings?.office_location_text);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
