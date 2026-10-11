// scripts/seed-team-urls-spelling.mjs
//
// Applies migration 104_team_urls_us_spelling.sql through supabase-js:
//   1. Stored links to /about/ahmad-din or /about/kaleem-farooq become
//      /team/ahmad-din and /team/kaleem-farooq: site_pages hrefs, and any
//      page_sections content value that is exactly one of those paths.
//   2. "modelling" to "modeling" in the five sections still carrying it.
//
//   node scripts/seed-team-urls-spelling.mjs           apply
//   node scripts/seed-team-urls-spelling.mjs --dry-run report only
//   npm run seed-team-urls-spelling
//
// Run part 1 only after the deploy that serves the /team/<name> routes. Safe on
// re-run: nothing matches once applied. Every write is read back.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const MOVED = {
  '/about/ahmad-din': '/team/ahmad-din',
  '/about/kaleem-farooq': '/team/kaleem-farooq',
};
const SPELLING_PAGES = [
  'service-refm',
  'service-project-finance',
  'service-transaction-advisory',
  'financial-modeler-pro',
  'insights',
];
const usSpelling = (s) => s.replace(/modelling/g, 'modeling').replace(/Modelling/g, 'Modeling');

/** Replaces string values that are exactly a moved path, at any depth. */
function repoint(value, hits) {
  if (typeof value === 'string') {
    if (value in MOVED) {
      hits.push(value);
      return MOVED[value];
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => repoint(v, hits));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repoint(v, hits)]));
  }
  return value;
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
  let ok = true;

  console.log('1. Stored links to the old profile paths');
  const { data: navRows, error: navErr } = await db.from('site_pages').select('id, label, href');
  if (navErr) throw new Error('site_pages read failed: ' + navErr.message);
  for (const r of (navRows ?? []).filter((r) => r.href in MOVED)) {
    const next = MOVED[r.href];
    if (DRY_RUN) {
      console.log(`  would set site_pages "${r.label}" ${r.href} -> ${next}`);
      continue;
    }
    const { error } = await db.from('site_pages').update({ href: next }).eq('id', r.id).eq('href', r.href);
    if (error) throw new Error('site_pages update failed: ' + error.message);
    const { data: back } = await db.from('site_pages').select('href').eq('id', r.id).single();
    ok &&= back?.href === next;
    console.log(`  ${back?.href === next ? 'ok  ' : 'FAIL'}  site_pages "${r.label}" -> ${next}`);
  }

  const { data: sections, error: secErr } = await db
    .from('page_sections')
    .select('id, page_slug, section_type, content');
  if (secErr) throw new Error('page_sections read failed: ' + secErr.message);
  for (const s of sections ?? []) {
    const hits = [];
    const next = repoint(s.content, hits);
    if (hits.length === 0) continue;
    if (DRY_RUN) {
      console.log(`  would repoint ${hits.length} link(s) in ${s.page_slug} ${s.section_type}`);
      continue;
    }
    const { error } = await db.from('page_sections').update({ content: next }).eq('id', s.id);
    if (error) throw new Error('page_sections update failed: ' + error.message);
    const { data: back } = await db.from('page_sections').select('content').eq('id', s.id).single();
    const good = JSON.stringify(back?.content) === JSON.stringify(next);
    ok &&= good;
    console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${s.page_slug} ${s.section_type}: ${hits.length} link(s)`);
  }

  console.log('\n2. US spelling');
  for (const s of (sections ?? []).filter((s) => SPELLING_PAGES.includes(s.page_slug))) {
    const before = JSON.stringify(s.content);
    const after = usSpelling(before);
    if (before === after) continue;
    const n = (before.match(/[Mm]odelling/g) ?? []).length;
    if (DRY_RUN) {
      console.log(`  would replace ${n} in ${s.page_slug} ${s.section_type}`);
      continue;
    }
    const { error } = await db.from('page_sections').update({ content: JSON.parse(after) }).eq('id', s.id);
    if (error) throw new Error('page_sections update failed: ' + error.message);
    const { data: back } = await db.from('page_sections').select('content').eq('id', s.id).single();
    const good = JSON.stringify(back?.content) === after;
    ok &&= good;
    console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${s.page_slug} ${s.section_type}: ${n} replaced`);
  }

  if (DRY_RUN) console.log('\nDry run, nothing written.');
  else if (ok) console.log('\nCOMPLETE.');
  else process.exitCode = 1;
}

main().catch((err) => {
  console.error('seed-team-urls-spelling failed:', err.message);
  process.exitCode = 1;
});
