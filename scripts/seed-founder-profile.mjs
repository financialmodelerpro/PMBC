// scripts/seed-founder-profile.mjs
//
// Applies migration 034_seed_founder_profile.sql through supabase-js.
//
// The migration file is the record; this is the executable. supabase-js cannot
// run raw SQL, and there is no direct Postgres connection string in .env.local,
// so content seeds are paired this way (same pattern as migrations 014 to 020).
// Keep the two in sync: if you change the copy here, change it there.
//
//   node scripts/seed-founder-profile.mjs
//   npm run seed-founder-profile
//
// Idempotent: the page is upserted on slug, and this page's sections are
// deleted and reinserted, so re-running cannot duplicate rows.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const PAGE_SLUG = 'about-ahmad-din';

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

const BACKGROUND_HTML = [
  '<p>Ahmad Din is a Corporate Finance and Transaction Advisory Specialist with over 12 years of experience advising sponsors, investment groups, and operating companies across Saudi Arabia, the GCC, and Pakistan.</p>',
  '<p>As Senior Manager of Corporate Finance at Synergistic Financial Advisors, Ahmad serves as lead financial advisor to Dallah Investment (KSA), one of the Kingdom&rsquo;s prominent investment groups. He has led the financial structuring, modeling, and evaluation of multi-billion riyal mixed-use real estate developments across the Dallah portfolio, projects spanning residential towers, commercial districts, hospitality components, and retail destinations. His work integrates phased development planning, installment-based revenue structures, construction cash flow management, debt waterfalls, IRR optimization, and DSCR-compliant lender modeling to support capital raising, joint venture structuring, and disciplined capital deployment across Dallah&rsquo;s multi-asset real estate portfolio.</p>',
  '<p>His renewable energy and infrastructure work includes building comprehensive FP&amp;A operating models for ACWA Power&rsquo;s Central Asia region projects (solar and wind), automating monthly reporting cycles including forecast-year financials, construction cash flows, budget vs. actual variance analysis, IRR tracking, DSCR monitoring, and CFADS calculations. He brings deep expertise in tariff calculation, debt sizing, and debt sculpting for project finance structures across energy and infrastructure sectors. Ahmad has also developed PPP bid frameworks for electric bus fleet projects submitted to the Government of Punjab and Government of Sindh, incorporating Capex structuring, tariff modeling, subsidy analysis, and lifecycle cost economics. In KSA, he independently structured the financial model and feasibility framework for a greenfield biofuel plant, securing project financing from Wa&rsquo;ed, the entrepreneurship arm of Saudi Aramco.</p>',
  '<p>Beyond real estate, energy, and infrastructure, Ahmad has delivered financial due diligence engagements, business valuations (DCF, trading comparables, transaction multiples), and full investment documentation, including feasibility studies, business plans, investment memorandums, and investor pitch decks, across hospitality, healthcare, education, fintech, and industrial sectors to support fundraising, M&amp;A, and exit strategies.</p>',
  '<p>He has trained and mentored over 35 professionals in financial modeling and valuation throughout his career, strengthening advisory capabilities across client mandates.</p>',
  '<p>In 2017, Ahmad established PaceMakers Business Consultants as a sole proprietorship, which he grew and restructured as a Limited Liability Partnership (LLP) in 2023, registered under SECP Section 7 of the LLP Act, 2017. Financial Modeler Pro is the flagship platform of PaceMakers Business Consultants LLP.</p>',
].join('');

const WHY_HTML = [
  '<p>Ahmad founded PaceMakers because he saw a gap in how sophisticated capital is served in the GCC.</p>',
  '<p>The top-tier advisory firms bring institutional discipline but often at senior-in-name-only pricing. Boutique shops promise senior attention but frequently deliver junior work behind the founder&rsquo;s business card. Family offices, developers, and investors who need serious financial analysis often had to choose between the two.</p>',
  '<p>PaceMakers exists to close that gap. Every mandate is led personally by Ahmad, drawing on twelve years of experience on multi-billion riyal transactions. There is no junior handoff, no template rollout, no lowest-common-denominator model. Clients get institutional analysis with senior judgment on every line.</p>',
  '<p>The firm stays deliberately small. That is a feature, not a limitation. A boutique that only takes the mandates it can lead directly is a boutique that stays credible.</p>',
].join('');

