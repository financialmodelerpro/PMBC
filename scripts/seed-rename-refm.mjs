// scripts/seed-rename-refm.mjs
//
// Applies migration 047_rename_real_estate_service.sql through supabase-js.
//
// Renames service 06 to "Real Estate Financial Modeling" and moves it from
// /services/real-estate-modeling to /services/refm, across all four places the
// slug is a join key:
//
//   cms_pages.slug        service-real-estate-modeling -> service-refm
//   cms_content.section   service_real-estate-modeling -> service_refm  (9 rows)
//   services.slug         real-estate-modeling         -> refm
//   page_sections         the home card's title and its /services/<slug> link
//
// The static SERVICES config is the fifth place and is changed in code, not
// here. The old URL 301s in next.config.ts.
//
//   node scripts/seed-rename-refm.mjs           apply
//   node scripts/seed-rename-refm.mjs --dry-run report only
//   npm run seed-rename-refm
//
// Idempotent: every step is guarded on the old value, so a second run does
// nothing and a partially applied run completes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const OLD_SLUG = 'real-estate-modeling';
const NEW_SLUG = 'refm';
const OLD_TITLE = 'Real Estate Modeling';
const NEW_TITLE = 'Real Estate Financial Modeling';
const OLD_PATH = `/services/${OLD_SLUG}`;
const NEW_PATH = `/services/${NEW_SLUG}`;

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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 1. cms_pages ---------------------------------------------------------
  console.log('=== cms_pages ===');
  {
    const { data: row } = await db
      .from('cms_pages')
      .select('id, slug, title, meta_title')
      .eq('slug', `service-${OLD_SLUG}`)
      .maybeSingle();
    if (!row) {
      console.log('  skip  already renamed or absent');
    } else {
      act(`rename ${row.slug} -> service-${NEW_SLUG}, title -> "${NEW_TITLE}"`);
      if (!DRY_RUN) {
        const { error } = await db
          .from('cms_pages')
          .update({
            slug: `service-${NEW_SLUG}`,
            title: NEW_TITLE,
            meta_title: `${NEW_TITLE} | PaceMakers Business Consultants`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (error) throw new Error('cms_pages: ' + error.message);
      }
    }
  }

  // ---- 2. cms_content namespace ---------------------------------------------
  // The one that fails silently if missed: the live route would render with an
  // empty description and no deliverables, and nothing would report an error.
  console.log('\n=== cms_content namespace ===');
  {
    const { data: rows } = await db
      .from('cms_content')
      .select('id, key')
      .eq('section', `service_${OLD_SLUG}`);
    if (!rows?.length) {
      console.log('  skip  already renamed or absent');
    } else {
      act(`move ${rows.length} row(s) from service_${OLD_SLUG} to service_${NEW_SLUG}: ${rows.map((r) => r.key).join(', ')}`);
      if (!DRY_RUN) {
        const { error } = await db
          .from('cms_content')
          .update({ section: `service_${NEW_SLUG}`, updated_at: new Date().toISOString() })
          .eq('section', `service_${OLD_SLUG}`);
        if (error) throw new Error('cms_content: ' + error.message);
      }
    }
  }

  // ---- 3. services collection -----------------------------------------------
  console.log('\n=== services collection ===');
  {
    const { data: row } = await db
      .from('services')
      .select('id, slug, title')
      .eq('slug', OLD_SLUG)
      .maybeSingle();
    if (!row) {
      console.log('  skip  already renamed or absent');
    } else {
      act(`rename services row "${row.title}" -> "${NEW_TITLE}", slug -> ${NEW_SLUG}`);
      if (!DRY_RUN) {
        const { error } = await db
          .from('services')
          .update({ slug: NEW_SLUG, title: NEW_TITLE, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) throw new Error('services: ' + error.message);
      }
    }
  }

  // ---- 4. service cards in page_sections ------------------------------------
  // Scanned across every page rather than just home: a card linking to this
  // service could have been added anywhere in the builder.
  console.log('\n=== service cards ===');
  {
    const { data: rows } = await db
      .from('page_sections')
      .select('id, page_slug, section_type, content')
      .eq('section_type', 'service_cards');
    let touched = 0;
    for (const row of rows ?? []) {
      const cards = Array.isArray(row.content?.cards) ? row.content.cards : [];
      const hit = cards.some((c) => c?.link === OLD_PATH || c?.title === OLD_TITLE);
      if (!hit) continue;
      touched += 1;
      act(`update the card on "${row.page_slug}" to "${NEW_TITLE}" -> ${NEW_PATH}`);
      if (DRY_RUN) continue;
      const next = cards.map((c) =>
        c?.link === OLD_PATH || c?.title === OLD_TITLE
          ? { ...c, link: NEW_PATH, title: NEW_TITLE }
          : c,
      );
      const { error } = await db
        .from('page_sections')
        .update({
          content: { ...row.content, cards: next },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw new Error('page_sections: ' + error.message);
    }
    if (!touched) console.log('  skip  no service card references the old slug or title');
  }

  // ---- 5. anything else, anywhere -------------------------------------------
  // The brief was explicit about not trusting the obvious places, so this
  // sweeps every content-bearing table for a leftover rather than assuming the
  // four steps above were exhaustive.
  console.log('\n=== sweep for leftovers ===');
  const leftovers = await sweep(db);
  if (DRY_RUN) {
    console.log(`  ${leftovers.length} row(s) currently mention the old slug or title`);
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }
  if (leftovers.length) {
    for (const l of leftovers) console.log('  LEFTOVER ' + l);
  } else {
    console.log('  clean, nothing mentions the old slug or title');
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: page } = await db
    .from('cms_pages')
    .select('slug, title, meta_title')
    .eq('slug', `service-${NEW_SLUG}`)
    .maybeSingle();
  if (!page) failures.push('cms_pages row for service-refm missing');
  else {
    if (page.title !== NEW_TITLE) failures.push(`cms_pages.title is "${page.title}"`);
    if (!page.meta_title?.startsWith(NEW_TITLE)) {
      failures.push(`cms_pages.meta_title is "${page.meta_title}"`);
    }
  }

  const { data: content } = await db
    .from('cms_content')
    .select('key')
    .eq('section', `service_${NEW_SLUG}`);
  if ((content?.length ?? 0) !== 9) {
    failures.push(`expected 9 cms_content rows under service_refm, found ${content?.length ?? 0}`);
  }
  const body = content?.find((r) => r.key === 'full_description');
  if (!body) failures.push('full_description missing from the renamed namespace');

  const { data: svc } = await db
    .from('services')
    .select('slug, title, status')
    .eq('slug', NEW_SLUG)
    .maybeSingle();
  if (!svc) failures.push('services row for refm missing');
  else if (svc.title !== NEW_TITLE) failures.push(`services.title is "${svc.title}"`);

  if (leftovers.length) failures.push(`${leftovers.length} row(s) still mention the old slug or title`);

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

/** Every content-bearing table, scanned for the old slug or the old title. */
export async function sweep(client) {
  const TABLES = [
    'cms_pages',
    'cms_content',
    'page_sections',
    'services',
    'site_pages',
    'site_settings',
    'branding_config',
    'case_studies',
    'articles',
    'testimonials',
    'team_members',
    'email_templates',
  ];
  // `contact_submissions` is deliberately excluded. A submission records what
  // the enquirer actually picked at the time, so rewriting it would falsify a
  // record of something that happened.
  const needles = [OLD_SLUG, OLD_TITLE];
  const out = [];
  for (const t of TABLES) {
    const { data, error } = await client.from(t).select('*');
    if (error) continue;
    for (const row of data ?? []) {
      const blob = JSON.stringify(row);
      if (needles.some((n) => blob.includes(n))) {
        out.push(`${t} [${row.id ?? row.slug ?? ''}] ${row.section ? 'section=' + row.section : ''}${row.page_slug ? 'page=' + row.page_slug : ''}`);
      }
    }
  }
  return out;
}

main().catch((err) => {
  console.error('seed-rename-refm failed:', err.message);
  process.exitCode = 1;
});
