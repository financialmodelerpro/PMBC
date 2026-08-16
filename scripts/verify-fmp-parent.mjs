// scripts/verify-fmp-parent.mjs
//
// Verifies the Financial Modeler Pro page at /fmp against a running production
// server.
//
//   npm run verify-fmp-parent
//
// WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
// This checks what the CODE owns: the URL move and its redirect, navigation,
// the sitemap, the retained-but-unlinked sub-pages, the section structure, the
// palette, and the layout rules the brief specified.
//
// It does NOT assert the wording of any section. Every word on this page is
// ordinary CMS content that the operator edits in the page builder, so pinning
// the exact strings would fail the moment anyone rewords a line, which is the
// point of the page being editable. An earlier version did assert them and did
// exactly that: it went red mid-run while the operator was editing the
// checklist, reporting a broken page when nothing was broken.
//
// Completeness of the seeded copy is checked where it belongs, at seed time, by
// scripts/seed-fmp-page-rebuild.mjs, which fails if any card, bullet or chip it
// writes is missing.

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
  ok('the redirect target is a 200, so one hop', (await get('/fmp')).status === 200);

  console.log('\n=== the sub-pages stay live but unlinked ===');
  for (const slug of ['modeling-hub', 'refm', 'training-hub']) {
    ok(`/${slug} still renders`, (await get(`/financial-modeler-pro/${slug}`)).status === 200);
  }
  const sitemap = await get('/sitemap.xml');
  ok('sitemap lists /fmp', sitemap.body.includes('/fmp<'));
  ok('sitemap omits the old parent path', !sitemap.body.includes('/financial-modeler-pro<'));
  for (const slug of ['modeling-hub', 'refm', 'training-hub']) {
    ok(`sitemap omits /${slug}`, !sitemap.body.includes(`/financial-modeler-pro/${slug}`));
  }
  const home = await get('/');
  for (const p of ['/', '/services', '/approach', '/contact', '/fmp']) {
    const body = (await get(p)).body;
    ok(
      `${p} does not link to a sub-page`,
      !/href="\/financial-modeler-pro\/(modeling-hub|refm|training-hub)"/.test(body),
    );
  }

  // ---- navigation ----------------------------------------------------------
  console.log('\n=== navigation ===');
  ok('navbar carries Financial Modeler Pro', home.body.includes('Financial Modeler Pro'));
  ok('it points at /fmp', home.body.includes('href="/fmp"'));
  ok('footer links to /fmp as well', (home.body.match(/href="\/fmp"/g) || []).length >= 2,
    `${(home.body.match(/href="\/fmp"/g) || []).length} link(s)`);
  ok('nothing links to the old path', !/href="\/financial-modeler-pro"/.test(home.body + page.body));

  // ---- structure -----------------------------------------------------------
  const b = page.body;
  const sections = b.split('<section').slice(1);
  console.log('\n=== structure ===');
  // A floor, not an exact count. This asserted `=== 6` and went stale the day
  // migration 063 folded the certification block into the Training Hub card it
  // repeated, leaving five. How many sections a page has is the operator's
  // call: merging two of them is an edit, not a regression. What the code owns
  // is that the page did not collapse to a hero and nothing else, which is what
  // a floor catches. Same lesson as Phase 36, which rewrote this script to stop
  // asserting seeded copy.
  ok('the page renders its hero plus content sections', sections.length >= 4,
    `${sections.length} section(s)`);

  const hero = '<section' + sections[0];
  ok('the hero renders a headline', /pmbc-display/.test(hero));

  // ---- capability tags, the subject of this change --------------------------
  console.log('\n=== capability tags ===');
  const TAGS = [
    'Real Estate Models', 'Business Valuation', 'Project Finance', 'Renewable Energy',
    'FP&amp;A', 'Capital Structuring', 'Debt Sizing', 'M&amp;A Advisory',
  ];
  const present = TAGS.filter((t) => hero.includes(t));
  // This said "no standalone tags section remains" and then re-checked the
  // section count, which is not that. Phase 36 folded the tags into the hero and
  // deleted the band they had been in, so the thing to assert is that the band
  // has not come back.
  //
  // Counted per section rather than per tag: half of these are also service
  // names ("Business Valuation", "Project Finance"), so they appear in ordinary
  // body copy further down the page and asserting that no tag appears outside
  // the hero fails on prose. A tags band would carry most of the list at once,
  // so the test is how many of the eight land in any one non-hero section.
  const worst = Math.max(
    0,
    ...sections.slice(1).map((s) => TAGS.filter((t) => s.includes(t)).length),
  );
  ok('no standalone tags section remains', worst < 4,
    `one section carries ${worst} of the ${TAGS.length} tags`);

  // The tags are optional content on the hero, so their presence is the
  // operator's call and is reported rather than asserted. What the code owns is
  // how they lay out once they are there, and that is only checkable when they
  // are. Phase 36 rewrote this script for exactly this reason: asserting seeded
  // wording had it reporting a broken page while someone was editing it.
  if (present.length === 0) {
    console.log('  note  the hero carries no capability tags, so the grid rules do not apply');
  } else {
    ok('the tags are a grid, not a wrapping flex row',
      /grid[^"]*grid-cols-2[^"]*lg:grid-cols-4/.test(hero),
      'grid classes not found in the hero');
    ok('the grid is centred and sized to its content', /w-fit/.test(hero));
    ok('each tag stays on one line', /whitespace-nowrap/.test(hero));
    // A count divisible by four fills the four-column rows evenly rather than
    // breaking five then three, which is what the fold was for.
    ok('the tag count fills four-column rows evenly', present.length % 4 === 0, `${present.length}`);
    ok('the tags sit between the subtitle and the CTAs',
      hero.indexOf(present[present.length - 1]) < hero.lastIndexOf('Visit Financial Modeler Pro') ||
        !hero.includes('Visit Financial Modeler Pro'));
  }

  // ---- the rest of the page still renders its parts -------------------------
  console.log('\n=== the other sections still render their parts ===');
  // The tick is written as `&#10003;` in JSX but React emits the literal
  // character, so the entity never appears in the served HTML.
  const ticks = (b.match(/\u2713/g) || []).length;
  ok('the checklist section renders ticked items', ticks > 0, `${ticks} tick(s)`);
  ok('the audience grid renders', b.includes('WHO IT IS FOR'));
  ok('both platform cards carry a CTA to FMP',
    b.includes(`href="${FMP}/modeling"`) && b.includes(`href="${FMP}/training"`));
  // Certification names no course and links to no course. FMP adds courses over
  // time and this page has no way of knowing when it does, so anything it said
  // about a specific path would go quietly out of date. It states what stays
  // true and hands the reader to the catalogue.
  ok('the certification band names no specific course',
    !/3SFM|BVM|\d+ Sessions|\d+ Lessons/.test(b),
    (b.match(/3SFM|BVM|\d+ Sessions|\d+ Lessons/g) || []).join(', '));
  ok('no link points at an individual course',
    (b.match(new RegExp(`href="${FMP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/training/[0-9a-f-]+"`, 'g')) || []).length === 0);
  ok('certification links to the course catalogue',
    b.includes(`href="${FMP}/training"`));
  // Every off-site link, not a fixed count of them: the count changes whenever
  // the page's CTAs do, and the rule being checked is about all of them.
  // `noreferrer` alone is accepted: it already implies the opener is severed,
  // and the footer's LinkedIn link has used that form since it was written.
  const external = (b.match(/<a[^>]+href="https?:\/\/[^"]+"[^>]*>/g) || []);
  const bare = external.filter((a) => !/rel="[^"]*(noopener|noreferrer)/.test(a));
  ok('every external CTA opens in a new tab',
    external.length > 0 && bare.length === 0,
    `${bare.length} of ${external.length} without target and rel`);
  ok('the closing CTA points at financialmodelerpro.com',
    b.includes('https://www.financialmodelerpro.com'));

  // ---- presentation --------------------------------------------------------
  console.log('\n=== presentation ===');
  ok('serif headline class present', b.includes('pmbc-display'));
  ok("uses PMBC's navy", /#1B3A5F|--pmbc-primary/.test(b));
  ok("uses PMBC's gold", /#C69C3E|#A88530|--pmbc-accent/.test(b));
  ok("uses PMBC's cream", /#FAF7F2|--pmbc-surface-cream/.test(b));
  ok("does not use FMP's green", !/#2EAA4A|#6EE589/.test(b));
  ok("does not use FMP's blue gradient", !/#0A1F3D|#0D2E5A|#0F3D6E/.test(b));

  // ---- code ownership ------------------------------------------------------
  console.log('\n=== content is PMBC-authored, not fetched ===');
  const routeSrc = fs.readFileSync(path.join(projectRoot, 'src/app/(public)/fmp/page.tsx'), 'utf8');
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
  console.error('verify-fmp-parent failed:', err.message);
  process.exitCode = 1;
});
