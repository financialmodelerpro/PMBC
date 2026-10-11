// scripts/verify-service-groups.mjs
//
// Verifies the three practice groups on /services (2026-10-11, migration 106)
// offline, by reading the config and rendering the real sections:
//
//   A. The config holds the nine services in the deck's order, numbered 01 to
//      09 in array order, three per group, with the slugs unchanged and the one
//      rename ("Investment Memoranda") in place.
//   B. Migration 106 sets the same numbers, orders, title and group names as
//      the config, so the database and the code cannot disagree once applied.
//   C. The /services grid renders three groups in order, each header with its
//      name, "3 services" and its colour, then its three cards in order, on
//      their group's tint. A cleared group name drops the heading but keeps the
//      count; a slug the config does not know joins the last group.
//   D. Every detail page's related services are its two group siblings and
//      then the next group's first service, never itself, and the detail
//      header prints the service's new number.
//   E. With --db, a read-only check that the live `services` rows match the
//      config (expect a mismatch until the owner applies 106). Select only.
//
//   node scripts/verify-service-groups.mjs [--db]
//   npm run verify-service-groups

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(root, 'src'),
    'next/link': path.join(root, 'scripts/lib/next-stubs/link.mjs'),
    'next/image': path.join(root, 'scripts/lib/next-stubs/image.mjs'),
  },
  jsx: { runtime: 'automatic' },
  nativeModules: ['react', 'react-dom'],
});

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const cfg = await jiti.import(path.join(root, 'src/config/services.ts'));
const { ServiceGrid } = await jiti.import(path.join(root, 'src/components/public/sections/ServiceGrid.tsx'));
const { ServiceDetail } = await jiti.import(path.join(root, 'src/components/public/sections/ServiceDetail.tsx'));

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(name + (detail ? `\n    ${detail}` : ''));
}

const EXPECTED = [
  ['modeling-valuation', 'Modeling and Valuation', [
    ['financial-modeling', 'Financial Modeling'],
    ['refm', 'Real Estate Financial Modeling'],
    ['business-valuation', 'Business Valuation'],
  ]],
  ['transactions', 'Transactions', [
    ['transaction-advisory', 'Transaction Advisory'],
    ['mergers-acquisitions', 'M&A Advisory'],
    ['financial-due-diligence', 'Financial Due Diligence'],
  ]],
  ['capital-finance', 'Capital and Finance', [
    ['project-finance', 'Project Finance'],
    ['investment-memorandums', 'Investment Memoranda'],
    ['cfo-advisory', 'CFO Advisory'],
  ]],
];
const FLAT = EXPECTED.flatMap(([group, , list]) => list.map(([slug, title]) => ({ group, slug, title })));
const num = (i) => String(i + 1).padStart(2, '0');

// A. Config ------------------------------------------------------------------
const { SERVICES, SERVICE_GROUPS, relatedServices, serviceGroupOf } = cfg;
check('A: nine services', SERVICES.length === 9, `got ${SERVICES.length}`);
check(
  'A: three groups in deck order',
  JSON.stringify(SERVICE_GROUPS.map((g) => [g.key, g.index, g.name])) ===
    JSON.stringify(EXPECTED.map(([k, n], i) => [k, i + 1, n])),
);
FLAT.forEach((e, i) => {
  const s = SERVICES[i];
  check(`A: position ${num(i)} is ${e.slug}`, s?.slug === e.slug, `got ${s?.slug}`);
  check(`A: ${e.slug} numbered ${num(i)}`, s?.number === num(i), `got ${s?.number}`);
  check(`A: ${e.slug} titled "${e.title}"`, s?.title === e.title, `got ${s?.title}`);
  check(`A: ${e.slug} in ${e.group}`, s?.group === e.group, `got ${s?.group}`);
});
check('A: no title still says Memorandums', !SERVICES.some((s) => /Memorandums/.test(s.title)));

// B. Migration 106 -------------------------------------------------------------
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/106_service_practice_groups.sql'), 'utf8');
const body = sql.slice(sql.indexOf('BEGIN;'));
check('B: has a SAFE TO APPLY line', /SAFE TO APPLY:/.test(sql));
const svcRows = [...body.matchAll(/\('([a-z-]+)', '(\d\d)', (\d+)\)/g)].map((m) => [m[1], m[2], Number(m[3])]);
check(
  'B: services numbers and orders match the config',
  JSON.stringify(svcRows) === JSON.stringify(SERVICES.map((s, i) => [s.slug, s.number, i + 1])),
  JSON.stringify(svcRows),
);
const kbRows = [...body.matchAll(/\('([a-z-]+)', (\d+)\)/g)].map((m) => [m[1], Number(m[2])]);
check(
  'B: KB sort orders follow the config order',
  JSON.stringify(kbRows) === JSON.stringify(SERVICES.map((s, i) => [s.slug, (i + 1) * 10])),
  JSON.stringify(kbRows),
);
for (const g of SERVICE_GROUPS) {
  check(`B: group_${g.index}_name is "${g.name}"`, body.includes(`'group_${g.index}_name', '${g.name}'`));
}
check('B: services title renamed, guarded', /SET title = 'Investment Memoranda'[\s\S]*?WHERE slug = 'investment-memorandums' AND title = 'Investment Memorandums'/.test(body));
check('B: page title renamed, guarded', /UPDATE cms_pages\s+SET title = 'Investment Memoranda'[\s\S]*?title = 'Investment Memorandums'/.test(body));
check('B: existing group names win', body.includes(") || content"));