const SECTIONS = [
  {
    display_order: 10,
    section_type: 'founder_hero',
    content: {
      eyebrow: 'Founder',
      name: 'Ahmad Din',
      title_primary: 'Corporate Finance and Transaction Advisory Specialist',
      title_accent: 'Financial Modeling Expert',
      credentials_line: 'ACCA | FMVA | 12+ Years Experience',
      intro:
        'Founder of PaceMakers Business Consultants. 12+ years in corporate finance and transaction advisory across KSA and Pakistan. ACCA Member (UK) and FMVA certified. Building institutional discipline into every mandate.',
      // Seeded empty on purpose. See the header note in migration 034.
      photo_url: '',
      cta_primary_label: 'Connect on LinkedIn',
      cta_primary_href: '',
      cta_secondary_label: 'Book a Meeting',
      cta_secondary_href: '',
    },
  },
  {
    display_order: 20,
    section_type: 'paragraphs',
    content: { heading: 'Background', html: BACKGROUND_HTML },
  },
  {
    display_order: 30,
    section_type: 'paragraphs',
    content: { heading: 'Why PaceMakers', html: WHY_HTML },
  },
  {
    display_order: 40,
    section_type: 'founder_credentials',
    content: {
      heading: 'Experience & Background',
      intro: '',
      display: 'numbered',
      items: [
        '12+ years in Corporate Finance & Advisory',
        'Experience across KSA, GCC & Pakistan',
        'Lender-grade models: IRR, DSCR, Debt Sizing, Debt Sculpting',
        'Real estate, energy, infrastructure & industrial sectors',
        'Transaction advisory & investment support',
        'Mergers & Acquisitions Advisory',
        'FP&A Operating Models & Automated Reporting',
        'Tariff Calculation & Project Finance Structuring',
        'Financial Due Diligence & Business Valuation',
        'Feasibility Studies, Business Plans & Investor Pitch Decks',
      ],
    },
  },
  {
    display_order: 50,
    section_type: 'founder_credentials',
    content: {
      heading: 'Expertise Areas',
      intro: '',
      display: 'pills',
      items: [
        'Transaction Advisory & Financial Due Diligence',
        'Financial Modeling & Business Valuation (DCF, Comparables, Multiples)',
        'Real Estate & Mixed-Use Development Modeling',
        'Renewable Energy & Infrastructure PPP Modeling',
        'FP&A Operating Models & Automated Reporting',
        'Tariff Calculation, Debt Sizing & Debt Sculpting',
        'Mergers & Acquisitions Advisory',
        'Feasibility Analysis & Investment Appraisal',
        'Financial Planning & Analysis (FP&A)',
        'Investor Pitch Deck & Investment Memorandum Development',
      ],
    },
  },
  {
    display_order: 60,
    section_type: 'founder_credentials',
    content: {
      heading: 'Industry Focus',
      intro: '',
      display: 'cards',
      items: [
        'Real Estate & Mixed-Use Development',
        'Renewable Energy (Solar, Wind, Biofuel)',
        'Construction & Infrastructure',
        'Public-Private Partnerships (PPP)',
        'Hospitality & Healthcare',
        'Mergers & Acquisitions',
      ],
    },
  },
  {
    display_order: 70,
    section_type: 'paragraphs',
    content: {
      heading: 'Market Focus',
      html:
        '<p>Saudi Arabia &amp; GCC, with deep experience across KSA-based projects, institutional investors, and regional energy infrastructure. PaceMakers operates from Lahore with primary market focus on Riyadh, Jeddah, Dammam, and the wider GCC.</p>',
    },
  },
  {
    display_order: 80,
    section_type: 'quote',
    content: {
      heading: 'Modeling Philosophy',
      quote_text:
        'A good financial model is not just a calculation, it&rsquo;s a communication tool. Every assumption should be visible, every output should be traceable, and the final product should be something you&rsquo;d be proud to present to a board or an investor committee without reformatting.',
      attribution_name: 'Ahmad Din',
      attribution_role: 'Founder, PaceMakers Business Consultants',
      attribution_photo_url: '',
      alignment: 'left',
    },
  },
  {
    display_order: 90,
    section_type: 'paragraphs',
    content: {
      heading: 'Personal',
      html:
        '<p>Based in Lahore, Pakistan. When not building financial models or serving PaceMakers clients, Ahmad enjoys long drives with family, quality time with friends, and exploring good food.</p>',
    },
  },
];

