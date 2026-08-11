// scripts/seed-restore-founder-card.mjs
//
// Applies migration 046_restore_home_founder_card.sql through supabase-js.
//
// Restores the full founder card on home, which migration 045 replaced with a
// short paragraphs mention while merging /about away:
//   * founder_block at display_order 80, where the mention sat, so the home
//     sequence is otherwise unchanged.
//   * partner-led framing, credentials line, two-paragraph bio and the five
//     career proof points, as they stood before the merge.
//   * portrait read from the founder_hero on /about/ahmad-din rather than
//     hardcoded, so a rebuild on another Supabase project resolves that
//     project's own storage URL.
//   * CTAs: "Read the full profile" to /about/ahmad-din, "Book a Meeting" to
//     /book.
//   * the paragraphs mention is deleted, so the two do not sit together.
//
//   node scripts/seed-restore-founder-card.mjs           apply
//   node scripts/seed-restore-founder-card.mjs --dry-run report only
//   npm run seed-restore-founder-card
//
// Idempotent: the card is only inserted when home carries no founder_block, and
// the delete is a no-op once the mention is gone. Safe to re-run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** Heading of the paragraphs mention that 045 put in the card's place. */
const MENTION_HEADING = 'Led by Ahmad Din, founding partner.';

/** Everything except photo_url, which is read from the founder_hero at run time. */
const CARD = {
  eyebrow: 'PARTNER-LED DELIVERY',
  headline: 'Every mandate is partner-led.',
  name: 'Ahmad Din',
  credentials_line:
    'Founding Partner · ACCA Member (UK) · FMVA® Certified · 12+ Years · KSA, GCC, Pakistan',
  bio_html:
    '<p>At many boutique firms the partner wins the engagement and hands the work to a junior team. PaceMakers is structured the other way. Ahmad Din, the firm\'s founding partner, wins and leads every mandate, and reviews every deliverable personally before it reaches a client. Analysts and associates are engaged for each engagement as the work requires.</p>' +
    '<p>That is the model sophisticated capital allocators expect: senior judgment on every line of the model, every assumption, and every recommendation, with the capacity to resource the work properly.</p>',
  // His career figures, not the firm's. They are labelled as such and they live
  // on his card for that reason. The firm's own numbers stay in the stats block.
  credentials: [
    '200+ advisory engagements across his career',
    '200+ business valuations delivered',
    'SAR 20B+ real estate NAV modeled',
    'SAR 300M+ capital deployed via equity research',
    'ACWA Power Central Asia renewables and Saudi Aramco-backed industrial projects',
  ],
  cta_primary_label: 'Read the full profile',
  cta_primary_href: '/about/ahmad-din',
  cta_secondary_label: 'Book a Meeting',
  cta_secondary_href: '/book',
  layout: 'image_left',
};

const CARD_ORDER = 80;

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

async function homeSections() {
  const { data, error } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', 'home')
    .order('display_order');
  if (error) throw new Error(`read home: ${error.message}`);
  return data ?? [];
}

/**
 * Read the portrait from whichever founder_hero carries one. Deliberately not
 * hardcoded: on a rebuild against another Supabase project this resolves that
 * project's storage URL, and on a fresh database with no upload yet it returns
 * an empty string, so the card renders its monogram rather than a broken image.
 */
