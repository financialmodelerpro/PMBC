// scripts/seed-booking-page.mjs
//
// Applies migration 038_booking_page.sql through supabase-js.
//
// Seeds the /book page: the site-wide Calendly URL in site_settings, the
// cms_pages row, its hero section, the founder profile's booking CTA, and the
// booking copy rows in cms_content.
//
//   node scripts/seed-booking-page.mjs           apply
//   node scripts/seed-booking-page.mjs --dry-run report only
//   npm run seed-booking-page
//
// Idempotent and non-destructive. Every write is guarded the same way the SQL
// guards it: the URL is only seeded when blank, the page and hero only when
// absent, the founder CTA only when its href is empty, and copy rows only when
// the (section, key) pair does not exist. Re-running changes nothing.
//
// Every write is read back and compared before the script reports success,
// following the lesson from the alignment seed that once reported success on a
// row it had not actually changed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Read from FMP's live database on 2026-08-10, not from the example URL in
// FMP's source comments. Same event, so a PMBC prospect and an FMP prospect
// land on the same calendar.
const BOOKING_URL =
  'https://calendly.com/financialmodelerpro/60-minute-modeling-hub-advisory-meeting';

const HERO_CONTENT = {
  badge_text: 'BOOK A MEETING',
  headline: 'Start the conversation.',
  subtitle:
    'A 60 minute introductory call, at no cost and no obligation. We will discuss the mandate, the timeline, and whether PaceMakers is the right firm for it.',
  cta_label: '',
  cta_href: '',
  cta_secondary_label: '',
  cta_secondary_href: '',
};

