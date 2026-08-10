// scripts/seed-merge-about.mjs
//
// Applies migration 045_merge_about_into_home.sql through supabase-js.
//
// Merges /about into home and retires the page:
//   * "A boutique by design" becomes a paragraphs section on home, converted
//     from text_image because that renderer draws an empty gold box with no
//     image and /about had none.
//   * "Firm credentials" moves by page_slug, keeping its row and id.
//   * The home founder card becomes a short founder mention with a link.
//   * The two CTAs elsewhere that pointed at /about now point at /.
//   * The nav slot is relabelled Founder and points at /about/ahmad-din.
//   * All eight /about sections and the cms_pages row are removed.
//
//   node scripts/seed-merge-about.mjs           apply
//   node scripts/seed-merge-about.mjs --dry-run report only
//   npm run seed-merge-about
//
// Idempotent: every step is guarded on the state it changes, and the deletions
// are naturally no-ops once done. Safe to re-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FIRM_INTRO = {
  heading: 'A boutique by design.',
  align: 'left',
  html:
    '<p>PaceMakers Business Consultants is a corporate finance and transaction advisory firm serving family offices, investors, and developers across Saudi Arabia, the GCC, and worldwide. Founded in 2017 and restructured as a limited liability partnership in 2023, the firm is deliberately small, and structured so that seniority is not a scarce resource on your mandate.</p>' +
    '<p>The partner wins the engagement, leads it, and reviews every deliverable personally. Analysts and associates are engaged per engagement, so the work is properly resourced without a permanent pyramid to feed. That is a choice, not a limitation: it lets us take fewer mandates, go deeper on each, and stand behind every number we put in front of a board, a lender, or an investment committee. <a href="/approach">See how mandates are staffed</a>.</p>',
};

const FOUNDER_MENTION = {
  heading: 'Led by Ahmad Din, founding partner.',
  align: 'left',
  html:
    '<p>Ahmad founded PaceMakers in 2017 and is the firm\'s founding partner. He wins and leads every mandate and reviews every deliverable personally, drawing on twelve years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan. He is an ACCA Member (UK) and FMVA certified. <a href="/about/ahmad-din">Read the full profile</a>.</p>',
};

