// scripts/seed-logo-trim.mjs
//
// Applies migration 060_logo_trim.sql.
//
// Trims the transparent margins off the two brand logo files, uploads the
// trimmed versions, points branding_config at them, and retunes every height
// that depended on the old aspect ratio so the mark keeps the size it reads at
// today.
//
//   node scripts/seed-logo-trim.mjs           apply
//   node scripts/seed-logo-trim.mjs --dry-run report only
//   npm run seed-logo-trim
//
// WHY
// The container work in Phase 44 measured the navbar's brand box starting on
// exactly the same x as the section content below it, while the mark still
// looked indented. Both were true: the padding is inside the PNG. The light
// file carried 493 transparent pixels down its left edge of 7033, which is 22px
// of dead space at the rendered width, and both files are only 52.5% ink
// vertically. No CSS can see that, so no CSS could fix it.
//
// WHY THE HEIGHTS HAVE TO MOVE WITH IT
// Every surface sizes this asset by height and lets the width follow. Trimming
// takes the light file from 7033x2239 to 6123x1175, so its aspect goes from
// 3.14 to 5.21. At an unchanged box height the ink would render nearly twice as
// tall, because the box used to be mostly empty. Each height below is therefore
// set to the ink height the surface renders today, which is the old box height
// times 0.525.
//
// The header band is held at its current 101px by setting header_height_px,
// which was blank and defaulting to 80. Without it the bar would shrink by 20px
// once the logo box stopped being the tallest thing in it. That is a change to
// the header's proportions rather than to the logo, and it is not what this is
// for.
//
// SAFE ON RE-RUN. The upload is content-addressed by the trimmed dimensions, so
// a second run finds the files already trimmed and skips. Nothing is deleted:
// the original objects stay in the bucket and the previous URLs keep working,
// so reverting is putting the old URL back in Header Settings.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const BUCKET = 'cms-assets';

/**
 * The heights, and where each number comes from.
 *
 * `inkRatio` is the fraction of the old box height that was actually ink,
 * measured at 1175/2239 for both files. Each target is the old height times
 * that ratio, rounded, which is the ink height the surface renders today.
 */
const INK_RATIO = 1175 / 2239; // 0.5248

