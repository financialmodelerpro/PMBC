// scripts/verify-tools-visibility.mjs
//
// Proves the one-switch rule for the free tools: a tool's visibility at
// /admin/tools decides its page, the hub, the sitemap, its structured data, the
// footer Free Tools link and its service page CTA, and every failure mode means
// Hidden.
//
// The navbar Tools item is an operator's switch in Pages & Nav (a site_pages
// row, migration 081, shipped hidden), and the footer Free Tools link follows
// it. Either reaches the public only when that row is on AND a tool is Live.
// Proved here in three states: nav off; nav on with nothing Live (public sees
// nothing, staff see a Hidden badge, Pages & Nav warns); nav on with a tool
// Live (public sees the link and the hub).
//
// Also proves TOOLS_VISIBILITY_OVERRIDE, the local verification switch, is
// ignored whenever VERCEL is set, so it cannot change a deployment.
//
// PART 1, ALWAYS: the rules, run against `src/lib/tools/visibility.ts` with
// hand-built database answers (table missing, read error, no rows, live, a draft
// marked live, a garbage status), plus source checks that each public surface
// asks that module and nothing else.
//
// PART 2, WITH VERIFY_BASE: the same rules observed over HTTP as a logged-out
// visitor. Run against a local build or production:
//
//   npm run verify-tools-visibility
//   VERIFY_BASE=http://localhost:3999 npm run verify-tools-visibility
//   VERIFY_BASE=https://www.pacemakersglobal.com EXPECT_LIVE= npm run verify-tools-visibility
//
// EXPECT_LIVE is a comma-separated list of tool slugs expected to be Live on
// that base URL. Empty (the default) means every tool must be Hidden.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const vis = await jiti.import(path.join(root, 'src/lib/tools/visibility.ts'));
const reg = await jiti.import(path.join(root, 'src/config/tools.ts'));
const nav = await jiti.import(path.join(root, 'src/lib/tools/navSetting.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}
const src = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const READY = reg.TOOLS.find((t) => t.build === 'ready');
const DRAFT = reg.TOOLS.find((t) => t.build === 'draft');
const row = (slug, status) => ({ slug, status, updated_at: '2026-09-16T10:00:00Z', updated_by: null });
const LINKS = [
  { id: 'services', label: 'Services', href: '/services', column: 'firm', visible: true },
  { id: 'fmp', label: 'Financial Modeler Pro', href: '/fmp', column: 'firm', visible: true },
  { id: 'tools', label: 'Free Tools', href: '/tools/', column: 'firm', visible: true },
  { id: 'contact', label: 'Contact', href: '/contact', column: 'firm', visible: true },
];

console.log('Rules');
{
  const cases = [
    ['table missing', { ok: false, reason: 'missing_table' }, 'missing_table'],
    ['read error', { ok: false, reason: 'error', message: 'boom' }, 'error'],
    ['no rows', { ok: true, rows: [] }, null],
    ['hidden row', { ok: true, rows: [row(READY.slug, 'hidden')] }, null],
    ['garbage status', { ok: true, rows: [row(READY.slug, 'LIVE')] }, null],
  ];
  for (const [label, read, problem] of cases) {
    const snap = vis.resolveVisibility(read);
    check(`${label}: every tool Hidden`, snap.tools.every((t) => !t.live), JSON.stringify(snap.tools.map((t) => [t.slug, t.live])));
    check(`${label}: problem reported`, snap.problem === problem, String(snap.problem));
    check(`${label}: no sitemap paths`, vis.toolSitemapPaths(snap).length === 0);
    check(`${label}: footer has no Free Tools link even with the nav row on, stored one removed`, !vis.applyToolsFooterLink(LINKS, snap, reg.TOOLS_FOOTER_LINK, true).some((l) => l.href.startsWith('/tools')));
    check(`${label}: no service CTA`, vis.serviceCtasFor(snap, READY.serviceCta.serviceSlug).length === 0);
  }

  const live = vis.resolveVisibility({ ok: true, rows: [row(READY.slug, 'live')] });
  check('live row: ready tool Live', vis.findToolIn(live, READY.slug)?.live === true);
  check('live row: sitemap has hub and tool', JSON.stringify(vis.toolSitemapPaths(live)) === JSON.stringify(['/tools', `/tools/${READY.slug}`]), JSON.stringify(vis.toolSitemapPaths(live)));
  const footer = vis.applyToolsFooterLink(LINKS, live, reg.TOOLS_FOOTER_LINK, true);
  check('live row, nav row off: no Free Tools link, stored one removed', !vis.applyToolsFooterLink(LINKS, live, reg.TOOLS_FOOTER_LINK, false).some((l) => l.href.startsWith('/tools')));
  check('live row: exactly one Free Tools link', footer.filter((l) => l.href.startsWith('/tools')).length === 1, JSON.stringify(footer));
  check('live row: Free Tools placed after Financial Modeler Pro', footer.findIndex((l) => l.href === '/tools') === footer.findIndex((l) => l.href === '/fmp') + 1);
  check('live row: Free Tools link visible', footer.find((l) => l.href === '/tools')?.visible === true);
  check('live row: service CTA shown on its service page', vis.serviceCtasFor(live, READY.serviceCta.serviceSlug).length === 1);
  check('live row: no CTA on another service page', vis.serviceCtasFor(live, 'cfo-advisory').length === 0);

  if (DRAFT) {
    const draftLive = vis.resolveVisibility({ ok: true, rows: [row(DRAFT.slug, 'live')] });
    check('draft marked live stays Hidden', vis.findToolIn(draftLive, DRAFT.slug)?.live === false);
    check('draft marked live is not in the sitemap', vis.toolSitemapPaths(draftLive).length === 0);
    console.log(`  draft "${DRAFT.slug}" stays Hidden even with a live row`);
  }
}

console.log('Navbar Tools item (Pages & Nav)');
{
  const BASE_NAV = [
    { label: 'Services', href: '/services' },
    { label: 'Financial Modeler Pro', href: '/fmp' },
    { label: 'Contact', href: '/contact' },
  ];
  // What NavbarServer receives: the visible Pages & Nav rows. The operator's
  // label and position travel with the row.
  const withTools = [BASE_NAV[0], { label: 'Free Tools', href: '/tools/' }, BASE_NAV[1], BASE_NAV[2]];
  const toolsItems = (items) => items.filter((i) => nav.isToolsHubHref(i.href));

  // State 1: nav row off.
  for (const [who, staff] of [['public', false], ['staff', true]]) {
    for (const liveCount of [0, 1]) {
      const out = nav.applyToolsNavSetting(BASE_NAV, liveCount, staff);
      check(`nav off, ${liveCount} Live, ${who}: no Tools item is ever added`, toolsItems(out).length === 0 && out.length === BASE_NAV.length);
    }
  }
  check('nav off: the session is never read', !nav.toolsNavNeedsSession(BASE_NAV, 0));
  check('nav off: Pages & Nav note for a hidden Tools row is informational', nav.toolsNavNotice({ href: '/tools', visible: false }, 0)?.tone === 'info');

  // State 2: nav row on, nothing Live.
  const pub = nav.applyToolsNavSetting(withTools, 0, false);
  check('nav on, nothing Live, public: no Tools item', toolsItems(pub).length === 0 && pub.length === 3);
  const staff = nav.applyToolsNavSetting(withTools, 0, true);
  check('nav on, nothing Live, staff: one Tools item badged Hidden', toolsItems(staff).length === 1 && toolsItems(staff)[0].badge === 'Hidden');
  check('nav on, nothing Live, staff: keeps the operator label and position', staff[1].label === 'Free Tools' && staff.map((i) => i.href).join() === withTools.map((i) => i.href).join());
  check('nav on, nothing Live: the session is read', nav.toolsNavNeedsSession(withTools, 0));
  const warn = nav.toolsNavNotice({ href: '/Tools/', visible: true }, 0);
  check('nav on, nothing Live: Pages & Nav warns, whatever the link casing', warn?.tone === 'warning' && /no tool is Live/.test(warn.text));

  // State 3: nav row on, a tool Live.
  for (const staffFlag of [false, true]) {
    const out = nav.applyToolsNavSetting(withTools, 1, staffFlag);
    check(`nav on, 1 Live, ${staffFlag ? 'staff' : 'public'}: Tools shown as the operator set it, no badge`, JSON.stringify(out) === JSON.stringify(withTools));
  }
  check('nav on, 1 Live: the session is not read', !nav.toolsNavNeedsSession(withTools, 1));
  check('nav on, 1 Live: Pages & Nav note is informational', nav.toolsNavNotice({ href: '/tools', visible: true }, 1)?.tone === 'info');

  check('other rows never get a notice', nav.toolsNavNotice({ href: '/services', visible: true }, 0) === null);
  check('input list not mutated', withTools[1].badge === undefined);
}

console.log('Local override');
{
  // No database credentials, so a real read fails closed instead of reaching the shared database.
  const saved = Object.fromEntries(['VERCEL', 'TOOLS_VISIBILITY_OVERRIDE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map((k) => [k, process.env[k]]));
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.VERCEL;
    process.env.TOOLS_VISIBILITY_OVERRIDE = 'live';
    const localLive = vis.resolveVisibility(await vis.readVisibilityRows());
    check('local, override live: every ready tool Live', reg.readyTools().every((t) => vis.findToolIn(localLive, t.slug)?.live));
    if (DRAFT) check('local, override live: a draft stays Hidden', vis.findToolIn(localLive, DRAFT.slug)?.live === false);
    process.env.TOOLS_VISIBILITY_OVERRIDE = 'hidden';
    const localHidden = vis.resolveVisibility(await vis.readVisibilityRows());
    check('local, override hidden: every tool Hidden, clean read', localHidden.tools.every((t) => !t.live) && localHidden.problem === null);
    process.env.TOOLS_VISIBILITY_OVERRIDE = 'yes';
    const junk = await vis.readVisibilityRows();
    check('local, unknown override value: ignored, real read attempted', junk.ok === false);

    process.env.VERCEL = '1';
    process.env.TOOLS_VISIBILITY_OVERRIDE = 'live';
    const onVercel = await vis.readVisibilityRows();
    check('on Vercel, override live: ignored, real read attempted', onVercel.ok === false, JSON.stringify(onVercel));
    check('on Vercel, override live: nothing Live', vis.resolveVisibility(onVercel).tools.every((t) => !t.live));
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  {
    const savedNav = { VERCEL: process.env.VERCEL, TOOLS_NAV_OVERRIDE: process.env.TOOLS_NAV_OVERRIDE };
    try {
      const items = [{ label: 'Services', href: '/services' }, { label: 'Financial Modeler Pro', href: '/fmp' }, { label: 'Contact', href: '/contact' }];
      delete process.env.VERCEL;
      process.env.TOOLS_NAV_OVERRIDE = 'on';
      const on = vis.withLocalToolsNavOverride(items);
      check('local, nav override on: Tools after Financial Modeler Pro', on[2]?.href === '/tools');
      check('local, nav override on: fetchToolsNavOn is true without a read', (await vis.fetchToolsNavOn()) === true);
      process.env.TOOLS_NAV_OVERRIDE = 'off';
      check('local, nav override off: Tools removed', !vis.withLocalToolsNavOverride([...items, { label: 'Tools', href: '/tools' }]).some((i) => i.href === '/tools'));
      process.env.VERCEL = '1';
      process.env.TOOLS_NAV_OVERRIDE = 'on';
      check('on Vercel, nav override ignored', JSON.stringify(vis.withLocalToolsNavOverride(items)) === JSON.stringify(items) && vis.localToolsNavOverride() === null);
    } finally {
      for (const [k, v] of Object.entries(savedNav)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }
  check('override is read only in visibility.ts', !/TOOLS_VISIBILITY_OVERRIDE/.test(src('src/components/layout/NavbarServer.tsx')) && /if \(process\.env\.VERCEL\) return null;/.test(src('src/lib/tools/visibility.ts')));
}

console.log('Surfaces ask visibility.ts and nothing else');
{
  const route = src('src/app/(public)/tools/[slug]/page.tsx');
  check('tool route resolves through fetchToolVisibility', /fetchToolVisibility\(\)/.test(route) && /findToolIn\(/.test(route));
  check('tool route 404s when Hidden and not staff', /if \(!live && !staff\) notFound\(\)/.test(route));
  check('tool route sends noindex when not Live', /robots: \{ index: false, follow: false \}/.test(route));
  check('tool route renders JSON-LD only when Live', /\{live && <ToolJsonLd/.test(route));
  check('tool route is not prerendered', !/generateStaticParams/.test(route) && /force-dynamic/.test(route));
  check('tool route shows the Admin preview banner', /AdminPreviewBanner/.test(route));

  const hub = src('src/app/(public)/tools/page.tsx');
  check('hub lists liveToolsFrom and 404s with none Live', /liveToolsFrom\(snapshot\)/.test(hub) && /if \(live\.length === 0 && !staff\) notFound\(\)/.test(hub));
  check('hub sends noindex with none Live', /robots: \{ index: false, follow: false \}/.test(hub));

  const sitemap = src('src/app/sitemap.ts');
  check('sitemap uses toolSitemapPaths', /toolSitemapPaths\(tools\)/.test(sitemap) && !/'\/tools'/.test(sitemap));
  check('sitemap is rendered per request', /export const dynamic = 'force-dynamic'/.test(sitemap));

  const navbar = src('src/components/layout/NavbarServer.tsx');
  check('navbar applies the Pages & Nav setting', navbar.includes('applyToolsNavSetting(filtered, live, staff)'));
  check('navbar reads the session only when the Tools row is on and nothing is Live', navbar.includes('toolsNavNeedsSession(filtered, live) ? Boolean(await getAdminSession()'));
  check('nothing adds a Tools item automatically any more', !src('src/lib/tools/visibility.ts').includes('applyToolsNavItem') && !navbar.includes('applyToolsNavItem'));
  check('footer passes the Pages & Nav Tools row', src('src/components/layout/FooterServer.tsx').includes('fetchToolsNavOn()') && /TOOLS_FOOTER_LINK,\s*toolsNavOn,/.test(src('src/components/layout/FooterServer.tsx')));
  check('Pages & Nav receives the Live count and renders the notice', src('src/app/admin/pages/page.tsx').includes('<SitePagesManager liveToolCount={liveToolCount} />') && src('src/components/admin/SitePagesManager.tsx').includes('toolsNavNotice('));
  {
    const sql = src('supabase/migrations/081_tools_nav_item.sql');
    check('migration 081 inserts Tools hidden, after FMP, only once', /SAFE TO APPLY:/.test(sql) && sql.includes("SELECT 'Tools', '/tools', (SELECT after_order FROM anchor) + 1, false, true") && sql.includes("lower(rtrim(href, '/')) = '/tools'") && !/DELETE/i.test(sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')));
  }
  check('navbar renders the badge on desktop and mobile', (src('src/components/layout/Navbar.tsx').match(/item\.badge && <NavBadge/g) ?? []).length === 2);

  const footer = src('src/components/layout/FooterServer.tsx');
  check('footer applies applyToolsFooterLink', /applyToolsFooterLink\(/.test(footer));
  check('no Free Tools link hardcoded in footer defaults', !/'\/tools'/.test(src('src/lib/cms/footerLinks.ts')));

  const service = src('src/app/(public)/services/[slug]/page.tsx');
  check('service page uses serviceCtasFor', /serviceCtasFor\(tools, slug\)/.test(service));
  check('service page drops stored tool CTAs', /withoutToolLinkSections\(rawSections\)/.test(service));

  const lead = src('src/app/api/tools/[slug]/lead/route.ts');
  check('lead API asks visibility and passes it on', /toolLive: live/.test(lead) && /fetchToolVisibility\(\)/.test(lead));

  const components = src('src/components/tools/toolComponents.ts');
  for (const t of reg.readyTools()) check(`ready tool "${t.slug}" has a component`, components.includes(`'${t.slug}':`));

  // The retired switches must not come back.
  check('retired hide/show script is gone', !fs.existsSync(path.join(root, 'scripts/set-tools-links-visibility.mjs')));
  check('retired link seed script is gone', !fs.existsSync(path.join(root, 'scripts/seed-tools-links.mjs')));

  const cta = await jiti.import(path.join(root, 'src/components/tools/ToolServiceCta.tsx'));
  const kept = cta.withoutToolLinkSections([
    { section_type: 'service_detail', content: {} },
    { section_type: 'cta_block', content: { cta_primary_href: '/tools/business-valuation' } },
    { section_type: 'cta_block', content: { cta_primary_href: '/contact' } },
  ]);
  check('stored tool CTA filtered, other CTAs kept', kept.length === 2 && kept.every((s) => s.content.cta_primary_href !== '/tools/business-valuation'));
}

console.log('Other tools on each tool page');
{
  const other = await jiti.import(path.join(root, 'src/lib/tools/otherTools.ts'));
  const registry = [
    { ...READY, slug: 'one', name: 'One', build: 'ready' },
    { ...READY, slug: 'two', name: 'Two', build: 'ready' },
    { ...READY, slug: 'three', name: 'Three', build: 'ready' },
    { ...READY, slug: 'draft', name: 'Draft', build: 'draft' },
  ];
  const snap = vis.resolveVisibility({ ok: true, rows: [row('one', 'live'), row('two', 'live'), row('three', 'hidden'), row('draft', 'live')] }, registry);
  const pub = other.otherToolsFor(snap, 'one', { staff: false }).map((t) => t.slug);
  check('public: other Live tools, in registry order, never the current one', JSON.stringify(pub) === JSON.stringify(['two']), JSON.stringify(pub));
  const staff = other.otherToolsFor(snap, 'one', { staff: true }).map((t) => t.slug);
  check('staff preview: Hidden ready tools too, never drafts', JSON.stringify(staff) === JSON.stringify(['two', 'three']), JSON.stringify(staff));
  check('a newly Live tool is offered with no other change', other.otherToolsFor(vis.resolveVisibility({ ok: true, rows: [row('one', 'live'), row('two', 'live'), row('three', 'live')] }, registry), 'one', { staff: false }).length === 2);
  check('nothing else Live: nothing offered', other.otherToolsFor(vis.resolveVisibility({ ok: true, rows: [row('one', 'live')] }, registry), 'one', { staff: false }).length === 0);
  check('a failed visibility read offers nothing', other.otherToolsFor(vis.resolveVisibility({ ok: false, reason: 'error' }, registry), 'one', { staff: false }).length === 0);
  const page = src('src/app/(public)/tools/[slug]/page.tsx');
  check('every tool page renders the section from otherToolsFor', page.includes('<OtherTools tools={otherToolsFor(snapshot, slug, { staff: Boolean(staff) })} preview={preview} />'));
  const section = src('src/components/tools/OtherTools.tsx');
  check('the section renders nothing when there is nothing to offer', section.includes('if (tools.length === 0) return null;'));
  check('the hub and the section draw the same card', section.includes('<ToolCard') && src('src/app/(public)/tools/page.tsx').includes('<ToolCard'));
}

const BASE = process.env.VERIFY_BASE?.replace(/\/+$/, '');
if (BASE) {
  const expectLive = new Set((process.env.EXPECT_LIVE ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  console.log(`HTTP, logged out, against ${BASE} (expected Live: ${[...expectLive].join(', ') || 'none'})`);
  const get = async (p) => {
    const res = await fetch(BASE + p, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
    return { status: res.status, text: await res.text() };
  };
  const anyLive = expectLive.size > 0;
  const hub = await get('/tools');
  check(`/tools is ${anyLive ? '200' : '404'}`, hub.status === (anyLive ? 200 : 404), String(hub.status));
  if (!anyLive) check('/tools 404 carries noindex', /<meta name="robots" content="noindex/.test(hub.text));
  for (const t of reg.TOOLS) {
    const shouldLive = expectLive.has(t.slug) && t.build === 'ready';
    const page = await get(`/tools/${t.slug}`);
    check(`/tools/${t.slug} is ${shouldLive ? '200' : '404'}`, page.status === (shouldLive ? 200 : 404), String(page.status));
    if (!shouldLive) {
      check(`/tools/${t.slug} has noindex`, /<meta name="robots" content="noindex/.test(page.text));
      check(`/tools/${t.slug} has no WebApplication JSON-LD`, !page.text.includes('"WebApplication"'));
      check(`/tools/${t.slug} shows no Admin preview banner to the public`, !page.text.includes('Admin preview'));
    }
  }
  const sitemap = await get('/sitemap.xml');
  check('sitemap.xml is 200', sitemap.status === 200, String(sitemap.status));
  check(`sitemap ${anyLive ? 'lists' : 'has no'} /tools`, sitemap.text.includes('/tools</loc>') === anyLive);
  for (const t of reg.TOOLS) {
    check(`sitemap ${expectLive.has(t.slug) ? 'lists' : 'omits'} /tools/${t.slug}`, sitemap.text.includes(`/tools/${t.slug}</loc>`) === expectLive.has(t.slug));
  }
  const home = await get('/');
  // EXPECT_TOOLS_NAV=on when the Pages & Nav Tools row is switched on at that base URL.
  const navOn = process.env.EXPECT_TOOLS_NAV === 'on';
  check(`home ${anyLive && navOn ? 'links' : 'does not link'} to /tools (navbar and footer)`, /href="\/tools"/.test(home.text) === (anyLive && navOn));
  check('no Hidden badge served to the public', !/>Hidden</.test(home.text));
  const service = await get(`/services/${READY.serviceCta.serviceSlug}`);
  check('service page is 200', service.status === 200, String(service.status));
  check(
    `service page ${expectLive.has(READY.slug) ? 'has' : 'has no'} tool CTA`,
    service.text.includes(`href="/tools/${READY.slug}"`) === expectLive.has(READY.slug),
  );
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