/** Final home order, resolved by a predicate against each row. */
const HOME_ORDER = [
  [10, (r) => r.section_type === 'hero'],
  [20, (r) => r.content?.heading === FIRM_INTRO.heading],
  [30, (r) => r.section_type === 'service_cards' && r.content?.eyebrow === 'WHAT WE DO'],
  [40, (r) => r.section_type === 'stats_block'],
  [50, (r) => r.section_type === 'founder_credentials'],
  [60, (r) => r.section_type === 'service_cards' && r.content?.eyebrow === 'WHO WE SERVE'],
  [70, (r) => r.section_type === 'process_steps'],
  [80, (r) => r.content?.heading === FOUNDER_MENTION.heading],
  [90, (r) => r.section_type === 'text_image'],
  [100, (r) => r.section_type === 'quote'],
  [110, (r) => r.section_type === 'cta_block'],
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

let db = null;
let changes = 0;
const act = (msg) => {
  changes += 1;
  console.log(`  ${DRY_RUN ? 'would ' : ''}${msg}`);
};

async function sections(slug) {
  const { data, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', slug)
    .order('display_order');
  if (error) throw new Error(`read ${slug}: ${error.message}`);
  return data ?? [];
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 1 + 2. new home sections --------------------------------------------
  console.log('=== home: new sections ===');
  for (const [label, content, order] of [
    ['firm introduction', FIRM_INTRO, 20],
    ['founder mention', FOUNDER_MENTION, 80],
  ]) {
    const home = await sections('home');
    if (home.some((r) => r.content?.heading === content.heading)) {
      console.log(`  skip  ${label}: already present`);
      continue;
    }
    act(`add ${label} "${content.heading}"`);
    if (DRY_RUN) continue;
    const { error } = await db.from('page_sections').insert({
      page_slug: 'home',
      section_type: 'paragraphs',
      content,
      styles: {},
      display_order: order,
      visible: true,
    });
    if (error) throw new Error(`insert ${label}: ${error.message}`);
  }

  // The founder card is replaced by the mention, not kept alongside it.
  const homeNow = await sections('home');
  const founderCard = homeNow.find((r) => r.section_type === 'founder_block');
  if (!founderCard) {
    console.log('  skip  founder card: already removed');
  } else {
    act('remove the home founder_block card (photo, bio and proof points)');
    if (!DRY_RUN) {
      const { error } = await db.from('page_sections').delete().eq('id', founderCard.id);
      if (error) throw new Error(`delete founder_block: ${error.message}`);
    }
  }

  // ---- 3. move firm credentials --------------------------------------------
  console.log('\n=== moving firm credentials ===');
  const aboutRows = await sections('about');
  const credentials = aboutRows.find(
    (r) => r.section_type === 'founder_credentials' && r.content?.heading === 'Firm credentials',
  );
  if (!credentials) {
    const already = (await sections('home')).some(
      (r) => r.content?.heading === 'Firm credentials',
    );
    console.log(already ? '  skip  firm credentials: already on home' : '  WARN  firm credentials not found on /about');
  } else {
    act('move "Firm credentials" from /about to home, keeping its row');
    if (!DRY_RUN) {
      const { error } = await db
        .from('page_sections')
        .update({ page_slug: 'home', display_order: 50, updated_at: new Date().toISOString() })
        .eq('id', credentials.id);
      if (error) throw new Error(`move credentials: ${error.message}`);
    }
  }

  // ---- 4. resequence --------------------------------------------------------
  console.log('\n=== home order ===');
  if (!DRY_RUN) {
    const rows = await sections('home');
    for (const [order, pred] of HOME_ORDER) {
      const hit = rows.find(pred);
      if (!hit) {
        console.log(`  WARN  nothing matched for position ${order}`);
        continue;
      }
      if (hit.display_order === order) {
        console.log(`  skip  ${hit.section_type} already at ${order}`);
        continue;
      }
      act(`move ${hit.section_type} ${hit.display_order} -> ${order}`);
      const { error } = await db
        .from('page_sections')
        .update({ display_order: order, updated_at: new Date().toISOString() })
        .eq('id', hit.id);
      if (error) throw new Error(`reorder: ${error.message}`);
    }
  } else {
    console.log('  (skipped in dry run, depends on the inserts above)');
  }

  // ---- 5. repoint CTAs ------------------------------------------------------
  console.log('\n=== CTAs that pointed at /about ===');
  const { data: heroes } = await db
    .from('page_sections')
    .select('id, page_slug, content')
    .eq('section_type', 'hero')
    .in('page_slug', ['network', 'financial-modeler-pro']);
  for (const h of heroes ?? []) {
    if (h.content?.cta_secondary_href !== '/about') {
      console.log(`  skip  ${h.page_slug}: points at ${h.content?.cta_secondary_href}`);
      continue;
    }
    act(`repoint ${h.page_slug} secondary CTA "${h.content.cta_secondary_label}" to /`);
    if (DRY_RUN) continue;
    const { error } = await db
      .from('page_sections')
      .update({
        content: { ...h.content, cta_secondary_href: '/' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', h.id);
    if (error) throw new Error(`repoint ${h.page_slug}: ${error.message}`);
  }

  // ---- 6. nav ---------------------------------------------------------------
  console.log('\n=== navigation ===');
  const { data: navRow } = await db
    .from('site_pages')
    .select('id, label, href')
    .eq('href', '/about')
    .maybeSingle();
  if (!navRow) {
    console.log('  skip  nav: no item points at /about');
  } else {
    act(`relabel nav "${navRow.label}" -> "Founder" and point at /about/ahmad-din`);
    if (!DRY_RUN) {
      const { error } = await db
        .from('site_pages')
        .update({ label: 'Founder', href: '/about/ahmad-din', updated_at: new Date().toISOString() })
        .eq('id', navRow.id);
      if (error) throw new Error(`nav update: ${error.message}`);
    }
  }

  // ---- 7. retire the page ---------------------------------------------------
  console.log('\n=== retiring /about ===');
  const leftover = await sections('about');
  if (leftover.length === 0) {
    console.log('  skip  no /about sections remain');
  } else {
    act(`delete ${leftover.length} remaining /about section(s): ${leftover.map((r) => r.section_type).join(', ')}`);
    if (!DRY_RUN) {
      const { error } = await db.from('page_sections').delete().eq('page_slug', 'about');
      if (error) throw new Error(`delete about sections: ${error.message}`);
    }
  }

  const { data: pageRow } = await db
    .from('cms_pages')
    .select('slug, is_system')
    .eq('slug', 'about')
    .maybeSingle();
  if (!pageRow) {
    console.log('  skip  cms_pages "about" already gone');
  } else {
    act('delete the cms_pages "about" row (clearing is_system first)');
    if (!DRY_RUN) {
      // The admin guard refuses to delete a system page, and that guard is the
      // right default. Lifted deliberately for this one row.
      await db.from('cms_pages').update({ is_system: false }).eq('slug', 'about');
      const { error } = await db.from('cms_pages').delete().eq('slug', 'about');
      if (error) throw new Error(`delete cms_pages row: ${error.message}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const finalHome = await sections('home');
  const order = finalHome.map((r) =>
    r.section_type === 'paragraphs' ? `paragraphs(${r.content?.heading})` : r.section_type,
  );
  console.log('  home: ' + order.join(' | '));

  const expected = [
    'hero',
    `paragraphs(${FIRM_INTRO.heading})`,
    'service_cards',
    'stats_block',
    'founder_credentials',
    'service_cards',
    'process_steps',
    `paragraphs(${FOUNDER_MENTION.heading})`,
    'text_image',
    'quote',
    'cta_block',
  ];
  if (JSON.stringify(order) !== JSON.stringify(expected)) {
    failures.push('home order does not match the target sequence');
  }
  if (finalHome.some((r) => r.section_type === 'founder_block')) {
    failures.push('home still carries a founder_block photo card');
  }

  if ((await sections('about')).length > 0) failures.push('/about sections remain');
  const { data: stillPage } = await db.from('cms_pages').select('slug').eq('slug', 'about').maybeSingle();
  if (stillPage) failures.push('cms_pages row for about remains');

  const { data: navAfter } = await db.from('site_pages').select('label, href').order('display_order');
  console.log('  nav: ' + (navAfter ?? []).map((n) => `${n.label} -> ${n.href}`).join(', '));
  if ((navAfter ?? []).some((n) => n.href === '/about')) failures.push('a nav item still points at /about');

  const { data: anyAbout } = await db.from('page_sections').select('page_slug, content');
  for (const r of anyAbout ?? []) {
    const s = JSON.stringify(r.content ?? {});
    if (/"\/about"/.test(s)) failures.push(`${r.page_slug} still links to /about`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-merge-about failed:', err.message);
  process.exitCode = 1;
});