const COPY_ROWS = [
  ['calendar_eyebrow', 'Select a time'],
  ['fallback_prompt', 'Trouble viewing the calendar?'],
  ['fallback_link_label', 'Open Calendly directly'],
  ['alternatives_label', 'Other ways to reach us'],
  [
    'alternatives_text',
    'You can also write to us directly, or send the mandate details through the contact form.',
  ],
  ['contact_form_label', 'Send a message'],
  ['empty_heading', 'The calendar is being set up'],
  [
    'empty_body',
    'Self-service booking is not live yet. Reach us directly and we will find a time.',
  ],
  ['contact_prompt', 'Prefer to talk?'],
  // Retired by 039, which replaced the subtle contact strip with a callout that
  // reads contact_prompt and contact_callout_cta instead. Kept here so this
  // script still applies 038 faithfully; on a fresh database 039 runs next and
  // removes it. Do not re-run this script on a database already past 039, or
  // the dead key comes back.
  ['contact_link_label', 'Book a meeting directly'],
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

  // ---- 1. site_settings.booking_url ------------------------------------
  const { data: settingsRow, error: settingsErr } = await db
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  if (settingsErr) throw new Error('site_settings read failed: ' + settingsErr.message);

  const settings =
    settingsRow?.settings && typeof settingsRow.settings === 'object' && !Array.isArray(settingsRow.settings)
      ? settingsRow.settings
      : {};
  const currentUrl = String(settings.booking_url ?? '').trim();

  if (currentUrl !== '') {
    console.log(`skip  site_settings.booking_url: already set to ${currentUrl}`);
  } else if (DRY_RUN) {
    console.log(`would set site_settings.booking_url = ${BOOKING_URL}`);
  } else {
    const next = { ...settings, booking_url: BOOKING_URL };
    const { error } = await db
      .from('site_settings')
      .update({ settings: next, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error('site_settings update failed: ' + error.message);
    console.log(`set   site_settings.booking_url = ${BOOKING_URL}`);
  }

  // ---- 2. cms_pages row -------------------------------------------------
  const { data: existingPage, error: pageReadErr } = await db
    .from('cms_pages')
    .select('slug, is_system')
    .eq('slug', 'book')
    .maybeSingle();
  if (pageReadErr) throw new Error('cms_pages read failed: ' + pageReadErr.message);

  if (existingPage) {
    console.log('skip  cms_pages "book": already present');
  } else if (DRY_RUN) {
    console.log('would insert cms_pages "book"');
  } else {
    const { error } = await db.from('cms_pages').insert({
      slug: 'book',
      title: 'Book a Meeting',
      meta_title: 'Book a Meeting | PaceMakers Business Consultants',
      meta_description:
        'Book an introductory call with PaceMakers Business Consultants. No cost, no obligation, and a direct conversation about your mandate.',
      status: 'published',
      is_system: true,
    });
    if (error) throw new Error('cms_pages insert failed: ' + error.message);
    console.log('insert cms_pages "book"');
  }

  // ---- 3. hero section --------------------------------------------------
  const { data: bookSections, error: secReadErr } = await db
    .from('page_sections')
    .select('id, section_type')
    .eq('page_slug', 'book');
  if (secReadErr) throw new Error('page_sections read failed: ' + secReadErr.message);

  if ((bookSections ?? []).length > 0) {
    console.log(`skip  /book hero: page already has ${bookSections.length} section(s)`);
  } else if (DRY_RUN) {
    console.log('would insert /book hero section');
  } else {
    const { error } = await db.from('page_sections').insert({
      page_slug: 'book',
      section_type: 'hero',
      content: HERO_CONTENT,
      styles: {},
      display_order: 10,
      visible: true,
    });
    if (error) throw new Error('hero insert failed: ' + error.message);
    console.log('insert /book hero section');
  }

  // ---- 4. founder profile booking CTA -----------------------------------
  const { data: heroes, error: heroErr } = await db
    .from('page_sections')
    .select('id, page_slug, content')
    .eq('section_type', 'founder_hero');
  if (heroErr) throw new Error('founder_hero read failed: ' + heroErr.message);

  for (const h of heroes ?? []) {
    const href = String(h.content?.cta_secondary_href ?? '').trim();
    if (href !== '') {
      console.log(`skip  founder_hero on ${h.page_slug}: secondary CTA already points at ${href}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`would point founder_hero on ${h.page_slug} at /book`);
      continue;
    }
    const next = {
      ...(h.content ?? {}),
      cta_secondary_label: 'Book a Meeting',
      cta_secondary_href: '/book',
    };
    const { data: updated, error } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', h.id)
      .select('id, content');
    if (error) throw new Error(`founder_hero update failed: ` + error.message);
    if (!updated || updated.length !== 1) {
      throw new Error(`founder_hero update matched ${updated?.length ?? 0} rows, expected 1`);
    }
    if (updated[0].content?.cta_secondary_href !== '/book') {
      throw new Error('founder_hero update stored something other than what was sent');
    }
    console.log(`set   founder_hero on ${h.page_slug}: secondary CTA -> /book`);
  }

  // ---- 5. booking copy rows ---------------------------------------------
  const { data: existingCopy, error: copyErr } = await db
    .from('cms_content')
    .select('key')
    .eq('section', 'booking');
  if (copyErr) throw new Error('cms_content read failed: ' + copyErr.message);
  const have = new Set((existingCopy ?? []).map((r) => r.key));

  const missing = COPY_ROWS.filter(([k]) => !have.has(k));
  if (missing.length === 0) {
    console.log('skip  booking copy: all 10 rows already present');
  } else if (DRY_RUN) {
    console.log(`would insert ${missing.length} booking copy row(s): ${missing.map(([k]) => k).join(', ')}`);
  } else {
    const { error } = await db
      .from('cms_content')
      .insert(missing.map(([k, v]) => ({ section: 'booking', key: k, value: v })));
    if (error) throw new Error('cms_content insert failed: ' + error.message);
    console.log(`insert ${missing.length} booking copy row(s)`);
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- Read-back verification -------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: finalSettings } = await db
    .from('site_settings')
    .select('settings')
    .eq('id', 1)
    .maybeSingle();
  if (!String(finalSettings?.settings?.booking_url ?? '').trim()) {
    failures.push('site_settings.booking_url is still empty');
  }

  const { data: finalPage } = await db
    .from('cms_pages')
    .select('slug, is_system, meta_title')
    .eq('slug', 'book')
    .maybeSingle();
  if (!finalPage) failures.push('cms_pages row "book" is missing');
  else if (finalPage.is_system !== true) failures.push('cms_pages "book" is not marked is_system');

  const { data: finalHero } = await db
    .from('page_sections')
    .select('id, content')
    .eq('page_slug', 'book')
    .eq('section_type', 'hero');
  if (!finalHero || finalHero.length === 0) failures.push('/book has no hero section');

  const { data: finalFounder } = await db
    .from('page_sections')
    .select('page_slug, content')
    .eq('section_type', 'founder_hero');
  for (const h of finalFounder ?? []) {
    if (!String(h.content?.cta_secondary_href ?? '').trim()) {
      failures.push(`founder_hero on ${h.page_slug} still has no booking href`);
    }
  }

  const { data: finalCopy } = await db
    .from('cms_content')
    .select('key')
    .eq('section', 'booking');
  const finalKeys = new Set((finalCopy ?? []).map((r) => r.key));
  for (const [k] of COPY_ROWS) {
    if (!finalKeys.has(k)) failures.push(`cms_content (booking, ${k}) is missing`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log('  All checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-booking-page failed:', err.message);
  process.exitCode = 1;
});
