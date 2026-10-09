// scripts/seed-kaleem-farooq.mjs
//
// Applies migration 098_team_kaleem_farooq.sql through supabase-js.
//
// Two parts, in order:
//   1. The profile page at /about/kaleem-farooq: a `cms_pages` row and six
//      page-builder sections, the same section types /about/ahmad-din uses.
//   2. His card in `team_members`, second after the founding partner.
//
//   node scripts/seed-kaleem-farooq.mjs           apply
//   node scripts/seed-kaleem-farooq.mjs --dry-run report only
//   npm run seed-kaleem-farooq
//
// Safe on re-run, and never destructive. The page row is inserted only when the
// slug is absent, the sections only when the page has none, and the card only
// when no member of that name exists. Nothing is updated or deleted, so a re-run
// cannot overwrite wording edited in the admin since. Every write is read back
// before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE_SLUG = 'about-kaleem-farooq';
const NAME = 'Kaleem Farooq';
const ROLE = 'Business Development, Saudi Arabia';
const LOCATION = 'Riyadh, KSA';

const PAGE = {
  slug: PAGE_SLUG,
  title: NAME,
  meta_title: 'Kaleem Farooq | Business Development, Saudi Arabia | PaceMakers',
  meta_description:
    'Kaleem Farooq leads business development for PaceMakers Business Consultants in Saudi Arabia. Finance and commercial leader with 12+ years in the Kingdom across technology, SaaS, construction, government projects and fintech.',
  status: 'published',
  is_system: true,
};

const SECTIONS = [
  {
    section_type: 'founder_hero',
    display_order: 10,
    content: {
      eyebrow: 'Team',
      name: NAME,
      title_primary: ROLE,
      title_accent: '',
      credentials_line: LOCATION,
      intro:
        'Kaleem Farooq is a finance and commercial leader with more than 12 years of experience in Saudi Arabia, spanning technology services, SaaS, construction, government infrastructure and investor-backed growth companies. He leads business development for PaceMakers Business Consultants in the Kingdom, based in Riyadh.' +
        '\n\n' +
        'Having spent his career inside finance teams, Kaleem recognises the moments when companies need advisory support: raising capital, securing bank facilities, obtaining licences, bidding for government projects and planning expansion. He speaks the language of CFOs and founders, from financial models and data rooms to bank guarantees, ZATCA and audit.',
      // Seeded empty on purpose: the hero renders a gold-framed monogram until a
      // portrait is set in the page builder. No email or booking CTA for now.
      photo_url: '',
      cta_primary_label: '',
      cta_primary_href: '',
      cta_secondary_label: '',
      cta_secondary_href: '',
    },
  },
  {
    section_type: 'founder_credentials',
    display_order: 20,
    content: {
      heading: 'Sector focus',
      intro: '',
      display: 'numbered',
      items: [
        'Technology and IT services: commercial strategy, bid pricing and finance leadership for a Riyadh-based technology services firm',
        'SaaS and AI start-ups: financial modelling, subscription pricing and investor readiness for venture-backed companies',
        'Fintech and investor-backed growth: finance leadership through a Series A fundraise and a period of 4x revenue growth',
        'Construction and government projects: financial reporting, billing and cost control on large Ministry of Interior projects',
        'Retail technology, staff augmentation, trading and holding groups: finance operations, treasury and governance',
      ],
    },
  },
  {
    section_type: 'paragraphs',
    display_order: 30,
    content: {
      heading: 'Career highlights',
      html:
        '<h3>Royal Cyber, Riyadh (2023 to 2026)</h3>' +
        '<p><strong>General Manager Finance</strong></p>' +
        '<ul>' +
        '<li>Led the company\'s Regional Headquarters (RHQ) licensing with the Ministry of Investment (MISA), securing 240 visas, a 10-year tax exemption, Saudization relief and access to government bids</li>' +
        '<li>Owned commercial bid strategy from pricing to contract award, including RFP documentation, regulatory certifications and bank guarantees</li>' +
        '<li>Renegotiated vendor contracts and onboarded three new partners, saving around SAR 3 million a year</li>' +
        '<li>Built Order-to-Cash and Procure-to-Pay cycles, cutting collection time by over 30%, completing audits around three times faster and reducing ZATCA queries by 70%</li>' +
        '</ul>' +
        '<h3>Rewaa, Riyadh and GCC</h3>' +
        '<ul>' +
        '<li>Ran finance through the company\'s Series A fundraise, covering due diligence, the investor data room, the cap table and employee equity plans</li>' +
        '<li>Set finance OKRs during 4x revenue growth in 2021 and 2022, reduced SaaS costs by 35% and managed governance across ADGM, KSA and India entities</li>' +
        '</ul>' +
        '<h3>ABV Rock Group, Riyadh</h3>' +
        '<ul>' +
        '<li>Led financial reporting for two Ministry of Interior projects worth SAR 7.5 billion and recovered billing on SAR 100 million of unbilled work</li>' +
        '<li>Delivered SAR 10 million in savings through subcontract surcharge clauses, SAR 800,000 a year through e-approvals and SAR 1 million through central inventory management</li>' +
        '</ul>' +
        '<h3>Fathom.io, Al Khobar</h3>' +
        '<ul>' +
        '<li>Built a five-year financial model and subscription pricing engine for the AI SaaS start-up, used directly in its investor pitch decks</li>' +
        '</ul>' +
        '<h3>Independent Advisory, KSA</h3>' +
        '<ul>' +
        '<li>Supports growing SMEs on financial hygiene, cash-flow management, cost reduction and fundraising readiness</li>' +
        '</ul>',
    },
  },
  {
    section_type: 'founder_credentials',
    display_order: 40,
    content: {
      heading: 'Areas of expertise',
      intro: '',
      display: 'pills',
      items: [
        'Business development and bid strategy',
        'Fundraising and investor readiness',
        'Financial modelling and pricing',
        'Treasury and banking relationships',
        'Cost optimisation and procurement',
        'Regulatory, tax and governance (MISA, ZATCA)',
      ],
    },
  },
  {
    section_type: 'paragraphs',
    display_order: 50,
    content: {
      heading: 'His role at PaceMakers',
      html:
        '<p>Kaleem originates mandates across Saudi Arabia, makes introductions and supports client meetings and presentations. He works alongside PaceMakers\' Founding Partner, who scopes, prices and delivers every engagement.</p>',
    },
  },
  {
    section_type: 'quote',
    display_order: 60,
    content: {
      heading: '',
      // The renderer supplies the quotation marks.
      quote_text:
        'Every finance team I have led reached the same moment: a decision that needs capital, and numbers it can stand behind. That is the moment I bring to PaceMakers.',
      attribution_name: NAME,
      attribution_role: ROLE,
      attribution_photo_url: '',
      alignment: 'left',
    },
  },
];

