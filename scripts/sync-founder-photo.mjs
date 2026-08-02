// scripts/sync-founder-photo.mjs
//
// Applies migration 037_sync_founder_photo.sql through supabase-js.
//
// Copies the founder portrait from the profile page's `founder_hero` onto every
// `founder_block` card whose photo_url is still empty. The URL is read from the
// database, never hardcoded, so a rebuild against a different Supabase project
// picks up that project's storage URL and a database with no portrait yet is a
// no-op.
//
//   node scripts/sync-founder-photo.mjs           apply
//   node scripts/sync-founder-photo.mjs --dry-run report only
//   npm run sync-founder-photo
//
// Idempotent: a second run finds nothing empty left to fill. Never overwrites a
// card that has been given a different image on purpose.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

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

  // Source: the most recently updated founder_hero that actually has a portrait.
  const { data: heroes, error: heroErr } = await db
    .from('page_sections')
    .select('page_slug, content, updated_at')
    .eq('section_type', 'founder_hero')
    .order('updated_at', { ascending: false });
  if (heroErr) throw new Error('hero lookup failed: ' + heroErr.message);

  const source = (heroes ?? []).find(
    (h) => typeof h.content?.photo_url === 'string' && h.content.photo_url.trim() !== '',
  );
  if (!source) {
    console.log('No founder_hero carries a portrait yet. Nothing to copy.');
    return;
  }
  const photoUrl = source.content.photo_url;
  console.log(`Source: ${source.page_slug} founder_hero`);
  console.log(`Photo:  ${photoUrl}\n`);

  const { data: cards, error: cardErr } = await db
    .from('page_sections')
    .select('id, page_slug, display_order, content')
    .eq('section_type', 'founder_block')
    .order('page_slug');
  if (cardErr) throw new Error('card lookup failed: ' + cardErr.message);

  let filled = 0;
  let skipped = 0;
  for (const card of cards ?? []) {
    const current = typeof card.content?.photo_url === 'string' ? card.content.photo_url.trim() : '';
    if (current !== '') {
      skipped += 1;
      const same = current === photoUrl;
      console.log(
        `  skip  ${card.page_slug}/${card.display_order}: already set${same ? ' (same photo)' : ' to a DIFFERENT image, left alone'}`,
      );
      continue;
    }
    console.log(`  ${DRY_RUN ? 'would fill' : 'fill '} ${card.page_slug}/${card.display_order}`);
    if (DRY_RUN) {
      filled += 1;
      continue;
    }
    const next = { ...(card.content ?? {}), photo_url: photoUrl };
    const { data: updated, error } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', card.id)
      .select('id, content');
    if (error) throw new Error(`update ${card.page_slug} failed: ` + error.message);
    // Confirm the write rather than assume it, per the lesson from the
    // alignment seed that reported success on a row it had not changed.
    if (!updated || updated.length !== 1) {
      throw new Error(`update ${card.page_slug} matched ${updated?.length ?? 0} rows, expected 1`);
    }
    if (updated[0].content?.photo_url !== photoUrl) {
      throw new Error(`update ${card.page_slug} stored something other than what was sent`);
    }
    filled += 1;
  }

  console.log(
    `\n${DRY_RUN ? 'Would fill' : 'Filled'} ${filled} founder card${filled === 1 ? '' : 's'}, skipped ${skipped}`,
  );

  if (!DRY_RUN) {
    const { data: final } = await db
      .from('page_sections')
      .select('page_slug, content')
      .eq('section_type', 'founder_block');
    const empty = (final ?? []).filter(
      (c) => !c.content?.photo_url || String(c.content.photo_url).trim() === '',
    );
    if (empty.length) {
      console.error(
        `FAILED: ${empty.length} card(s) still without a portrait: ${empty.map((c) => c.page_slug).join(', ')}`,
      );
      process.exitCode = 1;
      return;
    }
    console.log('Read-back confirms every founder card has a portrait. COMPLETE');
  }
}

main().catch((err) => {
  console.error('sync-founder-photo failed:', err.message);
  process.exitCode = 1;
});
