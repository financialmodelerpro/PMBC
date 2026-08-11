// scripts/verify-fmp-pages.mjs
//
// Verifies the three imported Financial Modeler Pro pages end to end.
//
//   node scripts/verify-fmp-pages.mjs
//
// HOW THE LIVE PATH IS EXERCISED WITHOUT FMP'S PRODUCTION KEY
// FMP's feed fails closed and the key is not in this repo. Rather than skip the
// live path, this script stands up a local mock on 127.0.0.1 that serves the
// EXACT payload FMP's route would produce, built by running that route's own
// query against FMP's database. The site under test is pointed at the mock with
// FMP_API_URL, so the real client code does a real HTTP fetch, sends the real
// header, parses a real Cache-Control, and writes the real cache.
//
// The mock is a stand-in for FMP's transport, not for its content. The content
// is genuinely FMP's.
//
// WHAT IT COVERS
//   * each sub-page renders real FMP content inside PMBC's own markup
//   * hidden fields stay hidden, asserted on the specific strings FMP suppresses
//   * `_dynamic` placeholder sections are dropped rather than rendered empty
//   * FMP's relative links are rewritten onto FMP's origin
//   * an unreachable feed serves the stored copy
//   * a cold cache degrades to a readable page, not a crash or a 500
//   * the API key never reaches the browser
//   * metadata, canonicals and the sitemap

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';
const MOCK_PORT = 4311;
const SLUGS = ['modeling-hub', 'refm', 'training-hub'];
const MOCK_KEY = 'verify-only-local-key';

let passed = 0;
const failures = [];
function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function loadEnv(file) {
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

/**
 * Rebuilds each payload exactly as FMP's public route does: same table, same
 * columns, same `visible = true` section filter, same field renaming, same
 * public-slug echo.
 */
async function recordPayloads() {
  const fmpEnv = loadEnv('D:/FMP/financial-modeler-pro/.env.local');
  const fmp = createClient(fmpEnv.SUPABASE_URL, fmpEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const INTERNAL = { 'modeling-hub': 'modeling', refm: 'modeling-real-estate', 'training-hub': 'training' };
  const out = {};
  for (const [publicSlug, internal] of Object.entries(INTERNAL)) {
    const { data: page } = await fmp
      .from('cms_pages')
      .select('slug, title, seo_title, seo_description, status, updated_at')
      .eq('slug', internal)
      .maybeSingle();
    const { data: sections } = await fmp
      .from('page_sections')
      .select('section_type, content, styles, display_order')
      .eq('page_slug', internal)
      .eq('visible', true)
      .order('display_order', { ascending: true });
    out[publicSlug] = {
      version: 1,
      page: {
        slug: publicSlug,
        title: page?.title ?? '',
        meta_title: page?.seo_title ?? '',
        meta_description: page?.seo_description ?? '',
        og_image_url: null,
        status: page?.status,
        updated_at: page?.updated_at,
      },
      sections: (sections ?? []).map((s) => ({
        section_type: s.section_type,
        content: s.content ?? {},
        styles: s.styles ?? {},
        display_order: s.display_order,
      })),
    };
  }
  return out;
}

/** The mock, with a switch so a later phase of the run can make it fail. */
function startMock(payloads) {
  const state = { mode: 'ok', keysSeen: [] };
  const server = http.createServer((req, res) => {
    const m = /^\/api\/public\/pages\/([^/?]+)/.exec(req.url || '');
    state.keysSeen.push(req.headers['x-api-key'] ?? null);
    if (state.mode === 'error') {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error' }));
      return;
    }
    if (!m || !payloads[m[1]]) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    if (req.headers['x-api-key'] !== MOCK_KEY) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/json',
      // The same header FMP's route sets on a 200.
      'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    });
    res.end(JSON.stringify(payloads[m[1]]));
  });
  return new Promise((resolve) => {
    server.listen(MOCK_PORT, '127.0.0.1', () => resolve({ server, state }));
  });
}

function startSite(env) {
  const proc = spawn('npx', ['next', 'start', '-p', '3999'], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    shell: true,
  });
  return proc;
}

/**
 * Rebuilds with the phase's environment.
 *
 * Necessary, not incidental. These routes are ISR, so Next prerenders them at
 * build time and `next start` serves that output until the revalidate window
 * expires. A server started with different env vars would therefore answer from
 * HTML built under the previous ones, and every phase after the first would be
 * testing the wrong thing. Building per phase is also what actually happens on
 * Vercel, where the feed is called during the build.
 */
function buildWith(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['next', 'build'], {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      stdio: 'ignore',
      shell: true,
    });
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('build failed, exit ' + code))));
  });
}