const CARD = {
  name: NAME,
  role: ROLE,
  // Rendered as the qualifications line. There is no location column, and the
  // card's location reads naturally in that slot.
  credentials: LOCATION,
  // Wrapped so `.pmbc-prose p` applies, as for the founder's card.
  bio:
    "<p>Finance and commercial leader with 12+ years in Saudi Arabia across technology, SaaS, construction, government projects and fintech. Kaleem leads business development for PaceMakers in the Kingdom, connecting founders, CFOs and investors with the firm's advisory practice.</p>",
  // No portrait yet: the card renders the navy monogram panel until one is set
  // in /admin/team. No email for now; the column stays empty.
  photo: null,
  display_order: 1,
  visible: true,
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

const norm = (s) => String(s ?? '').trim().toLowerCase();

async function seedPage(db) {
  console.log('\n1. Profile page /about/kaleem-farooq');

  const { data: page, error: pageErr } = await db
    .from('cms_pages')
    .select('slug')
    .eq('slug', PAGE_SLUG)
    .maybeSingle();
  if (pageErr) throw new Error('cms_pages read failed: ' + pageErr.message);

  if (page) {
    console.log('  skip  the page row already exists. Left exactly as it is.');
  } else if (DRY_RUN) {
    console.log('  would insert the page row.');
  } else {
    const { error } = await db.from('cms_pages').insert(PAGE);
    if (error) throw new Error('cms_pages insert failed: ' + error.message);
    console.log('  insert done (page row).');
  }

  const { count, error: countErr } = await db
    .from('page_sections')
    .select('id', { count: 'exact', head: true })
    .eq('page_slug', PAGE_SLUG);
  if (countErr) throw new Error('page_sections read failed: ' + countErr.message);

  if ((count ?? 0) > 0) {
    console.log(`  skip  the page already has ${count} section(s). Left exactly as they are.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  would insert ${SECTIONS.length} sections.`);
    return;
  }
  const rows = SECTIONS.map((s) => ({ ...s, page_slug: PAGE_SLUG, visible: true }));
  const { error } = await db.from('page_sections').insert(rows);
  if (error) throw new Error('page_sections insert failed: ' + error.message);
  console.log(`  insert done (${rows.length} sections).`);
}

async function seedCard(db) {
  console.log('\n2. Team card');

  const { data: rows, error } = await db.from('team_members').select('id, name, display_order');
  if (error) throw new Error('team_members read failed: ' + error.message);

  if ((rows ?? []).some((r) => norm(r.name) === norm(NAME))) {
    console.log(`  skip  "${NAME}" is already in the team list. Left exactly as it is.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  would insert the card at display_order ${CARD.display_order}.`);
    return;
  }
  const { error: insErr } = await db.from('team_members').insert(CARD);
  if (insErr) throw new Error('team_members insert failed: ' + insErr.message);
  console.log('  insert done.');
}

async function verify(db) {
  console.log('\nVerifying...');
  let ok = true;

  const { data: page } = await db
    .from('cms_pages')
    .select('slug, status')
    .eq('slug', PAGE_SLUG)
    .maybeSingle();
  if (!page) {
    console.error('  FAIL no page row.');
    ok = false;
  } else {
    console.log(`  ok    page row present (${page.status}).`);
  }

  const { data: sections } = await db
    .from('page_sections')
    .select('section_type, display_order, visible, content')
    .eq('page_slug', PAGE_SLUG)
    .order('display_order', { ascending: true });
  const hero = (sections ?? []).find((s) => s.section_type === 'founder_hero' && s.visible);
  if (!hero || norm(hero.content?.name) !== norm(NAME)) {
    console.error('  FAIL no visible founder_hero naming Kaleem Farooq. The team card cannot link to the profile.');
    ok = false;
  } else {
    console.log(`  ok    ${sections.length} section(s), hero names ${hero.content.name}.`);
  }

  const { data: members } = await db
    .from('team_members')
    .select('name, display_order, visible')
    .eq('visible', true)
    .order('display_order', { ascending: true });
  const order = (members ?? []).map((m) => `${m.display_order} ${m.name}`);
  if (!(members ?? []).some((m) => norm(m.name) === norm(NAME))) {
    console.error('  FAIL Kaleem Farooq is not a published team member.');
    ok = false;
  } else {
    console.log(`  ok    published members: ${order.join(', ')}`);
  }

  if (ok) console.log('\nCOMPLETE.');
  else process.exitCode = 1;
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

  await seedPage(db);
  await seedCard(db);

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }
  await verify(db);
}

main().catch((err) => {
  console.error('seed-kaleem-farooq failed:', err.message);
  process.exitCode = 1;
});