async function founderPhotoUrl() {
  const { data, error } = await db
    .from('page_sections')
    .select('content, updated_at')
    .eq('section_type', 'founder_hero')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`read founder_hero: ${error.message}`);
  for (const row of data ?? []) {
    const url = row.content?.photo_url;
    if (typeof url === 'string' && url.trim()) return url;
  }
  return '';
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- 1. the card ----------------------------------------------------------
  console.log('=== home founder card ===');
  const before = await homeSections();
  const existing = before.find((r) => r.section_type === 'founder_block');
  const photoUrl = await founderPhotoUrl();

  if (existing) {
    console.log('  skip  founder_block already on home, leaving it alone');
  } else {
    act(
      `add founder_block at ${CARD_ORDER} ` +
        (photoUrl ? 'with the portrait from the founder profile hero' : 'with NO portrait (none uploaded, monogram fallback)'),
    );
    if (!photoUrl) {
      console.log('  WARN  no founder_hero carries a photo_url, so the card will render its monogram');
    }
    if (!DRY_RUN) {
      const { error } = await db.from('page_sections').insert({
        page_slug: 'home',
        section_type: 'founder_block',
        content: { ...CARD, photo_url: photoUrl },
        styles: {},
        display_order: CARD_ORDER,
        visible: true,
      });
      if (error) throw new Error(`insert founder_block: ${error.message}`);
    }
  }

  // ---- 2. the mention it replaces -------------------------------------------
  console.log('\n=== the paragraphs mention it replaces ===');
  const mention = (await homeSections()).find(
    (r) => r.section_type === 'paragraphs' && r.content?.heading === MENTION_HEADING,
  );
  if (!mention) {
    console.log('  skip  mention already removed');
  } else {
    act(`delete the paragraphs mention "${MENTION_HEADING}"`);
    if (!DRY_RUN) {
      const { error } = await db.from('page_sections').delete().eq('id', mention.id);
      if (error) throw new Error(`delete mention: ${error.message}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];
  const after = await homeSections();

  const order = after.map((r) =>
    r.section_type === 'paragraphs' ? `paragraphs(${r.content?.heading})` : r.section_type,
  );
  console.log('  home: ' + order.join(' | '));

  const expected = [
    'hero',
    'paragraphs(A boutique by design.)',
    'service_cards',
    'stats_block',
    'founder_credentials',
    'service_cards',
    'process_steps',
    'founder_block',
    'text_image',
    'quote',
    'cta_block',
  ];
  if (JSON.stringify(order) !== JSON.stringify(expected)) {
    failures.push('home order does not match the target sequence');
  }

  const card = after.find((r) => r.section_type === 'founder_block');
  if (!card) {
    failures.push('no founder_block on home');
  } else {
    const c = card.content ?? {};
    if (card.display_order !== CARD_ORDER) {
      failures.push(`card at ${card.display_order}, expected ${CARD_ORDER}`);
    }
    if (!c.photo_url) failures.push('card has no photo_url, so it renders the monogram');
    if (c.photo_url && c.photo_url !== photoUrl) {
      failures.push('card photo_url does not match the founder profile hero');
    }
    if (!Array.isArray(c.credentials) || c.credentials.length !== CARD.credentials.length) {
      failures.push('proof-point list is missing or the wrong length');
    }
    if (!c.credentials_line) failures.push('credentials line missing');
    if (!c.bio_html) failures.push('bio missing');
    if (c.cta_primary_href !== '/about/ahmad-din') failures.push('primary CTA does not point at the profile');
    if (c.cta_secondary_href !== '/book') failures.push('secondary CTA does not point at /book');
    // 044 moved the site off "Ahmad leads every mandate" on purpose.
    const blob = `${c.eyebrow} ${c.headline} ${c.bio_html}`;
    if (!/partner-led/i.test(`${c.eyebrow} ${c.headline}`)) {
      failures.push('partner-led framing missing from the eyebrow and headline');
    }
    if (/Ahmad leads (the|every)/i.test(blob)) {
      failures.push('copy reverted to founder-led rather than partner-led phrasing');
    }
    // Escaped rather than literal, so this detector does not itself trip the
    // repo-wide em dash gate.
    if (/[\u2013\u2014]/.test(JSON.stringify(c))) {
      failures.push('em or en dash in the card content');
    }
  }

  if (after.some((r) => r.content?.heading === MENTION_HEADING)) {
    failures.push('the paragraphs mention is still on home alongside the card');
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-restore-founder-card failed:', err.message);
  process.exitCode = 1;
});
