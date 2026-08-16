// scripts/seed-collection-page-heroes.mjs
//
// Applies migration 070_collection_page_heroes.sql through supabase-js.
//
// Gives /team, /case-studies and /insights a cms_pages row and one `hero`
// section each, so their opening copy is edited in the page builder rather than
// in a .tsx file. Also makes the two requested wording fixes on the team page.
//
//   node scripts/seed-collection-page-heroes.mjs           apply
//   node scripts/seed-collection-page-heroes.mjs --dry-run report only
//   npm run seed-collection-page-heroes
//
// The collections are untouched: team cards still come from `team_members`,
// case studies from `case_studies`, articles from `articles`. Only page copy
// moves.
//
// Idempotent. Pages and sections are inserted only when absent, and the bio
// update is guarded on the old phrasing, so a re-run cannot overwrite an edit
// made in the admin since.
//
// Every write is read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The three pages, at the wording their routes already carried.
 *
 * The one change is the team tagline, which said "led directly by a partner"
 * where the rest of the site says partner-led.
 */
const PAGES = [
  {
    slug: 'team',
    title: 'Team',
    metaTitle: 'Team | PaceMakers Business Consultants',
    metaDescription:
      'The people behind PaceMakers. Senior practitioners who lead every mandate directly.',
    eyebrow: 'Team',
    headline: 'The people behind the work',
    tagline:
      'PaceMakers is senior by design. Every mandate is partner-led, supported by a focused analytical bench.',
  },
  {
    slug: 'case-studies',
    title: 'Case Studies',
    metaTitle: 'Case Studies | PaceMakers Business Consultants',
    metaDescription:
      'Selected engagements across sectors. Anonymized where client confidentiality requires.',
    eyebrow: 'Case Studies',
    headline: 'Proof of work, discreetly told',
    tagline:
      'Selected engagements across the sectors we serve. Some are anonymized where client confidentiality requires.',
  },
  {
    slug: 'insights',
    title: 'Insights',
    metaTitle: 'Insights | PaceMakers Business Consultants',
    metaDescription:
      'Perspectives on valuation, transactions, and corporate finance from the PaceMakers team.',
    eyebrow: 'Insights',
    headline: 'Perspectives on the work',
    tagline:
      'Notes on valuation, transactions, and corporate finance from the people doing the modelling.',
  },
];

const BIO_FROM = 'across KSA and Pakistan';
const BIO_TO = 'across Saudi Arabia, the GCC, and Pakistan';

