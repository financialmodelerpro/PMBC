// scripts/seed-firm-prominence.mjs
//
// Applies migration 044_firm_prominence.sql through supabase-js.
//
// Repositions the site from "one person" to "a firm led by a partner", without
// weakening the senior-led promise. Six changes:
//
//   1. Home and about stats become FIRM facts. The career figures they used to
//      show (200+ engagements, 200+ valuations, SAR 20B+ NAV, SAR 300M+ capital)
//      move into the partner\'s credentials, where they are true.
//   2. Founder language moves from "Ahmad leads every mandate" to partner-led
//      phrasing, with Ahmad named as the partner.
//   3. A delivery-model section on /approach explains how mandates are staffed.
//   4. /network is repositioned as origination and market access, not delivery.
//      Sky Gulf and Lynkers are referral relationships and do not execute.
//   5. A firm credentials block on /about, distinct from the partner\'s.
//   6. The home page is resequenced so the firm comes before the founder.
//
//   node scripts/seed-firm-prominence.mjs           apply
//   node scripts/seed-firm-prominence.mjs --dry-run report only
//   npm run seed-firm-prominence
//
// Only writes fields whose current value differs, and reports each one, so a
// second run immediately after the first changes nothing. It is NOT guarded
// against later operator edits: re-running restores this copy over any
// subsequent rewording of the same fields. Run it once.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/* ------------------------------------------------------------------ copy -- */

/** The firm\'s own record. Deliberately separate from the partner\'s career. */
const FIRM_STATS = [
  { value: '30+', label: 'Mandates Delivered' },
  { value: '2017', label: 'Established' },
  { value: 'LLP', label: 'SECP Registered' },
  { value: '6', label: 'Sectors Served' },
];

const FIRM_STATS_INTRO =
  'The firm\'s own record since 2017. The partner\'s wider career experience is set out separately, in his profile.';

/** Ahmad\'s career figures, which are his and are labelled as his. */
const PARTNER_CREDENTIALS = [
  '200+ advisory engagements across his career',
  '200+ business valuations delivered',
  'SAR 20B+ real estate NAV modeled',
  'SAR 300M+ capital deployed via equity research',
  'ACWA Power Central Asia renewables and Saudi Aramco-backed industrial projects',
];

const PARTNER_LINE =
  'Founding Partner · ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan';

const HOME_FOUNDER_BIO =
  '<p>At many boutique firms the partner wins the engagement and hands the work to a junior team. PaceMakers is structured the other way. Ahmad Din, the firm\'s founding partner, wins and leads every mandate, and reviews every deliverable personally before it reaches a client. Analysts and associates are engaged for each engagement as the work requires.</p>' +
  '<p>That is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, and every recommendation, with the capacity to resource the work properly.</p>';

const ABOUT_FOUNDER_BIO =
  '<p>Ahmad founded PaceMakers in 2017 to bring senior, analytically grounded advisory to the mandates that larger firms either skip or under-staff. He is the firm\'s founding partner: he wins and leads every mandate and reviews every deliverable personally, supported by analysts and associates engaged for each engagement.</p>' +
  '<p>Over twelve years in corporate finance his own work has spanned multi-billion riyal real estate portfolios, ACWA Power\'s Central Asia renewable infrastructure, and Saudi Aramco-backed industrial projects. He is an ACCA Member (UK) and FMVA-certified.</p>';

const FIRM_CREDENTIALS = {
  eyebrow: 'THE FIRM',
  heading: 'Firm credentials',
  intro:
    'PaceMakers Business Consultants LLP is a registered limited liability partnership. These are the firm\'s own credentials, distinct from the partner\'s career record.',
  display: 'cards',
  items: [
    'Established 2017',
    'Restructured as a limited liability partnership in 2023',
    'Registered with the Securities and Exchange Commission of Pakistan',
    '30+ mandates delivered',
    'Sectors served: biofuel, oil and gas, waste management, data centers, construction, and industrial services',
    'Clients across Saudi Arabia, the GCC, and worldwide',
  ],
};