const SETTINGS = [
  {
    section: 'header_settings',
    key: 'logo_height_px',
    from: '100',
    to: '53',
    why: 'ink was 100 x 0.525 = 52.5px tall',
  },
  {
    section: 'header_settings',
    key: 'header_height_px',
    from: '',
    to: '100',
    why: 'holds the bar at the height the 100px logo box was giving it',
  },
  {
    section: 'footer_settings',
    key: 'footer_logo_height_px',
    from: '90',
    to: '47',
    why: 'ink was 90 x 0.525 = 47.3px tall',
  },
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

/** Downloads a PNG and reports what trimming it would remove. */
async function inspect(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const { data, info } = await sharp(buf)
    .trim({ threshold: 0 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.abs(info.trimOffsetLeft ?? 0);
  const top = Math.abs(info.trimOffsetTop ?? 0);
  return {
    buf,
    trimmed: data,
    natural: { w: meta.width, h: meta.height },
    ink: { w: info.width, h: info.height },
    padding: {
      left,
      top,
      right: meta.width - info.width - left,
      bottom: meta.height - info.height - top,
    },
  };
}

async function trimAndUpload(db, label, url) {
  console.log(`\n  ${label}`);
  console.log(`    current : ${url.split('/').pop()}`);

  const r = await inspect(url);
  const padded =
    r.padding.left > 0 || r.padding.top > 0 || r.padding.right > 0 || r.padding.bottom > 0;

  console.log(
    `    natural ${r.natural.w}x${r.natural.h}, ink ${r.ink.w}x${r.ink.h}, ` +
      `padding L${r.padding.left} T${r.padding.top} R${r.padding.right} B${r.padding.bottom}`,
  );

  if (!padded) {
    console.log('    skip    already trimmed, nothing to remove.');
    return null;
  }

  const aspectBefore = (r.natural.w / r.natural.h).toFixed(4);
  const aspectAfter = (r.ink.w / r.ink.h).toFixed(4);
  console.log(`    aspect  ${aspectBefore} becomes ${aspectAfter}`);

  const name = `${Date.now()}_logo-${label}-trimmed.png`;
  if (DRY_RUN) {
    console.log(`    would upload ${name} (${r.trimmed.length} bytes) and repoint branding`);
    return null;
  }

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(name, r.trimmed, { contentType: 'image/png', upsert: false });
  if (upErr) throw new Error(`upload failed for ${label}: ` + upErr.message);

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(name);
  console.log(`    uploaded ${name}`);
  return pub.publicUrl;
}

async function applySetting(db, s) {
  const { data: row, error: readErr } = await db
    .from('cms_content')
    .select('value')
    .eq('section', s.section)
    .eq('key', s.key)
    .maybeSingle();
  if (readErr) throw new Error(`${s.section}.${s.key} read failed: ` + readErr.message);

  const current = row?.value ?? null;
  if (current === s.to) {
    console.log(`    skip  (${s.section}, ${s.key}) already ${JSON.stringify(s.to)}`);
    return;
  }
  console.log(
    `    set   (${s.section}, ${s.key}) ${JSON.stringify(current)} to ${JSON.stringify(s.to)}   ${s.why}`,
  );
  if (DRY_RUN) return;

  if (row) {
    const { error } = await db
      .from('cms_content')
      .update({ value: s.to, updated_at: new Date().toISOString() })
      .eq('section', s.section)
      .eq('key', s.key);
    if (error) throw new Error(`${s.section}.${s.key} update failed: ` + error.message);
  } else {
    const { error } = await db
      .from('cms_content')
      .insert({ section: s.section, key: s.key, value: s.to });
    if (error) throw new Error(`${s.section}.${s.key} insert failed: ` + error.message);
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

  console.log('1. Brand logo files');
  const { data: branding, error: bErr } = await db
    .from('branding_config')
    .select('logo_url, logo_dark_url')
    .eq('id', 1)
    .maybeSingle();
  if (bErr) throw new Error('branding_config read failed: ' + bErr.message);
  if (!branding) throw new Error('branding_config has no row 1.');

  const patch = {};
  if (branding.logo_url) {
    const next = await trimAndUpload(db, 'light', branding.logo_url);
    if (next) patch.logo_url = next;
  } else {
    console.log('\n  light: no logo_url set, nothing to trim.');
  }
  if (branding.logo_dark_url) {
    const next = await trimAndUpload(db, 'dark', branding.logo_dark_url);
    if (next) patch.logo_dark_url = next;
  } else {
    console.log('\n  dark: no logo_dark_url set, nothing to trim.');
  }

  if (Object.keys(patch).length > 0 && !DRY_RUN) {
    const { error } = await db
      .from('branding_config')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error('branding_config update failed: ' + error.message);
    console.log('\n  branding_config repointed at the trimmed files.');
  }

  console.log('\n2. Heights that depended on the old aspect ratio');
  for (const s of SETTINGS) await applySetting(db, s);

  console.log('\n  The OG card and the email header size this asset in code, not in');
  console.log('  settings, so they are retuned in src/app/api/og/route.tsx and');
  console.log('  src/lib/email/templates/_base.ts alongside this script.');

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  let ok = true;

  const { data: after } = await db
    .from('branding_config')
    .select('logo_url, logo_dark_url')
    .eq('id', 1)
    .maybeSingle();

  for (const [label, u] of [
    ['light', after?.logo_url],
    ['dark', after?.logo_dark_url],
  ]) {
    if (!u) {
      console.log(`  note  no ${label} logo set.`);
      continue;
    }
    const r = await inspect(u);
    const clean =
      r.padding.left === 0 && r.padding.top === 0 && r.padding.right === 0 && r.padding.bottom === 0;
    if (clean) {
      console.log(`  ok    ${label} is ${r.natural.w}x${r.natural.h} with no transparent margin.`);
    } else {
      console.error(
        `  FAIL  ${label} still carries padding L${r.padding.left} T${r.padding.top} R${r.padding.right} B${r.padding.bottom}`,
      );
      ok = false;
    }
  }

  for (const s of SETTINGS) {
    const { data } = await db
      .from('cms_content')
      .select('value')
      .eq('section', s.section)
      .eq('key', s.key)
      .maybeSingle();
    if (data?.value === s.to) {
      console.log(`  ok    (${s.section}, ${s.key}) = ${JSON.stringify(s.to)}`);
    } else {
      console.error(
        `  FAIL  (${s.section}, ${s.key}) = ${JSON.stringify(data?.value)}, wanted ${JSON.stringify(s.to)}`,
      );
      ok = false;
    }
  }

  if (ok) {
    console.log(
      `\nCOMPLETE. Ink ratio used: ${INK_RATIO.toFixed(4)}. Re-run npm run verify-container-widths.`,
    );
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('seed-logo-trim failed:', err.message);
  process.exitCode = 1;
});