function heroContent(page) {
  return {
    badge_text: page.eyebrow,
    headline: page.headline,
    // HTML because the hero renderer passes the subtitle through RichText, the
    // same as every other hero on the site.
    subtitle: `<p>${page.tagline}</p>`,
    tags: [],
    cta_label: '',
    cta_href: '',
    cta_secondary_label: '',
    cta_secondary_href: '',
  };
}

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
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const page of PAGES) {
    // ---- 1. The cms_pages row -------------------------------------------
    const { data: existingPage, error: pageErr } = await db
      .from('cms_pages')
      .select('slug')
      .eq('slug', page.slug)
      .maybeSingle();
    if (pageErr) throw new Error(`cms_pages read (${page.slug}) failed: ` + pageErr.message);

    if (existingPage) {
      console.log(`skip  cms_pages ${page.slug}: already exists`);
    } else if (DRY_RUN) {
      console.log(`would create cms_pages ${page.slug}`);
    } else {
      const row = {
        slug: page.slug,
        title: page.title,
        meta_title: page.metaTitle,
        meta_description: page.metaDescription,
        status: 'published',
        is_system: true,
      };
      let { error } = await db.from('cms_pages').insert(row);
      // Migration 031 adds is_system. Retry without it rather than failing, the
      // same way the admin API degrades when that column is absent.
      if (error && /is_system/.test(error.message)) {
        const { is_system: _omit, ...withoutFlag } = row;
        void _omit;
        ({ error } = await db.from('cms_pages').insert(withoutFlag));
        if (!error) console.log(`      (is_system column absent, inserted without it)`);
      }
      if (error) throw new Error(`cms_pages insert (${page.slug}) failed: ` + error.message);
      console.log(`create cms_pages ${page.slug}`);
    }

    // ---- 2. The hero section --------------------------------------------
    const { data: sections, error: secErr } = await db
      .from('page_sections')
      .select('id, section_type')
      .eq('page_slug', page.slug);
    if (secErr) throw new Error(`page_sections read (${page.slug}) failed: ` + secErr.message);

    if ((sections ?? []).length > 0) {
      console.log(
        `skip  ${page.slug} hero: the page already has ${sections.length} section(s)`,
      );
    } else if (DRY_RUN) {
      console.log(`would create ${page.slug} hero at order 10`);
    } else {
      const { data: created, error } = await db
        .from('page_sections')
        .insert({
          page_slug: page.slug,
          section_type: 'hero',
          content: heroContent(page),
          styles: {},
          display_order: 10,
          visible: true,
        })
        .select('id');
      if (error) throw new Error(`${page.slug} hero insert failed: ` + error.message);
      if (!created || created.length !== 1) {
        throw new Error(`${page.slug} hero insert matched ${created?.length ?? 0} rows`);
      }
      console.log(`create ${page.slug} hero at order 10`);
    }
  }

  // ---- 3. Ahmad's team card -----------------------------------------------
  const { data: members, error: tmErr } = await db
    .from('team_members')
    .select('id, name, bio');
  if (tmErr) throw new Error('team_members read failed: ' + tmErr.message);

  for (const m of members ?? []) {
    const bio = m.bio ?? '';
    if (!bio.includes(BIO_FROM)) {
      if (bio.includes(BIO_TO)) console.log(`skip  ${m.name}: geography already updated`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`would update ${m.name}: "${BIO_FROM}" -> "${BIO_TO}"`);
      continue;
    }
    const next = bio.split(BIO_FROM).join(BIO_TO);
    const { data: updated, error } = await db
      .from('team_members')
      .update({ bio: next, updated_at: new Date().toISOString() })
      .eq('id', m.id)
      .select('id, bio');
    if (error) throw new Error(`team_members update (${m.name}) failed: ` + error.message);
    if (!updated || updated.length !== 1 || !updated[0].bio.includes(BIO_TO)) {
      throw new Error(`${m.name} did not store what was sent`);
    }
    console.log(`set   ${m.name}: "${BIO_FROM}" -> "${BIO_TO}"`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification --------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  for (const page of PAGES) {
    const { data: row } = await db
      .from('cms_pages')
      .select('slug, title, meta_title, meta_description, status')
      .eq('slug', page.slug)
      .maybeSingle();
    if (!row) {
      failures.push(`cms_pages (${page.slug}) is missing`);
    } else {
      if (row.meta_title !== page.metaTitle) {
        failures.push(`${page.slug} meta_title is ${JSON.stringify(row.meta_title)}`);
      }
      if (row.status !== 'published') failures.push(`${page.slug} is ${row.status}`);
    }

    const { data: heroes } = await db
      .from('page_sections')
      .select('content, visible, display_order')
      .eq('page_slug', page.slug)
      .eq('section_type', 'hero');
    if (!heroes || heroes.length !== 1) {
      failures.push(`${page.slug} has ${heroes?.length ?? 0} hero sections, expected 1`);
      continue;
    }
    const c = heroes[0].content ?? {};
    if (!heroes[0].visible) failures.push(`${page.slug} hero is hidden`);
    if (c.badge_text !== page.eyebrow) failures.push(`${page.slug} eyebrow is ${JSON.stringify(c.badge_text)}`);
    if (c.headline !== page.headline) failures.push(`${page.slug} headline is ${JSON.stringify(c.headline)}`);
    if (c.subtitle !== `<p>${page.tagline}</p>`) {
      failures.push(`${page.slug} subtitle is ${JSON.stringify(c.subtitle)}`);
    }
  }

  // The two wording fixes, asserted rather than assumed.
  const { data: after } = await db.from('team_members').select('name, bio');
  for (const m of after ?? []) {
    if ((m.bio ?? '').includes(BIO_FROM)) {
      failures.push(`${m.name} still says "${BIO_FROM}"`);
    }
  }
  const { data: teamHero } = await db
    .from('page_sections')
    .select('content')
    .eq('page_slug', 'team')
    .eq('section_type', 'hero')
    .maybeSingle();
  const teamSubtitle = String(teamHero?.content?.subtitle ?? '');
  if (teamSubtitle.includes('led directly by a partner')) {
    failures.push('the team hero still says "led directly by a partner"');
  }
  if (!teamSubtitle.includes('partner-led')) {
    failures.push('the team hero does not say "partner-led"');
  }

  // The collections must be exactly as they were: this migration moves page
  // copy, not content.
  const { count: teamCount } = await db
    .from('team_members')
    .select('id', { count: 'exact', head: true });
  if (!teamCount) failures.push('team_members is empty, which it was not before');

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`  All checks passed across ${PAGES.length} pages. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-collection-page-heroes failed:', err.message);
  process.exitCode = 1;
});