const DELIVERY_MODEL = {
  eyebrow: 'DELIVERY MODEL',
  heading: 'How mandates are staffed',
  intro:
    'Every mandate is won and led by the partner, and every deliverable is reviewed by him personally before it leaves the firm. Analysts and associates are engaged for each engagement as the work requires. PaceMakers does not carry a permanent pyramid, and no mandate is handed down to a junior team once the engagement letter is signed.',
  display: 'cards',
  items: [
    'Partner-led. Ahmad Din wins the mandate, scopes it, and stays accountable for it through to close.',
    'Personally reviewed. Every model, memorandum, and recommendation is reviewed by the partner before it reaches a client.',
    'Resourced per engagement. Analysts and associates are brought in for the work a mandate actually needs, rather than staffed to fill a bench.',
  ],
};

const ABOUT_FIRM_BODY =
  '<p>PaceMakers is deliberately small, and structured so that seniority is not a scarce resource on your mandate. The partner wins the engagement, leads it, and reviews every deliverable personally. Analysts and associates are engaged per engagement, so the work is properly resourced without a permanent pyramid to feed.</p>' +
  '<p>That is a choice, not a limitation. It lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee.</p>';

const NETWORK_HOME_BODY =
  '<p>Two long-standing relationships extend PaceMakers\' reach across the Gulf. Sky Gulf, headquartered in Al Khobar, originates and refers industrial and project mandates in the Eastern Province. Lynkers, based in Manama and a strategic equity shareholder in the firm, provides Bahrain market access and capital-markets introductions.</p>' +
  '<p>Both are referral and market-access relationships. Neither executes mandates: every engagement is delivered by PaceMakers, partner-led.</p>';

const NETWORK_WHY_BODY =
  '<p>A large firm sells you its logo and staffs you with whoever is available. PaceMakers works the other way. The network is how mandates originate and how clients reach markets they do not already sit in: introductions, local presence, and capital-markets contacts.</p>' +
  '<p>Execution does not travel with it. Every engagement is delivered by PaceMakers, led by the partner, and resourced with analysts and associates engaged for that mandate. The people who win the work are the people accountable for it.</p>';

/* ------------------------------------------------------------- machinery -- */

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

let db = null;
let changeCount = 0;

/**
 * Key-order-insensitive comparison.
 *
 * Postgres normalises jsonb object key order on write, so a stats entry sent as
 * {value, label} reads back as {label, value}. A plain JSON.stringify compare
 * therefore reports a difference on every run, which would both break
 * idempotency and produce a false verification failure. Sorting keys first is
 * the fix; array order still matters and is preserved.
 */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