// C. Grid render ---------------------------------------------------------------
const cards = SERVICES.map(({ slug, number, title, summary }) => ({ slug, number, title, summary }));
const grid = (content, list = cards) =>
  renderToStaticMarkup(React.createElement(ServiceGrid, { content, variant: 'white', context: { services: list } }));
const html = grid({});
const groupsOf = (h) => h.split('lg:grid-rows-subgrid').slice(1);
const sections = groupsOf(html);
check('C: three group sections', sections.length === 3, `got ${sections.length}`);
EXPECTED.forEach(([key, name, list], gi) => {
  const sec = sections[gi] ?? '';
  check(`C: group ${gi + 1} heading "${name}"`, sec.includes(`id="service-group-${key}"`) && sec.includes(`>${name.replace('&', '&amp;')}</h3>`));
  check(`C: group ${gi + 1} says 3 services`, />3 services</.test(sec));
  const hrefs = [...sec.matchAll(/href="\/services\/([a-z-]+)"/g)].map((m) => m[1]);
  check(`C: group ${gi + 1} cards in order`, JSON.stringify(hrefs) === JSON.stringify(list.map(([s]) => s)), JSON.stringify(hrefs));
});
const headerBg = sections.map((s) => (s.match(/<header[^>]*background:([^;"]+)/) ?? [])[1]);
check('C: header colours navy, deep navy, gold', JSON.stringify(headerBg) === JSON.stringify(['#1B3A5F', '#14304F', '#C69C3E']), JSON.stringify(headerBg));
check('C: gold header text is navy', /<header[^>]*background:#C69C3E;color:#14304F/.test(sections[2] ?? ''));
const tints = sections.map((s) => (s.match(/<a [^>]*background:([^;"]+)/) ?? [])[1]);
check('C: cards take three distinct light tints', new Set(tints).size === 3 && tints.every((t) => /^#[EF][0-9A-F]{5}$/.test(t ?? '')), JSON.stringify(tints));
check('C: numbers 01 to 09 in page order', JSON.stringify([...html.matchAll(/text-2xl[^>]*>(\d\d)</g)].map((m) => m[1])) === JSON.stringify(SERVICES.map((_, i) => num(i))));
check('C: three columns from lg, stacked below', html.includes('flex flex-col gap-12 lg:grid lg:grid-cols-3'));
check('C: group names editable', grid({ group_2_name: 'Deals' }).includes('>Deals</h3>'));
const cleared = grid({ group_1_name: '' });
check('C: cleared name drops the heading', !cleared.includes('id="service-group-modeling-valuation"'));
check('C: cleared name keeps the count', (groupsOf(cleared)[0] ?? '').includes('>3 services<'));
const extra = grid({}, [...cards, { slug: 'new-line', number: '10', title: 'New Line', summary: '' }]);
check('C: unknown slug joins the last group', (groupsOf(extra)[2] ?? '').includes('/services/new-line') && />4 services</.test(extra));
check('C: empty collection renders no groups', groupsOf(grid({}, [])).length === 0);

// D. Related services and detail number -----------------------------------------
for (const s of SERVICES) {
  const rel = relatedServices(s.slug).map((r) => r.slug);
  const siblings = SERVICES.filter((x) => x.group === s.group && x.slug !== s.slug).map((x) => x.slug);
  const gi = SERVICE_GROUPS.findIndex((g) => g.key === s.group);
  const nextFirst = SERVICES.find((x) => x.group === SERVICE_GROUPS[(gi + 1) % 3].key).slug;
  check(`D: ${s.slug} related`, JSON.stringify(rel) === JSON.stringify([...siblings, nextFirst]), JSON.stringify(rel));
  const detail = renderToStaticMarkup(
    React.createElement(ServiceDetail, { content: { service_slug: s.slug, show_header: true }, variant: 'white' }),
  );
  check(`D: ${s.slug} header prints ${s.number}`, detail.includes(`Service · ${s.number}`));
}
check('D: groupOf falls back to the last group', serviceGroupOf('nope') === 'capital-finance');

// E. Live database, read only ---------------------------------------------------
if (process.argv.includes('--db')) {
  const { createClient } = await import('@supabase/supabase-js');
  for (const l of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const i = l.indexOf('=');
    if (i > 0 && !l.trim().startsWith('#')) {
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
      process.env[k] ??= v;
    }
  }
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from('services').select('slug,number,title').eq('status', 'published').order('display_order');
  check('E: services readable', !error, error?.message);
  check(
    'E: live services match the config',
    JSON.stringify((data ?? []).map((r) => [r.slug, r.number, r.title])) === JSON.stringify(SERVICES.map((s) => [s.slug, s.number, s.title])),
    JSON.stringify((data ?? []).map((r) => `${r.number} ${r.slug}`)),
  );
}

console.log(`verify-service-groups: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log('  FAIL ' + f);
process.exitCode = failures.length ? 1 : 0;
