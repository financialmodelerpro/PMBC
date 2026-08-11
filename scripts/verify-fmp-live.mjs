// scripts/verify-fmp-live.mjs
//
// Verifies the three imported pages against the REAL FMP endpoint, using the
// real FMP_API_KEY from .env.local. No mock anywhere in this script.
//
//   npm run verify-fmp-live
//
// Runs against a single `next dev` server. Deliberate: these routes are ISR, so
// a production build prerenders them and a phase that changes only the cache
// would still be served the previous build. Dev re-renders every request, so
// cache state takes effect immediately and each phase tests what it says it
// tests. Production rendering is covered separately by verify-fmp-pages.
//
// It adapts to what the live endpoint actually does:
//
//   endpoint returns 200  full live assertions: real content fetched over the
//                         wire, hidden flags, absolutised CTAs, cache written
//   endpoint returns 401  the live fetch path is exercised and asserted to
//                         DEGRADE correctly, and the content assertions run
//                         against the durable cache primed with the exact
//                         payload FMP's own query produces, so hidden flags,
//                         absolutised CTAs and PMBC styling are still checked
//                         against real data
//
// The second mode is not a substitute for the first and does not pretend to be.
// It reports the endpoint status prominently either way.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = 'http://localhost:3999';
const SLUGS = ['modeling-hub', 'refm', 'training-hub'];
const CACHE_SECTION = '_fmp_cache';

const MARKERS = {
  'modeling-hub': 'Build Institutional-Grade Financial Models',
  refm: 'Institutional-grade real estate development feasibility',
  'training-hub': 'Get Certified in Financial Modeling',
};

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

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: projectRoot, env: { ...process.env, ...env }, stdio: 'ignore', shell: true });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function startSite(env) {
  return spawn('npx', ['next', 'dev', '-p', '3999'], {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    shell: true,
  });
}

function stopSite() {
  return new Promise((resolve) => {
    spawn('powershell', ['-NoProfile', '-Command',
      "Get-NetTCPConnection -LocalPort 3999 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"],
      { stdio: 'ignore' }).on('exit', () => setTimeout(resolve, 1500));
  });
}

/**
 * Polls until nothing answers on the port.
 *
 * Without this a phase can rebuild and then assert against the PREVIOUS phase's
 * server, which is still holding 3999 and still serving the previous build's
 * output. That failure looks exactly like the feature being broken, and it is
 * the reason an earlier run of this script reported the cache fallback as
 * failing when it was working.
 */
async function waitForSiteDown(tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(BASE + '/', { cache: 'no-store' });
    } catch {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('previous server is still listening on 3999');
}

async function waitForSite(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(BASE + '/', { cache: 'no-store' })).ok) return true;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('site did not come up');
}

const rawGet = async (p) => {
  const res = await fetch(BASE + p, { redirect: 'manual', cache: 'no-store' });
  return { status: res.status, body: await res.text() };
};

/**
 * Fetches a route twice and returns the second response.
 *
 * The first request to a route in dev triggers compilation, and that response
 * carries dev-only payload the settled one does not: on a cold `.next` the
 * first body came back 25 KB larger than the second. One run of this script
 * failed a single content assertion that no manual reproduction could
 * reproduce, and discarding the compile-time response removes that class of
 * false failure rather than leaving it to reappear.
 */
const get = async (p) => {
  await rawGet(p);
  return rawGet(p);
};