async function sections(pageSlug) {
  const { data, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', pageSlug)
    .order('display_order');
  if (error) throw new Error(`read ${pageSlug}: ${error.message}`);
  return data ?? [];
}

/** Finds one section by type, optionally narrowed by a content field value. */
function find(rows, sectionType, match) {
  const candidates = rows.filter((r) => r.section_type === sectionType);
  if (!match) {
    if (candidates.length !== 1) {
      throw new Error(`expected exactly one ${sectionType}, found ${candidates.length}`);
    }
    return candidates[0];
  }
  // The accepted values are a list because some of these lookups key on a field
  // this script itself rewrites. Matching only the pre-change value would make
  // the script findable exactly once, and a second run would abort partway
  // through with the earlier pages already updated.
  const [key, ...accepted] = match;
  const hit = candidates.find((r) => accepted.includes(String(r.content?.[key] ?? '')));
  if (!hit) {
    throw new Error(`no ${sectionType} with ${key} in [${accepted.join(' | ')}]`);
  }
  return hit;
}

/** Writes only the keys whose value actually differs, and names each one. */
async function patch(label, row, changes) {
  const diff = {};
  for (const [k, v] of Object.entries(changes)) {
    if (canon(row.content?.[k]) !== canon(v)) diff[k] = v;
  }
  const keys = Object.keys(diff);
  if (keys.length === 0) {
    console.log(`  skip  ${label}: already current`);
    return;
  }
  changeCount += keys.length;
  console.log(`  ${DRY_RUN ? 'would set' : 'set   '} ${label}: ${keys.join(', ')}`);
  if (DRY_RUN) return;

  const next = { ...(row.content ?? {}), ...diff };
  const { data, error } = await db
    .from('page_sections')
    .update({ content: next, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select('id, content');
  if (error) throw new Error(`${label}: ${error.message}`);
  if (!data || data.length !== 1) throw new Error(`${label}: matched ${data?.length ?? 0} rows`);
  row.content = data[0].content;
}

async function reorder(label, row, order) {
  if (row.display_order === order) {
    console.log(`  skip  ${label}: already at ${order}`);
    return;
  }
  changeCount += 1;
  console.log(`  ${DRY_RUN ? 'would move' : 'move  '} ${label}: ${row.display_order} -> ${order}`);
  if (DRY_RUN) return;
  const { error } = await db
    .from('page_sections')
    .update({ display_order: order, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) throw new Error(`${label} reorder: ${error.message}`);
  row.display_order = order;
}

async function insertSection(pageSlug, sectionType, order, content) {
  const existing = await sections(pageSlug);
  const dupe = existing.find(
    (r) => r.section_type === sectionType && String(r.content?.heading ?? '') === content.heading,
  );
  if (dupe) {
    console.log(`  skip  ${pageSlug}/${content.heading}: already present`);
    return;
  }
  changeCount += 1;
  console.log(`  ${DRY_RUN ? 'would add' : 'add   '} ${pageSlug}/${sectionType} "${content.heading}" at ${order}`);
  if (DRY_RUN) return;
  const { error } = await db.from('page_sections').insert({
    page_slug: pageSlug,
    section_type: sectionType,
    content,
    styles: {},
    display_order: order,
    visible: true,
  });
  if (error) throw new Error(`insert ${pageSlug}/${sectionType}: ${error.message}`);
}

/* ------------------------------------------------------------------ main -- */

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---------------------------------------------------------------- home --
  console.log('\n=== home ===');
  const home = await sections('home');
  const hHero = find(home, 'hero');
  const hFounder = find(home, 'founder_block');
  const hStats = find(home, 'stats_block');
  const hWhatWeDo = find(home, 'service_cards', ['eyebrow', 'WHAT WE DO']);
  const hWhoWeServe = find(home, 'service_cards', ['eyebrow', 'WHO WE SERVE']);
  const hProcess = find(home, 'process_steps');
  const hNetwork = find(home, 'text_image');
  const hQuote = find(home, 'quote');
  const hCta = find(home, 'cta_block');

  // A live typo on the site\'s most important button.
  await patch('home hero', hHero, { cta_label: 'Book a Meeting' });

  await patch('home stats', hStats, { intro: FIRM_STATS_INTRO, stats: FIRM_STATS });

  await patch('home founder', hFounder, {
    eyebrow: 'PARTNER-LED DELIVERY',
    headline: 'Every mandate is partner-led.',
    bio_html: HOME_FOUNDER_BIO,
    credentials: PARTNER_CREDENTIALS,
    credentials_line: PARTNER_LINE,
  });

  await patch('home what-we-do', hWhatWeDo, {
    intro:
      'Six core capabilities, applied to the moments that matter most: capital raises, acquisitions, structuring decisions, and exits. Every engagement is partner-led and built on lender-grade modeling discipline.',
  });

  await patch('home network', hNetwork, {
    eyebrow: 'ORIGINATION AND MARKET ACCESS',
    heading: 'Reach across the Gulf, delivery in house.',
    body_html: NETWORK_HOME_BODY,
  });

  await patch('home quote', hQuote, {
    attribution_role: 'Founding Partner, PaceMakers Business Consultants',
  });

  await patch('home cta', hCta, {
    cta_secondary_label: 'Email the Firm',
    cta_secondary_href: 'mailto:advisory@pacemakersglobal.com',
  });

  // Firm first, founder after. hero, what we do, track record, who we serve,
  // delivery approach, founder, network, quote, CTA.
  console.log('  -- resequencing --');
  await reorder('home hero', hHero, 10);
  await reorder('home what-we-do', hWhatWeDo, 20);
  await reorder('home stats', hStats, 30);
  await reorder('home who-we-serve', hWhoWeServe, 40);
  await reorder('home process', hProcess, 50);
  await reorder('home founder', hFounder, 60);
  await reorder('home network', hNetwork, 70);
  await reorder('home quote', hQuote, 80);
  await reorder('home cta', hCta, 90);

  // --------------------------------------------------------------- about --
  console.log('\n=== about ===');
  const about = await sections('about');
  const aFirm = find(about, 'text_image', ['eyebrow', 'THE FIRM']);
  const aStats = find(about, 'stats_block');
  const aFounder = find(about, 'founder_block');
  const aQuote = find(about, 'quote');
  const aNetwork = find(about, 'text_image', [
    'eyebrow',
    'REACH WITHOUT THE OVERHEAD',
    'ORIGINATION AND MARKET ACCESS',
  ]);

  await patch('about stats', aStats, { intro: FIRM_STATS_INTRO, stats: FIRM_STATS });

  await patch('about firm', aFirm, {
    heading: 'A boutique by design.',
    body_html: ABOUT_FIRM_BODY,
    cta_label: 'How mandates are staffed',
    cta_href: '/approach',
  });

  await patch('about founder', aFounder, {
    eyebrow: 'THE FOUNDING PARTNER',
    headline: 'Led by Ahmad Din.',
    bio_html: ABOUT_FOUNDER_BIO,
    credentials: PARTNER_CREDENTIALS,
    credentials_line: PARTNER_LINE,
    cta_primary_label: 'Read Full Profile',
    cta_primary_href: '/about/ahmad-din',
  });

  await patch('about quote', aQuote, {
    attribution_role: 'Founding Partner, PaceMakers Business Consultants',
  });

  await patch('about network', aNetwork, {
    eyebrow: 'ORIGINATION AND MARKET ACCESS',
    heading: 'Reach that opens doors.',
    body_html: NETWORK_HOME_BODY,
  });

  // Firm credentials sit immediately after the firm stats, before the founder.
  await insertSection('about', 'founder_credentials', 35, FIRM_CREDENTIALS);

  // ------------------------------------------------------------ approach --
  console.log('\n=== approach ===');
  const approach = await sections('approach');
  const apQuote = find(approach, 'quote');
  const apConstant = find(approach, 'text_image', ['eyebrow', 'WHAT STAYS CONSTANT']);

  await insertSection('approach', 'founder_credentials', 25, DELIVERY_MODEL);

  await patch('approach constant', apConstant, {
    heading: 'Senior judgment, start to finish.',
    body_html:
      '<p>Every engagement is led personally by the partner who scoped it, and every deliverable is reviewed by him before it reaches you. There are no junior pass-throughs and no black-box deliverables you cannot interrogate. If a number moves, you will know which assumption moved it.</p>' +
      '<p>Three things hold across every mandate: the model is built to be read, not just run; the assumptions are honest about risk, not tuned to flatter; and the advice is the advice we would act on with our own capital.</p>',
  });

  await patch('approach quote', apQuote, {
    attribution_role: 'Founding Partner, PaceMakers Business Consultants',
  });

  // ------------------------------------------------------------- network --
  console.log('\n=== network ===');
  const network = await sections('network');
  const nHero = find(network, 'hero');
  const nPartners = find(network, 'network_partners');
  const nWhy = find(network, 'text_image');

  await patch('network hero', nHero, {
    headline: 'Origination, referral, and market access.',
    subtitle:
      'Two long-standing relationships extend PaceMakers\' reach across the Gulf. They introduce opportunities and open doors. They do not deliver mandates: every engagement is executed by PaceMakers, partner-led.',
  });

  const partners = Array.isArray(nPartners.content?.partners) ? nPartners.content.partners : [];
  const nextPartners = partners.map((p) => {
    if (p.name === 'Sky Gulf') {
      return {
        ...p,
        role_tag: 'Referral Relationship',
        description:
          'Headquartered in the Eastern Province, Sky Gulf originates and refers industrial and project mandates in Saudi Arabia, and opens doors to counterparties where the assets are. Sky Gulf does not execute PaceMakers engagements.',
      };
    }
    if (p.name === 'Lynkers') {
      return {
        ...p,
        role_tag: 'Equity Shareholder and Referral',
        description:
          'Based in Manama and a strategic equity shareholder in PaceMakers, Lynkers provides Bahrain market access, capital-markets insight, and introductions to the regional banking and investor network. Delivery of any resulting mandate stays with PaceMakers.',
      };
    }
    return p;
  });

  await patch('network partners', nPartners, {
    heading: 'Two relationships, one standard.',
    intro:
      'These are referral and market-access relationships, not delivery partners. PaceMakers executes every mandate itself. The network is how work reaches us, and how clients reach markets they do not already sit in.',
    partners: nextPartners,
  });

  await patch('network why', nWhy, {
    heading: 'Reach that opens doors, delivery that stays in house.',
    body_html: NETWORK_WHY_BODY,
  });

  // ----------------------------------------------------- founder profile --
  console.log('\n=== about-ahmad-din ===');
  const profile = await sections('about-ahmad-din');
  const pHero = find(profile, 'founder_hero');
  const credentialBlocks = profile.filter((r) => r.section_type === 'founder_credentials');
  const experience = credentialBlocks.find((r) => r.content?.display === 'numbered');

  await patch('profile hero', pHero, {
    eyebrow: 'Founding Partner',
    intro:
      'Founding partner of PaceMakers Business Consultants. 12+ years in corporate finance and transaction advisory across KSA and Pakistan. ACCA Member (UK) and FMVA certified. He wins and leads every PaceMakers mandate and reviews every deliverable personally.',
  });

  if (experience) {
    const existing = Array.isArray(experience.content?.items) ? experience.content.items : [];
    const merged = [...PARTNER_CREDENTIALS, ...existing.filter((i) => !PARTNER_CREDENTIALS.includes(i))];
    await patch('profile experience', experience, { items: merged });
  } else {
    console.log('  skip  profile experience: no numbered credentials block found');
  }

  /* ---------------------------------------------------------- verify ---- */
  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changeCount} change(s) pending.`);
    return;
  }

  console.log('\nVerifying...');
  const failures = [];

  const homeAfter = await sections('home');
  const order = homeAfter.map((r) => r.section_type);
  const expected = [
    'hero', 'service_cards', 'stats_block', 'service_cards',
    'process_steps', 'founder_block', 'text_image', 'quote', 'cta_block',
  ];
  if (JSON.stringify(order) !== JSON.stringify(expected)) {
    failures.push(`home order is ${order.join(', ')}`);
  }
  const statsAfter = find(homeAfter, 'stats_block');
  if (canon(statsAfter.content.stats) !== canon(FIRM_STATS)) {
    failures.push('home stats are not the firm figures');
  }
  const blob = JSON.stringify(homeAfter);
  if (blob.includes('SAR 20B+ real estate NAV modeled') === false) {
    failures.push('partner career figures missing from the home founder card');
  }
  // The career figures must no longer appear as firm statistics anywhere.
  for (const slug of ['home', 'about']) {
    const rows = await sections(slug);
    const stats = find(rows, 'stats_block');
    const labels = (stats.content.stats ?? []).map((s) => s.label).join(' ');
    if (/Valuations Delivered|Capital Deployed|Real Estate NAV/.test(labels)) {
      failures.push(`${slug} stats still present career figures as firm facts`);
    }
  }
  const netAfter = await sections('network');
  if (JSON.stringify(netAfter).includes('Execution Partner')) {
    failures.push('network still labels a referral relationship as an execution partner');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changeCount} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-firm-prominence failed:', err.message);
  process.exitCode = 1;
});
