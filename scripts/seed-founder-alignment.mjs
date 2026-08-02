// scripts/seed-founder-alignment.mjs
//
// Applies migration 035_founder_prose_alignment.sql through supabase-js.
// The migration file is the record; this is the executable. Same pairing as 034.
//
//   node scripts/seed-founder-alignment.mjs
//   npm run seed-founder-alignment
//
// Idempotent: re-running sets the same value.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const PAGE_SLUG = 'about-ahmad-din';
// The two long-form blocks. Market Focus (70) and Personal (90) are a single
// short paragraph each, where justification has nothing to even out.
const JUSTIFY_ORDERS = [20, 30];

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

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, display_order, content')
    .eq('page_slug', PAGE_SLUG)
    .eq('section_type', 'paragraphs')
    .order('display_order');
  if (error) throw new Error('lookup failed: ' + error.message);

  let changed = 0;
  let wrong = 0;
  for (const row of rows ?? []) {
    const align = JUSTIFY_ORDERS.includes(row.display_order) ? 'justify' : 'left';
    const next = { ...(row.content ?? {}), align };
    // `.select()` so the write is confirmed rather than assumed. An earlier
    // version reported success for a row that came back without the key, and a
    // seed that cannot tell those two apart is not much of a seed.
    const { data: updated, error: updErr } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('display_order, content');
    if (updErr) throw new Error(`update ${row.display_order} failed: ` + updErr.message);
    if (!updated || updated.length !== 1) {
      throw new Error(`update ${row.display_order} matched ${updated?.length ?? 0} rows, expected 1`);
    }
    const got = updated[0].content?.align;
    if (got !== align) {
      wrong += 1;
      console.log(`  ${String(row.display_order).padStart(2)}  MISMATCH: wanted ${align}, stored ${JSON.stringify(got)}`);
      continue;
    }
    changed += 1;
    console.log(`  ${String(row.display_order).padStart(2)}  align = ${align}  (confirmed)`);
  }

  // Independent read-back, after every write, against a fresh query.
  const { data: final } = await db
    .from('page_sections')
    .select('display_order, content')
    .eq('page_slug', PAGE_SLUG)
    .eq('section_type', 'paragraphs')
    .order('display_order');
  const bad = (final ?? []).filter((r) => {
    const want = JUSTIFY_ORDERS.includes(r.display_order) ? 'justify' : 'left';
    return r.content?.align !== want;
  });

  console.log(`\nUpdated ${changed} paragraphs sections on ${PAGE_SLUG}`);
  if (wrong || bad.length) {
    console.error(
      `FAILED: ${wrong} mismatched on write, ${bad.length} wrong on read-back ` +
        `(${bad.map((r) => r.display_order).join(', ')})`,
    );
    process.exitCode = 1;
    return;
  }
  console.log('Read-back confirms every section. SEED COMPLETE');
}

main().catch((err) => {
  console.error('seed-founder-alignment failed:', err.message);
  process.exitCode = 1;
});
