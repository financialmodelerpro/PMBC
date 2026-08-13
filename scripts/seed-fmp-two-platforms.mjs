// scripts/seed-fmp-two-platforms.mjs
//
// Applies migration 057_fmp_two_platforms_rows.sql through supabase-js.
//
//   node scripts/seed-fmp-two-platforms.mjs           apply
//   node scripts/seed-fmp-two-platforms.mjs --dry-run report only
//   npm run seed-fmp-two-platforms
//
// Switches the /fmp "Two platforms" block to the rows layout and seeds a blank
// media slot on each card. See the migration header for why the slots are
// empty and why the alternation is not stored per card.
//
// Idempotent and guarded: the write only happens while the section is still on
// the cards layout, so a re-run cannot overwrite a later edit.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'financial-modeler-pro';
const EYEBROW = 'THE TWO HALVES';

/** The media keys each card gains, all blank. */
const MEDIA_KEYS = {
  media_url: '',
  media_type: 'image',
  media_poster_url: '',
  media_alt: '',
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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, section_type, content, display_order')
    .eq('page_slug', PAGE);
  if (error) throw new Error('read: ' + error.message);

  const section = (rows ?? []).find(
    (r) => r.section_type === 'feature_cards' && r.content?.eyebrow === EYEBROW,
  );
  if (!section) {
    console.error(`  FAIL  no "${EYEBROW}" feature_cards section on /${PAGE}`);
    process.exitCode = 1;
    return;
  }

  if (section.content.layout === 'rows') {
    console.log('  skip  the block is already on the rows layout');
  } else {
    const cards = Array.isArray(section.content.cards) ? section.content.cards : [];
    console.log(
      `  ${DRY_RUN ? 'would ' : ''}switch "${EYEBROW}" (${cards.length} cards) to full-width rows and add a blank media slot to each`,
    );
    for (const [i, card] of cards.entries()) {
      console.log(`          row ${i + 1}: ${card.title}, media on the ${i % 2 === 1 ? 'left' : 'right'}`);
    }
    if (!DRY_RUN) {
      const next = {
        ...section.content,
        layout: 'rows',
        // Existing media keys win, so a re-run after an upload cannot blank it.
        cards: cards.map((c) => ({ ...MEDIA_KEYS, ...c })),
      };
      const { error: e } = await db
        .from('page_sections')
        .update({ content: next, updated_at: new Date().toISOString() })
        .eq('id', section.id);
      if (e) throw new Error('update: ' + e.message);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: after } = await db
    .from('page_sections')
    .select('content')
    .eq('id', section.id)
    .maybeSingle();

  const c = after?.content ?? {};
  if (c.layout !== 'rows') failures.push('the layout did not take');
  const cards = Array.isArray(c.cards) ? c.cards : [];
  if (cards.length !== 2) failures.push(`expected 2 cards, found ${cards.length}`);
  for (const [i, card] of cards.entries()) {
    for (const k of Object.keys(MEDIA_KEYS)) {
      if (!(k in card)) failures.push(`card ${i + 1} has no ${k}`);
    }
    if (card.media_url) {
      console.log(`  note  card ${i + 1} already carries media: ${card.media_url}`);
    }
    // The copy has to survive a layout change untouched, which is the whole
    // point of an UPDATE over a delete and reinsert.
    if (!card.title) failures.push(`card ${i + 1} lost its title`);
    if (!Array.isArray(card.bullets) || card.bullets.length === 0) {
      failures.push(`card ${i + 1} lost its bullets`);
    }
    if (!card.cta_href) failures.push(`card ${i + 1} lost its CTA`);
  }

  // Nothing else on the site may have been switched to rows by this.
  const { data: allFeature } = await db
    .from('page_sections')
    .select('page_slug, content')
    .eq('section_type', 'feature_cards');
  const otherRows = (allFeature ?? []).filter(
    (r) => r.content?.layout === 'rows' && r.content?.eyebrow !== EYEBROW,
  );
  if (otherRows.length > 0) {
    failures.push(`another feature_cards block is on the rows layout: ${otherRows.map((r) => r.page_slug).join(', ')}`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  ok    rows layout, 2 cards, blank media slot on each, copy intact. COMPLETE');
}

main().catch((err) => {
  console.error('seed-fmp-two-platforms failed:', err.message);
  process.exitCode = 1;
});