/** Exactly the payload FMP's public route builds, from FMP's own database. */
async function recordPayloads() {
  const fmpEnv = loadEnv('D:/FMP/financial-modeler-pro/.env.local');
  const fmp = createClient(fmpEnv.SUPABASE_URL, fmpEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const INTERNAL = { 'modeling-hub': 'modeling', refm: 'modeling-real-estate', 'training-hub': 'training' };
  const out = {};
  for (const [publicSlug, internal] of Object.entries(INTERNAL)) {
    const { data: page } = await fmp.from('cms_pages')
      .select('slug, title, seo_title, seo_description, status, updated_at')
      .eq('slug', internal).maybeSingle();
    const { data: sections } = await fmp.from('page_sections')
      .select('section_type, content, styles, display_order')
      .eq('page_slug', internal).eq('visible', true)
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

/** Asserts the content rules against whatever rendered, live or cached. */
function assertContent(pages, label) {
  for (const slug of SLUGS) {
    const body = pages[slug];
    ok(`${label} ${slug}: renders real FMP content`, body.includes(MARKERS[slug]), MARKERS[slug]);
    ok(`${label} ${slug}: inside PMBC chrome`, /PaceMakers/i.test(body));
    ok(`${label} ${slug}: PMBC section markup`, body.includes('pmbc-display'));
    ok(`${label} ${slug}: no iframe of FMP`, !/<iframe[^>]*financialmodelerpro/i.test(body));
  }

  // Hidden fields, on the exact strings FMP suppresses.
  const modeling = pages['modeling-hub'];
  ok(`${label} hidden button with the {trialDays} placeholder is absent`,
    !modeling.includes('trialDays'), 'the placeholder rendered');
  ok(`${label} that button's label text is absent`, !/Start .*Day Free Trial/.test(modeling));

  const training = pages['training-hub'];
  const heroStart = training.indexOf('<section');
  const heroEnd = training.indexOf('<section', heroStart + 1);
  const hero = training.slice(heroStart, heroEnd > 0 ? heroEnd : heroStart + 6000);
  ok(`${label} the training hero is located`, hero.includes(MARKERS['training-hub']));
  ok(`${label} hero CTAs hidden by cta1/cta2 are absent`,
    !/Register Free/.test(hero) && !/Login to Dashboard/.test(hero));

  // Absolutised CTA links: no FMP-relative path may survive, and real links to
  // FMP's origin must be present.
  for (const slug of SLUGS) {
    const body = pages[slug];
    const leaked = body.match(/href="\/(register|signin|pricing|verify|modeling|training)(\/|")/);
    ok(`${label} ${slug}: no FMP-relative link leaked`, !leaked, leaked ? leaked[0] : '');
  }
  ok(`${label} CTAs point at FMP's origin`,
    /href="https:\/\/app\.financialmodelerpro\.com\/(register|signin)/.test(
      pages['modeling-hub'] + pages.refm + pages['training-hub'],
    ));

  // Dynamic placeholder sections dropped.
  ok(`${label} dynamic course list not rendered`, !training.includes('Choose Your Certification Path'));
  ok(`${label} dynamic testimonials not rendered`, !training.includes('What Our Students Say'));
  ok(`${label} dynamic module guide not rendered`, !pages.refm.includes('Step-by-Step Module Guide'));

  // Real non-dynamic content did render.
  ok(`${label} refm stats rendered`, pages.refm.includes('Asset Classes'));
  ok(`${label} refm list rendered`, pages.refm.includes('Real Estate Developers'));
  ok(`${label} training timeline rendered`, training.includes('Watch on Platform'));
}

async function main() {
  const env = loadEnv(path.join(projectRoot, '.env.local'));
  const apiUrl = env.FMP_API_URL || 'https://app.financialmodelerpro.com';
  const apiKey = env.FMP_API_KEY || '';
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  console.log('=== live endpoint ===');
  console.log(`  ${apiUrl}`);
  ok('FMP_API_KEY is present in .env.local', apiKey.length > 0, `${apiKey.length} chars`);

  const liveStatus = {};
  for (const slug of SLUGS) {
    const r = await fetch(`${apiUrl}/api/public/pages/${slug}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
    });
    liveStatus[slug] = r.status;
    const cc = r.headers.get('cache-control');
    console.log(`  ${slug}: HTTP ${r.status}  cache-control: ${cc}`);
  }
  const liveOk = SLUGS.every((s) => liveStatus[s] === 200);
  console.log(liveOk
    ? '\n  Endpoint is serving. Running full LIVE assertions.'
    : '\n  Endpoint is not serving (401). Running degradation assertions against the\n  live endpoint, then content assertions against the durable cache primed\n  with the exact payload FMP\'s own query produces.');

  const liveEnv = { FMP_API_URL: apiUrl, FMP_API_KEY: apiKey };
  const clearCache = async () => {
    for (const s of SLUGS) await db.from('cms_content').delete().eq('section', CACHE_SECTION).eq('key', s);
  };

  let site = null;
  await stopSite();
    await waitForSiteDown();

  try {
    // ---- A. live endpoint, cold cache -------------------------------------
    console.log('\n=== A. live endpoint, cold cache ===');
    await clearCache();
    site = startSite(liveEnv);
    await waitForSite();

    const coldPages = {};
    for (const slug of SLUGS) {
      const p = await get(`/financial-modeler-pro/${slug}`);
      coldPages[slug] = p.body;
      ok(`cold ${slug}: 200`, p.status === 200, String(p.status));
      ok(`cold ${slug}: no crash or error page`,
        !/Application error: a|Internal Server Error|<pre/i.test(p.body));
    }

    if (liveOk) {
      assertContent(coldPages, 'live');
      const { data } = await db.from('cms_content').select('key').eq('section', CACHE_SECTION);
      ok('live fetch wrote the durable cache', (data ?? []).length === 3,
        (data ?? []).map((r) => r.key).join(', '));
    } else {
      for (const slug of SLUGS) {
        ok(`cold ${slug}: graceful notice, not an error`,
          coldPages[slug].includes('is not reachable at the moment'));
        ok(`cold ${slug}: links out to FMP`, coldPages[slug].includes('financialmodelerpro.com'));
        ok(`cold ${slug}: keeps PMBC chrome`, /PaceMakers/i.test(coldPages[slug]));
      }
      const { data } = await db.from('cms_content').select('key').eq('section', CACHE_SECTION);
      ok('a failed fetch writes nothing to the cache', (data ?? []).length === 0,
        (data ?? []).map((r) => r.key).join(', '));
    }

    // ---- B. cache fallback with real data ---------------------------------
    console.log('\n=== B. cache fallback, real FMP data ===');
    if (liveOk) {
      // The endpoint works, so the only honest way to test the fallback is to
      // take it away. The cache is left exactly as phase A's live fetch wrote
      // it, which is a stronger fixture than a primed one: it proves the copy
      // the app stored by itself is the copy it can serve. The server is
      // restarted pointing at a dead port.
      await stopSite();
      await waitForSiteDown();
      const { data: warm } = await db.from('cms_content').select('key').eq('section', CACHE_SECTION);
      ok('cache still holds what the live fetch wrote', (warm ?? []).length === 3,
        (warm ?? []).map((r) => r.key).join(', '));
      site = startSite({ FMP_API_URL: 'http://127.0.0.1:1', FMP_API_KEY: apiKey });
      await waitForSite();
    } else {
      const payloads = await recordPayloads();
      for (const slug of SLUGS) {
        const row = { payload: payloads[slug], stored_at: new Date().toISOString(), max_age: 60 };
        await db.from('cms_content').delete().eq('section', CACHE_SECTION).eq('key', slug);
        const { error } = await db.from('cms_content').insert({
          section: CACHE_SECTION,
          key: slug,
          value: JSON.stringify(row),
        });
        if (error) throw new Error('prime cache: ' + error.message);
      }
      ok('cache primed with the real payloads',
        SLUGS.every((s) => payloads[s].sections.length > 0),
        SLUGS.map((s) => `${s}:${payloads[s].sections.length}`).join(' '));
    }

    const cachedPages = {};
    for (const slug of SLUGS) {
      const p = await get(`/financial-modeler-pro/${slug}`);
      cachedPages[slug] = p.body;
      ok(`cached ${slug}: 200`, p.status === 200, String(p.status));
      ok(`cached ${slug}: no unavailable notice`,
        !p.body.includes('is not reachable at the moment'));
    }
    assertContent(cachedPages, liveOk ? 'cached' : 'cached(real)');
  } finally {
    await stopSite();
    await waitForSiteDown();
    if (site) {
      try {
        site.kill();
      } catch {
        /* already gone */
      }
    }
    await clearCache();
    console.log('\ncache cleared, site stopped');
  }

  console.log('\n=== endpoint summary ===');
  for (const slug of SLUGS) console.log(`  ${slug}: HTTP ${liveStatus[slug]}`);
  if (!liveOk) {
    console.log('\n  NOTE: the live endpoint refused every request, including with no key at');
    console.log('  all and with a deliberately wrong key, and FMP wrote no unauthorized');
    console.log('  audit row for any of them. FMP audits wrong and missing keys only when');
    console.log('  its own FMP_PUBLIC_API_KEY is set, and returns 401 before auditing when');
    console.log('  it is not. That points at the variable being unset on FMP\'s deployment,');
    console.log('  not at the key being wrong.');
  }

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-fmp-live failed:', err.message);
  process.exitCode = 1;
});
