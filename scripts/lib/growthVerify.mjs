// scripts/lib/growthVerify.mjs
//
// Shared plumbing for the Growth Engine verifiers from Phase 2 on
// (2026-09-23): environment loading, TypeScript imports through jiti, the
// check counter, and the static gates every phase repeats (admin-only routes
// and pages, no dashes, the public site untouched, the Anthropic SDK imported
// in one file only).
//
// A check that needs a migration not yet applied is reported as PENDING, not
// as a failure, with the migration named, so the summary lists exactly what
// is waiting on Ahmad.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createJiti } from 'jiti';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WRITE = process.argv.includes('--write-test-rows');
export const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);

for (const line of fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
export const load = (rel) => jiti.import(path.join(root, rel));

let checks = 0;
let failures = 0;
const pending = [];
export function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}
export function markPending(label, migration) {
  pending.push(`${label} (needs ${migration})`);
  console.log(`  PENDING  ${label}: needs ${migration}`);
}
export function finish(name) {
  console.log('');
  console.log(`${name}: ${checks - failures} of ${checks} checks passed${pending.length ? `, ${pending.length} pending a migration` : ''}.`);
  for (const p of pending) console.log(`  pending: ${p}`);
  if (failures) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
}

/** A file's text with line endings normalised (a Windows checkout has CRLF). */
export const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
export const exists = (rel) => fs.existsSync(path.join(root, rel));

export function walk(relDir, pattern = /\.(ts|tsx)$/) {
  const dir = path.join(root, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .map((f) => path.join(relDir, String(f)).replace(/\\/g, '/'))
    .filter((f) => pattern.test(f) && fs.statSync(path.join(root, f)).isFile());
}

/** Files that contain an em or en dash. */
export function dashed(files) {
  return files.filter((f) => DASHES.test(read(f)));
}

/** Every Growth admin API route calls the owner gate; every Growth page the Growth session gate. */
export function adminOnlyGates() {
  const routes = walk('src/app/api/admin/growth', /route\.ts$/);
  const openRoutes = routes.filter((f) => !/requireOwner\(|ownerRequest\(/.test(read(f)));
  check('every Growth admin API route is admin-only', routes.length > 0 && openRoutes.length === 0, openRoutes.join(', '));
  const pages = walk('src/app/admin/growth', /page\.tsx$/);
  const openPages = pages.filter((f) => !/requireGrowthSession\(|GrowthPlaceholder/.test(read(f)));
  check('every Growth page checks the admin session', pages.length > 0 && openPages.length === 0, openPages.join(', '));
  const sdk = walk('src').filter((f) => read(f).includes('@anthropic-ai/sdk'));
  check('only the provider file imports the Anthropic SDK', sdk.length === 1 && sdk[0] === 'src/lib/growth/ai/anthropic.ts', sdk.join(', '));
}

/** The commit Phase 1 ended on: the public site as it was before Phases 2 to 7. */
export const PHASE1_BASE = '93c3e98';

/**
 * Public files changed since Phase 1. `allowed` lists changes that are
 * deliberate and proven inert elsewhere (the chat widget mount, Phase 4).
 */
export function publicChanges(allowed = []) {
  const paths = ["src/app/(public)", 'src/components/public', 'src/components/layout', 'src/components/seo', 'src/app/globals.css', 'src/app/layout.tsx', 'src/middleware.ts', 'next.config.ts', 'public', 'src/config', 'src/lib/public', 'src/lib/cms'];
  let out = '';
  try {
    out = execSync(`git diff --name-only ${PHASE1_BASE} -- ${paths.map((p) => `"${p}"`).join(' ')}`, { cwd: root, encoding: 'utf8' });
    out += execSync(`git ls-files --others --exclude-standard -- ${paths.map((p) => `"${p}"`).join(' ')}`, { cwd: root, encoding: 'utf8' });
  } catch (err) {
    return [`git diff failed: ${err.message}`];
  }
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !allowed.includes(f))
    .filter((f) => !(REVALIDATE_ONLY.includes(f) && onlyRevalidateAdded(f)));
}

/**
 * Pages given `revalidate = 60` so the site-wide chat reaches them
 * (2026-09-23): allowed only while that line and its comment are the whole
 * change.
 */
export const REVALIDATE_ONLY = ['src/app/(public)/privacy/page.tsx', 'src/app/(public)/terms/page.tsx', 'src/app/(public)/confidentiality/page.tsx'];
function onlyRevalidateAdded(file) {
  let diff = '';
  try {
    diff = execSync(`git diff ${PHASE1_BASE} -- "${file}"`, { cwd: root, encoding: 'utf8' });
  } catch {
    return false;
  }
  const changed = diff.split(/\r?\n/).filter((l) => /^[+-](?![+-])/.test(l));
  return changed.length > 0 && changed.every((l) => l.startsWith('+') && (l === '+' || l === '+export const revalidate = 60;' || l.startsWith('+// Revalidated each minute')));
}

/**
 * The public site guard (2026-09-23). With the website chat switched off,
 * no public page may carry chat markup, the widget script, or any call to a
 * Growth endpoint. GET requests only, against VERIFY_BASE (default the live
 * site): every page in the sitemap plus a few that are not in it, and every
 * script those pages load, since a network call would live in a script.
 * Returns the offending findings; an empty list passes.
 */
export const PUBLIC_GUARD_MARKERS = ['/api/growth', 'growth/widget', '__pmbcChat', 'pmbc-chat', 'Ask PaceMakers a question', 'PaceMakers assistant', 'ChatWidget'];

export async function publicSiteGuard(base = process.env.VERIFY_BASE || 'https://www.pacemakersglobal.com') {
  const origin = base.replace(/\/+$/, '');
  const get = async (url) => {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'pmbc-public-guard' } });
    return { status: res.status, text: await res.text() };
  };
  const sitemap = await get(`${origin}/sitemap.xml`);
  const paths = new Set(['/', '/book', '/privacy', '/terms', '/confidentiality']);
  for (const m of sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      paths.add(new URL(m[1]).pathname || '/');
    } catch {
      // not a URL: skip it
    }
  }
  const findings = [];
  const scripts = new Set();
  for (const p of paths) {
    const page = await get(`${origin}${p}`);
    if (page.status >= 400) continue;
    for (const mk of PUBLIC_GUARD_MARKERS) if (page.text.includes(mk)) findings.push(`${p}: page contains "${mk}"`);
    for (const s of page.text.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) scripts.add(s[1]);
    for (const s of page.text.matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)) scripts.add(s[1]);
  }
  for (const src of scripts) {
    const url = src.startsWith('http') ? src : `${origin}${src}`;
    if (!url.startsWith(origin)) continue;
    const js = await get(url);
    for (const mk of PUBLIC_GUARD_MARKERS) if (js.text.includes(mk)) findings.push(`${src}: script contains "${mk}"`);
  }
  const chat = await get(`${origin}/api/growth/chat?path=/`);
  if (chat.status !== 404) findings.push(`/api/growth/chat answered ${chat.status}, expected 404 while the chat is off`);
  return { findings, pages: paths.size, scripts: scripts.size };
}

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function tableReady(svc, table) {
  const { error } = await svc.from(table).select('id').limit(1);
  return !error;
}