const HOME_CREDENTIALS = [
  '12+ years in corporate finance and advisory',
  'Experience across KSA, GCC and Pakistan',
  'Lender-grade models: IRR, DSCR, debt sizing, debt sculpting',
  'Real estate, energy, infrastructure and industrial sectors',
  'Transaction advisory and investment support',
];

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

  // 1. Page metadata.
  const { data: existingPage } = await db
    .from('cms_pages')
    .select('id')
    .eq('slug', PAGE_SLUG)
    .maybeSingle();

  const pageRow = {
    slug: PAGE_SLUG,
    title: 'Ahmad Din',
    meta_title: 'Ahmad Din | Founder | PaceMakers Business Consultants',
    meta_description:
      'Ahmad Din, ACCA Member (UK) and FMVA certified, founder of PaceMakers Business Consultants. Over 12 years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan.',
    status: 'published',
    updated_at: new Date().toISOString(),
  };

  if (existingPage) {
    const { error } = await db.from('cms_pages').update(pageRow).eq('slug', PAGE_SLUG);
    if (error) throw new Error('cms_pages update failed: ' + error.message);
    console.log('Updated cms_pages row for', PAGE_SLUG);
  } else {
    const { error } = await db.from('cms_pages').insert(pageRow);
    if (error) throw new Error('cms_pages insert failed: ' + error.message);
    console.log('Inserted cms_pages row for', PAGE_SLUG);
  }

  // is_system arrived in migration 031. Set it separately so a database without
  // that column still seeds the page rather than failing outright.
  const { error: sysErr } = await db
    .from('cms_pages')
    .update({ is_system: true })
    .eq('slug', PAGE_SLUG);
  if (sysErr) {
    console.log('  note: could not set is_system (migration 031 not applied?), continuing');
  }

  // 2. Sections. Delete then insert, so a re-run never duplicates.
  const { error: delErr } = await db
    .from('page_sections')
    .delete()
    .eq('page_slug', PAGE_SLUG);
  if (delErr) throw new Error('page_sections delete failed: ' + delErr.message);

  const { error: insErr } = await db.from('page_sections').insert(
    SECTIONS.map((s) => ({
      page_slug: PAGE_SLUG,
      section_type: s.section_type,
      display_order: s.display_order,
      visible: true,
      content: s.content,
      styles: {},
    })),
  );
  if (insErr) throw new Error('page_sections insert failed: ' + insErr.message);
  console.log(`Inserted ${SECTIONS.length} sections for ${PAGE_SLUG}`);

  // 3. Home founder card: repoint the CTA and add the proof points.
  const { data: homeFounder, error: hfErr } = await db
    .from('page_sections')
    .select('id, content')
    .eq('page_slug', 'home')
    .eq('section_type', 'founder_block')
    .maybeSingle();
  if (hfErr) throw new Error('home founder_block lookup failed: ' + hfErr.message);

  if (!homeFounder) {
    console.log('No home founder_block found, skipping the home update.');
  } else {
    const next = {
      ...(homeFounder.content ?? {}),
      cta_primary_label: 'Read Full Profile',
      cta_primary_href: '/about/ahmad-din',
      cta_secondary_label: 'Connect on LinkedIn',
      // Preserve whatever is already set rather than clobbering a real URL.
      cta_secondary_href: homeFounder.content?.cta_secondary_href ?? '',
      credentials: HOME_CREDENTIALS,
    };
    const { error } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', homeFounder.id);
    if (error) throw new Error('home founder_block update failed: ' + error.message);
    console.log('Updated home founder_block: CTA now points at /about/ahmad-din');
  }

  // 4. Read back.
  const { data: check } = await db
    .from('page_sections')
    .select('section_type, display_order, visible')
    .eq('page_slug', PAGE_SLUG)
    .order('display_order');
  console.log('\nSeeded sections:');
  for (const s of check ?? []) {
    console.log(`  ${String(s.display_order).padStart(2)}  ${s.section_type}`);
  }
  console.log('\nSEED COMPLETE');
  console.log('Still needs a human: the founder portrait, the LinkedIn URL, and the booking URL.');
}

main().catch((err) => {
  console.error('seed-founder-profile failed:', err.message);
  process.exitCode = 1;
});