async function waitForSite(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + '/', { cache: 'no-store' });
      if (r.ok) return true;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('site did not come up');
}

function stopSite() {
  return new Promise((resolve) => {
    spawn(
      'powershell',
      ['-NoProfile', '-Command',
       "Get-NetTCPConnection -LocalPort 3999 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"],
      { stdio: 'ignore' },
    ).on('exit', () => setTimeout(resolve, 1500));
  });
}

const get = async (p) => {
  const res = await fetch(BASE + p, { redirect: 'manual', cache: 'no-store' });
  return { status: res.status, body: await res.text() };
};

async function clearCache(db, slugs) {
  for (const s of slugs) {
    await db.from('cms_content').delete().eq('section', '_fmp_cache').eq('key', s);
  }
}

async function main() {
  const pmbcEnv = loadEnv(path.join(projectRoot, '.env.local'));
  const db = createClient(pmbcEnv.SUPABASE_URL, pmbcEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log('Recording the real payloads from FMP...');
  const payloads = await recordPayloads();
  for (const s of SLUGS) {
    console.log(`  ${s}: ${payloads[s].sections.length} visible section(s), title="${payloads[s].page.title}"`);
  }

  const { server, state } = await startMock(payloads);
  const mockUrl = `http://127.0.0.1:${MOCK_PORT}`;

  await stopSite();
  await clearCache(db, SLUGS);

  let site = null;
  try {
    // ---- phase 1: live fetch through the real client ----------------------
    console.log('\n=== phase 1: live fetch ===');
    console.log('  building with the feed reachable...');
    await buildWith({ FMP_API_URL: mockUrl, FMP_API_KEY: MOCK_KEY });
    site = startSite({ FMP_API_URL: mockUrl, FMP_API_KEY: MOCK_KEY });
    await waitForSite();

    for (const slug of SLUGS) {
      const page = await get(`/financial-modeler-pro/${slug}`);
      ok(`${slug}: 200`, page.status === 200, String(page.status));

      // Real FMP content, matched on strings that exist only in FMP's copy.
      const marker = {
        'modeling-hub': 'Build Institutional-Grade Financial Models',
        refm: 'Institutional-grade real estate development feasibility',
        'training-hub': 'Get Certified in Financial Modeling',
      }[slug];
      ok(`${slug}: renders real FMP content`, page.body.includes(marker), marker);

      // PMBC's chrome and visual system, not an embed.
      ok(`${slug}: rendered inside PMBC's navbar`, /PaceMakers/i.test(page.body));
      ok(`${slug}: uses PMBC section markup`, page.body.includes('pmbc-display'));
      ok(`${slug}: no iframe of FMP`, !/<iframe[^>]*financialmodelerpro/i.test(page.body));

      // The key must never reach the browser.
      ok(`${slug}: API key absent from the HTML`, !page.body.includes(MOCK_KEY));
      ok(`${slug}: mock origin absent from the HTML`, !page.body.includes(mockUrl));

      // Relative FMP links absolutised.
      ok(
        `${slug}: no bare FMP-relative CTA leaked`,
        !/href="\/(register|signin|pricing|verify)"/.test(page.body),
        (page.body.match(/href="\/(register|signin|pricing|verify)"/) || [''])[0],
      );
    }

    // Hidden content, asserted on the exact strings FMP suppresses.
    console.log('\n=== hidden items stay hidden ===');
    {
      const modeling = await get('/financial-modeler-pro/modeling-hub');
      // modeling cta carries button2Text_visible:false on a label that still
      // holds an uninterpolated template placeholder.
      ok('modeling-hub: hidden second button is not rendered',
        !modeling.body.includes('trialDays'), 'found "{trialDays}"');
      ok('modeling-hub: its label text is absent too',
        !/Start .*Day Free Trial/.test(modeling.body));

      const training = await get('/financial-modeler-pro/training-hub');
      // The training hero carries cta1_visible:false and cta2_visible:false
      // while still holding cta_primary_text and cta_secondary_text, so a
      // consumer that ignored the flags would render two buttons FMP hides.
      //
      // Scoped to the hero ELEMENT rather than a character window. The page
      // also has a timeline step legitimately labelled "Register Free", and a
      // window wide enough to cover the hero reached it, which failed this
      // check for the wrong reason.
      const heroStart = training.body.indexOf('<section');
      const heroEnd = training.body.indexOf('<section', heroStart + 1);
      const hero = training.body.slice(heroStart, heroEnd > 0 ? heroEnd : heroStart + 6000);
      ok('training-hub: the hero is the section under test',
        hero.includes('Get Certified in Financial Modeling'), 'hero not located');
      ok('training-hub: hero CTAs hidden by cta1/cta2 are absent',
        !/Register Free/.test(hero) && !/Login to Dashboard/.test(hero),
        'a hidden hero CTA rendered');
      ok('training-hub: the hero renders no link at all, as on FMP',
        !/<a\s/.test(hero), 'hero contains a link');
    }

    // `_dynamic` sections dropped.
    console.log('\n=== dynamic placeholder sections ===');
    {
      const training = await get('/financial-modeler-pro/training-hub');
      ok('training-hub: dynamic course list heading not rendered',
        !training.body.includes('Choose Your Certification Path'));
      ok('training-hub: dynamic testimonials heading not rendered',
        !training.body.includes('What Our Students Say'));
      const modeling = await get('/financial-modeler-pro/modeling-hub');
      ok('modeling-hub: dynamic section heading not rendered',
        !modeling.body.includes('_dynamic'));
      const refm = await get('/financial-modeler-pro/refm');
      ok('refm: dynamic module guide heading not rendered',
        !refm.body.includes('Step-by-Step Module Guide'));
      // But non-dynamic content on the same pages did render.
      ok('refm: real stats rendered', refm.body.includes('Asset Classes'));
      ok('training-hub: real timeline rendered', training.body.includes('Register Free') || training.body.includes('Watch on Platform'));
    }

    // Metadata.
    console.log('\n=== metadata ===');
    for (const slug of SLUGS) {
      const page = await get(`/financial-modeler-pro/${slug}`);
      ok(`${slug}: canonical is PMBC's URL`,
        page.body.includes(`/financial-modeler-pro/${slug}"`),
        'canonical missing');
      ok(`${slug}: has a description`, /<meta name="description"/.test(page.body));
      // FMP sends og_image_url null, so PMBC's own generator must be used.
      ok(`${slug}: OG image falls back to PMBC /api/og`, /\/api\/og/.test(page.body));
    }

    // The cache was populated by the live fetches.
    console.log('\n=== cache written ===');
    {
      const { data } = await db.from('cms_content').select('key').eq('section', '_fmp_cache');
      ok('all three pages cached after a live fetch', (data ?? []).length === 3,
        (data ?? []).map((r) => r.key).join(', '));
      ok('the feed key was sent on every request',
        state.keysSeen.length > 0 && state.keysSeen.every((k) => k === MOCK_KEY),
        `${state.keysSeen.length} request(s)`);
    }

    // ---- phase 2: feed unreachable, cache serves ---------------------------
    console.log('\n=== phase 2: feed unreachable, stored copy serves ===');
    await stopSite();
    state.mode = 'error';
    console.log('  rebuilding with the feed failing, cache warm...');
    await buildWith({ FMP_API_URL: mockUrl, FMP_API_KEY: MOCK_KEY });
    site = startSite({ FMP_API_URL: mockUrl, FMP_API_KEY: MOCK_KEY });
    await waitForSite();

    for (const slug of SLUGS) {
      const page = await get(`/financial-modeler-pro/${slug}`);
      const marker = {
        'modeling-hub': 'Build Institutional-Grade Financial Models',
        refm: 'Institutional-grade real estate development feasibility',
        'training-hub': 'Get Certified in Financial Modeling',
      }[slug];
      ok(`${slug}: still 200 while the feed is failing`, page.status === 200, String(page.status));
      ok(`${slug}: serves the stored copy, not an error page`, page.body.includes(marker));
      ok(`${slug}: does not show the unavailable notice`,
        !page.body.includes('is not reachable at the moment'));
    }

    // ---- phase 3: cold cache, feed unreachable ----------------------------
    console.log('\n=== phase 3: cold cache and no feed ===');
    await stopSite();
    await clearCache(db, SLUGS);
    // No key at all, which is also what an unconfigured deployment looks like.
    console.log('  rebuilding with no feed and no cache...');
    await buildWith({ FMP_API_URL: 'http://127.0.0.1:1', FMP_API_KEY: '' });
    site = startSite({ FMP_API_URL: 'http://127.0.0.1:1', FMP_API_KEY: '' });
    await waitForSite();

    for (const slug of SLUGS) {
      const page = await get(`/financial-modeler-pro/${slug}`);
      ok(`${slug}: 200 rather than a crash or a 500`, page.status === 200, String(page.status));
      ok(`${slug}: shows the graceful notice`, page.body.includes('is not reachable at the moment'));
      ok(`${slug}: links out to FMP`, page.body.includes('financialmodelerpro.com'));
      ok(`${slug}: keeps PMBC's chrome`, /PaceMakers/i.test(page.body));
      ok(`${slug}: no stack trace or error digest`,
        !/Application error: a|Internal Server Error|<pre/i.test(page.body));
    }

    // ---- parent page and sitemap ------------------------------------------
    console.log('\n=== parent page and sitemap ===');
    {
      const parent = await get('/financial-modeler-pro');
      ok('parent: 200', parent.status === 200, String(parent.status));
      for (const slug of SLUGS) {
        ok(`parent: links to /${slug}`, parent.body.includes(`/financial-modeler-pro/${slug}`));
      }
      ok('parent: CTA out to financialmodelerpro.com',
        parent.body.includes('financialmodelerpro.com'));
      ok('parent: is PMBC-authored, not fetched',
        parent.body.includes('Why it exists') || parent.body.includes('platform arm'));

      const sitemap = await get('/sitemap.xml');
      for (const slug of ['', '/modeling-hub', '/refm', '/training-hub']) {
        ok(`sitemap lists /financial-modeler-pro${slug}`,
          sitemap.body.includes(`/financial-modeler-pro${slug}<`));
      }
    }

    // ---- source hygiene ----------------------------------------------------
    console.log('\n=== source hygiene ===');
    {
      const clientSrc = fs.readFileSync(path.join(projectRoot, 'src/lib/fmp/client.ts'), 'utf8');
      ok('no NEXT_PUBLIC_ prefix on either FMP variable',
        !/NEXT_PUBLIC_FMP/.test(clientSrc));
      const routeSrc = fs.readFileSync(
        path.join(projectRoot, 'src/app/(public)/financial-modeler-pro/refm/page.tsx'),
        'utf8',
      );
      ok('routes declare ISR at 60 seconds', /export const revalidate = 60;/.test(routeSrc));
      ok('client revalidate constant agrees', /FMP_REVALIDATE_SECONDS = 60/.test(clientSrc));
      const envExample = fs.readFileSync(path.join(projectRoot, '.env.local.example'), 'utf8');
      ok('.env.local.example documents both variables',
        envExample.includes('FMP_API_URL') && envExample.includes('FMP_API_KEY'));
      // No client component may import the server-only client.
      const clientComponents = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.tsx?$/.test(e.name)) {
            const t = fs.readFileSync(p, 'utf8');
            if (t.startsWith("'use client'") && t.includes('lib/fmp/client')) clientComponents.push(p);
          }
        }
      };
      walk(path.join(projectRoot, 'src'));
      ok('no client component imports the FMP client', clientComponents.length === 0,
        clientComponents.join(', '));
    }
  } finally {
    await stopSite();
    server.close();
    if (site) {
      try {
        site.kill();
      } catch {
        /* already gone */
      }
    }
    await clearCache(db, SLUGS);
    console.log('\ncache cleared, site stopped');
  }

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-fmp-pages failed:', err.message);
  process.exitCode = 1;
});