export function migrationChecks(file, tables) {
  const sql = read(`supabase/migrations/${file}`);
  check(`${file}: SAFE TO APPLY line`, /^-- SAFE TO APPLY:/m.test(sql));
  for (const t of tables) {
    check(`${file}: RLS on ${t}`, sql.includes(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`));
    check(`${file}: privileges revoked on ${t}`, new RegExp(`REVOKE ALL ON TABLE [^;]*\\b${t}\\b[^;]*FROM anon, authenticated;`).test(sql));
  }
  check(`${file}: idempotent (IF NOT EXISTS)`, !/CREATE TABLE (?!IF NOT EXISTS)/.test(sql));
  // A mangled edit once left a quote open in 094; catch that before Ahmad pastes it.
  const code = sql.replace(/--[^\n]*/g, '');
  const bare = code.replace(/'(?:[^']|'')*'/g, "''");
  check(`${file}: quotes balanced`, (code.match(/'/g) ?? []).length % 2 === 0);
  check(`${file}: brackets balanced`, (bare.match(/\(/g) ?? []).length === (bare.match(/\)/g) ?? []).length);
  check(`${file}: one BEGIN and one COMMIT`, (code.match(/^BEGIN;/gm) ?? []).length === 1 && (code.match(/^COMMIT;/gm) ?? []).length === 1);
  check(`${file}: no dashes`, !DASHES.test(sql));
  return sql;
}
