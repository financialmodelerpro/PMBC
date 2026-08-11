// scripts/verify-fmp-page.mjs
//
// Verifies the rebuilt Financial Modeler Pro page at /fmp against a running
// production server.
//
//   npm run verify-fmp-page
//
// Checks the rendered HTML rather than the database, so a section type that
// silently drops a field would be caught. Covers the URL move, the navigation,
// the six sections, every card and bullet, the figures sourced from FMP, and
// the deliberate absence of the three sub-pages from the sitemap and from every
// link on the site.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';

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

const get = async (p) => {
  const res = await fetch(BASE + p, { redirect: 'manual', cache: 'no-store' });
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
};

const FMP = 'https://app.financialmodelerpro.com';

async function main() {
  // ---- routing -------------------------------------------------------------
  console.log('=== routing ===');
  const page = await get('/fmp');
  ok('/fmp responds 200', page.status === 200, String(page.status));

  const old = await get('/financial-modeler-pro');
  ok('old path returns 301', old.status === 301, String(old.status));
  ok('old path redirects to /fmp', (old.location || '').endsWith('/fmp'), String(old.location));
  const hop = await get('/fmp');
  ok('the redirect target is a 200, so one hop', hop.status === 200, String(hop.status));

  console.log('\n=== the three sub-pages stay live but unlinked ===');
  for (const slug of ['modeling-hub', 'refm', 'training-hub']) {
    const sub = await get(`/financial-modeler-pro/${slug}`);
    ok(`/${slug} still renders`, sub.status === 200, String(sub.status));
  }
  const sitemap = await get('/sitemap.xml');
  ok('sitemap lists /fmp', sitemap.body.includes('/fmp<'));
  ok('sitemap omits the old parent path', !sitemap.body.includes('/financial-modeler-pro<'));
  for (const slug of ['modeling-hub', 'refm', 'training-hub']) {
    ok(`sitemap omits /${slug}`, !sitemap.body.includes(`/financial-modeler-pro/${slug}`));
  }
  // Nothing on the public site may link to them.
  const home = await get('/');
  for (const p of ['/', '/services', '/approach', '/contact', '/fmp']) {
    const body = (await get(p)).body;
    const linked = /href="\/financial-modeler-pro\/(modeling-hub|refm|training-hub)"/.test(body);
    ok(`${p} does not link to a sub-page`, !linked);
  }

  // ---- navigation ----------------------------------------------------------
  console.log('\n=== navigation ===');
  ok('navbar carries Financial Modeler Pro pointing at /fmp',
    /href="\/fmp"[^>]*>Financial Modeler Pro</.test(home.body) ||
      /Financial Modeler Pro<\/a>/.test(home.body) && home.body.includes('href="/fmp"'));
  ok('footer links to /fmp', (home.body.match(/href="\/fmp"/g) || []).length >= 2,
    `${(home.body.match(/href="\/fmp"/g) || []).length} link(s)`);
  ok('nothing still links to the old path',
    !/href="\/financial-modeler-pro"/.test(home.body + page.body));

  // ---- sections ------------------------------------------------------------
  const b = page.body;
  console.log('\n=== 1. hero ===');
  ok('headline', b.includes('Where financial modeling meets real-world execution'));
  ok('subtitle names the practitioner and the deals',
    b.includes('twelve years on multi-billion riyal deals'));
  ok('subtitle names free certification and modeling tools',
    b.includes('free certification training and institutional-grade modeling tools'));

  console.log('\n=== capability tags ===');
  for (const tag of ['Real Estate Models', 'Business Valuation', 'Project Finance', 'Renewable Energy',
    'FP&amp;A', 'Capital Structuring', 'Debt Sizing', 'M&amp;A Advisory']) {
    ok(`tag: ${tag.replace('&amp;', '&')}`, b.includes(tag));
  }

  console.log('\n=== 2. what is Financial Modeler Pro ===');
  ok('heading', b.includes('What is Financial Modeler Pro'));
  ok('prose names the Training Hub', b.includes('Training Hub'));
  ok('prose names the Modeling Hub', b.includes('Modeling Hub'));
  ok('prose covers traceable assumptions', b.includes('traceable to the outputs they drive'));
  ok('prose covers investor-ready output', b.includes('investor-ready PDF'));
  for (const item of ['Multi-discipline modeling', 'Structured workflows', 'Monthly or annual periods',
    'Formula-linked Excel and investor PDF export', 'Free certification',
    'Built by a practitioner, not a software company']) {
    ok(`checklist: ${item}`, b.includes(item));
  }

  console.log('\n=== 3. who it is built for ===');
  for (const who of ['Financial Analysts', 'Investment Professionals', 'Real Estate Developers',
    'Family Offices', 'Lenders and Banks', 'Students and Aspiring Analysts']) {
    ok(`card: ${who}`, b.includes(who));
  }
  ok('every audience card carries prose, not a stub',
    b.includes('without starting from an empty workbook') &&
    b.includes('an equity waterfall that survives a lender review') &&
    b.includes('covenant headroom are computed explicitly'));

  console.log('\n=== 4. two platforms ===');
  ok('heading', b.includes('Two platforms. One destination.'));
  ok('Modeling Hub CTA label', b.includes('Explore Modeling Hub'));
  ok('Modeling Hub CTA target', b.includes(`href="${FMP}/modeling"`));
  ok('Training Hub CTA label', b.includes('Browse Free Courses'));
  ok('Training Hub CTA target', b.includes(`href="${FMP}/training"`));
  ok('both platform CTAs open in a new tab',
    (b.match(/target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/g) || []).length >= 2);
  for (const bullet of [
    'Project setup covering structure, land allocation, costs and financing',
    'Returns analysis with IRR, NPV, MoIC, DSCR, equity multiples and stabilised yield',
    'A 70% pass mark on each session before the next one unlocks',
    'A verified certificate with a unique ID, QR code and a permanent verification link',
  ]) {
    ok(`bullet present: ${bullet.slice(0, 46)}...`, b.includes(bullet));
  }

  console.log('\n=== 5. certification paths ===');
  ok('3SFM title', b.includes('3-Statement Financial Modeling'));
  ok('3SFM code', b.includes('3SFM'));
  for (const m of ['17 Sessions', '6 Hours', 'Beginner']) ok(`3SFM chip: ${m}`, b.includes(m));
  ok('3SFM verified certificate note', b.includes('passing all 17 assessments'));
  ok('3SFM links to its course page',
    b.includes(`${FMP}/training/00000000-0000-0000-0000-0000000035f0`));

  ok('BVM title', b.includes('Business Valuation Modeling'));
  ok('BVM code', b.includes('BVM'));
  for (const m of ['6 Lessons', '3 Hours', 'Intermediate']) ok(`BVM chip: ${m}`, b.includes(m));
  ok('BVM verified certificate note', b.includes('passing all 6 lesson assessments'));
  ok('BVM links to its course page',
    b.includes(`${FMP}/training/00000000-0000-0000-0000-00000000b600`));

  console.log('\n=== 6. closing CTA ===');
  ok('closing headline', b.includes('Come to the firm when it stops being a modeling question'));
  ok('closing CTA out to FMP', b.includes('https://www.financialmodelerpro.com'));

  // ---- presentation --------------------------------------------------------
  console.log('\n=== presentation ===');
  ok('serif headline class present', b.includes('pmbc-display'));
  ok("uses PMBC's navy", /#1B3A5F|--pmbc-primary/.test(b));
  ok("uses PMBC's gold", /#C69C3E|#A88530|--pmbc-accent/.test(b));
  ok("uses PMBC's cream", /#FAF7F2|--pmbc-surface-cream/.test(b));
  // FMP's own palette must not have travelled across with the copy.
  ok("does not use FMP's green", !/#2EAA4A|#6EE589/.test(b));
  ok("does not use FMP's blue gradient", !/#0A1F3D|#0D2E5A|#0F3D6E/.test(b));

  console.log('\n=== content is PMBC-authored, not fetched ===');
  const routeSrc = fs.readFileSync(
    path.join(projectRoot, 'src/app/(public)/fmp/page.tsx'),
    'utf8',
  );
  ok('/fmp does not call the FMP API', !/lib\/fmp\/client|fetchFmpPage/.test(routeSrc));
  ok('/fmp reads its sections from the CMS', /fetchPageSections/.test(routeSrc));

  console.log('\n=== the API integration is retained ===');
  for (const f of [
    'src/lib/fmp/client.ts',
    'src/lib/fmp/mapSections.ts',
    'src/lib/fmp/visibility.ts',
    'src/components/public/FmpImportedPage.tsx',
    'src/app/(public)/financial-modeler-pro/modeling-hub/page.tsx',
  ]) {
    ok(`kept: ${f}`, fs.existsSync(path.join(projectRoot, f)));
  }

  console.log('\n=== em dashes ===');
  ok('no em or en dash in the rendered page', !/[\u2013\u2014]/.test(b));

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-fmp-page failed:', err.message);
  process.exitCode = 1;
});
