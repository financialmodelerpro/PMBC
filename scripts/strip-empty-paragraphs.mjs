// scripts/strip-empty-paragraphs.mjs
//
// Applies migration 036_strip_empty_paragraphs.sql through supabase-js.
//
// Walks every page_sections row and removes paragraphs that render as nothing,
// using the same rules as the application (mirrored from lib/cms/richText.ts).
// Rendering already strips these, so the public site is correct either way;
// this makes the STORED value agree, so the admin editor shows an author the
// same thing a visitor sees.
//
//   node scripts/strip-empty-paragraphs.mjs           apply
//   node scripts/strip-empty-paragraphs.mjs --dry-run report only
//   npm run strip-empty-paragraphs
//
// Idempotent: a second run finds nothing to change.

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

// Mirrors lib/cms/richText.ts. Kept in step by hand: this is a one-off cleanup
// script, and importing TypeScript from a plain .mjs would need a build step.
function isVisuallyEmpty(inner) {
  if (/<(img|hr|iframe|video|audio|svg|canvas|object|embed)\b/i.test(inner)) return false;
  const text = inner
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/ /g, ' ')
    .trim();
  return text.length === 0;
}

function collapseEmptyParagraphs(html) {
  if (!html || !html.includes('<p')) return html;
  return html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) =>
    isVisuallyEmpty(inner) ? '' : match,
  );
}

function normalizeDeep(value) {
  if (typeof value === 'string') return collapseEmptyParagraphs(value);
  if (Array.isArray(value)) return value.map(normalizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDeep(v);
    return out;
  }
  return value;
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
    .select('id, page_slug, section_type, display_order, content')
    .order('page_slug');
  if (error) throw new Error('lookup failed: ' + error.message);

  let scanned = 0;
  let changed = 0;
  let removed = 0;

  for (const row of rows ?? []) {
    scanned += 1;
    const before = JSON.stringify(row.content ?? {});
    const next = normalizeDeep(row.content ?? {});
    const after = JSON.stringify(next);
    if (before === after) continue;

    // Count what came out, purely so the report is meaningful.
    const beforeP = (before.match(/<p\b/g) || []).length;
    const afterP = (after.match(/<p\b/g) || []).length;
    removed += beforeP - afterP;
    changed += 1;
    console.log(
      `  ${DRY_RUN ? 'would clean' : 'cleaned'} ${row.page_slug}/${row.display_order} ` +
        `${row.section_type}: ${beforeP - afterP} empty paragraphs`,
    );

    if (DRY_RUN) continue;

    const { data: updated, error: updErr } = await db
      .from('page_sections')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id, content');
    if (updErr) throw new Error(`update ${row.id} failed: ` + updErr.message);
    // Confirm the write rather than assume it, per the lesson from the
    // alignment seed that reported success on a row it had not changed.
    if (!updated || updated.length !== 1) {
      throw new Error(`update ${row.id} matched ${updated?.length ?? 0} rows, expected 1`);
    }
    if (JSON.stringify(updated[0].content) !== after) {
      throw new Error(`update ${row.id} stored something other than what was sent`);
    }
  }

  console.log(
    `\nScanned ${scanned} sections, ${DRY_RUN ? 'would clean' : 'cleaned'} ${changed}, ` +
      `${removed} empty paragraphs removed`,
  );

  if (!DRY_RUN) {
    // Independent read-back across the whole table.
    const { data: final } = await db.from('page_sections').select('content');
    const leftover = (final ?? []).filter(
      (r) => JSON.stringify(normalizeDeep(r.content ?? {})) !== JSON.stringify(r.content ?? {}),
    ).length;
    if (leftover > 0) {
      console.error(`FAILED: ${leftover} sections still carry empty paragraphs`);
      process.exitCode = 1;
      return;
    }
    console.log('Read-back confirms no empty paragraphs remain. COMPLETE');
  }
}

main().catch((err) => {
  console.error('strip-empty-paragraphs failed:', err.message);
  process.exitCode = 1;
});
