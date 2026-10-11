// scripts/fix-founder-photo-edge.mjs
//
// Applies migration 103_founder_photo_clean.sql: replaces the founder portrait
// with a cleaned copy.
//
// The portrait uploaded on 2026-08-02 (team-photos/1785670772432_ahmad-din-
// founder.png, 1240 x 1560) has two defects baked into the file itself: its top
// 10 pixel rows are solid brand green, and its top two corners are cut away
// (transparent) for about 30 px below that. Inside the site's frame they show
// as a thin green line and rounded corners. No CSS draws either.
//
// The fix crops the top CROP_TOP rows, which removes both and loses only navy
// background above the head, checks the result has no green row and no
// transparent pixel, uploads it as a NEW file (the original stays in storage,
// so rollback is one field change), and repoints the three fields that hold the
// old URL: Ahmad Din's team_members.photo, the about-ahmad-din founder_hero
// photo_url and the home founder_block photo_url. A field holding any other
// value is left alone.
//
//   node scripts/fix-founder-photo-edge.mjs           apply
//   node scripts/fix-founder-photo-edge.mjs --dry-run crop and check only; the
//                                                      cleaned file is written
//                                                      next to the system temp
//                                                      dir for inspection
//   npm run fix-founder-photo-edge
//
// Safe on re-run: once the fields point at the cleaned file, nothing matches
// the old URL and the script reports that and stops before uploading.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const BUCKET = 'team-photos';
const OLD_PATH = '1785670772432_ahmad-din-founder.png';
const CROP_TOP = 40;

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

/** Fails unless no row is brand green and every pixel is opaque. */
async function checkClean(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparent++;
  const greenRows = [];
  for (let y = 0; y < H; y++) {
    let green = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i] < 90 && data[i + 1] > 150 && data[i + 2] < 120) green++;
    }
    if (green > W * 0.5) greenRows.push(y);
  }
  return { W, H, transparent, greenRows };
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
  const oldUrl = db.storage.from(BUCKET).getPublicUrl(OLD_PATH).data.publicUrl;

  // Where the old URL is still used.
  const { data: members, error: mErr } = await db.from('team_members').select('id, name, photo');
  if (mErr) throw new Error('team_members read failed: ' + mErr.message);
  const memberRefs = (members ?? []).filter((m) => m.photo === oldUrl);

  const { data: sections, error: sErr } = await db
    .from('page_sections')
    .select('id, page_slug, section_type, content')
    .in('section_type', ['founder_hero', 'founder_block']);
  if (sErr) throw new Error('page_sections read failed: ' + sErr.message);
  const sectionRefs = (sections ?? []).filter((s) => s.content?.photo_url === oldUrl);

  console.log(`Old portrait: ${OLD_PATH}`);
  console.log(`  used by ${memberRefs.length} team member(s): ${memberRefs.map((m) => m.name).join(', ') || 'none'}`);
  console.log(
    `  used by ${sectionRefs.length} section(s): ${sectionRefs.map((s) => `${s.page_slug} ${s.section_type}`).join(', ') || 'none'}`,
  );
  if (memberRefs.length + sectionRefs.length === 0) {
    console.log('\nNothing points at the old file. Already applied; nothing to do.');
    return;
  }

  const res = await fetch(oldUrl);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const original = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(original).metadata();
  console.log(`\nOriginal ${meta.width} x ${meta.height}.`);

  // Flattened onto the photo's own bottom navy: after the crop the only
  // non-opaque pixels left are a few at 253 or 254 alpha along the bottom
  // corners, invisible, but a portrait has no reason to carry an alpha channel.
  const cleaned = await sharp(original)
    .extract({ left: 0, top: CROP_TOP, width: meta.width, height: meta.height - CROP_TOP })
    .flatten({ background: { r: 13, g: 32, b: 58 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const check = await checkClean(cleaned);
  console.log(
    `Cleaned ${check.W} x ${check.H}: ${check.greenRows.length} green row(s), ${check.transparent} transparent pixel(s).`,
  );
  if (check.greenRows.length > 0 || check.transparent > 0) {
    throw new Error('the cleaned image still has a green row or a transparent pixel. Nothing uploaded.');
  }

  if (DRY_RUN) {
    const out = path.join(os.tmpdir(), 'ahmad-din-founder-clean.png');
    fs.writeFileSync(out, cleaned);
    console.log(`\nDry run, nothing written to storage or the database. Cleaned file: ${out}`);
    return;
  }

  const newPath = `${Date.now()}_ahmad-din-founder-clean.png`;
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(newPath, cleaned, { contentType: 'image/png', upsert: false });
  if (upErr) throw new Error('upload failed: ' + upErr.message);
  const newUrl = db.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
  const head = await fetch(newUrl, { method: 'HEAD' });
  if (!head.ok) throw new Error(`the uploaded file is not reachable: HTTP ${head.status}`);
  console.log(`\nUploaded ${newPath}.`);

  let ok = true;
  for (const m of memberRefs) {
    const { error } = await db.from('team_members').update({ photo: newUrl }).eq('id', m.id).eq('photo', oldUrl);
    if (error) throw new Error('team_members update failed: ' + error.message);
    const { data: back } = await db.from('team_members').select('photo').eq('id', m.id).single();
    const good = back?.photo === newUrl;
    ok &&= good;
    console.log(`  ${good ? 'ok  ' : 'FAIL'}  team member ${m.name}`);
  }
  for (const s of sectionRefs) {
    const { error } = await db
      .from('page_sections')
      .update({ content: { ...s.content, photo_url: newUrl } })
      .eq('id', s.id);
    if (error) throw new Error('page_sections update failed: ' + error.message);
    const { data: back } = await db.from('page_sections').select('content').eq('id', s.id).single();
    const good = back?.content?.photo_url === newUrl;
    ok &&= good;
    console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${s.page_slug} ${s.section_type}`);
  }

  if (ok) console.log(`\nCOMPLETE. The original stays in storage at ${OLD_PATH} for rollback.`);
  else process.exitCode = 1;
}

main().catch((err) => {
  console.error('fix-founder-photo-edge failed:', err.message);
  process.exitCode = 1;
});
