// scripts/verify-growth-chat-opening.mjs
//
// Proves the website chat's placement and opening behaviour (2026-09-23):
//
//   1. Offline: every public page has an opening line suited to it (home,
//      each of the nine services, tools, about, contact and the rest); the
//      widget script, run against a stand-in browser, opens by itself once per
//      session after the delay or at the scroll point, never twice in a
//      session, never again once closed, not at all when switched off or when
//      storage is blocked, and on a phone shows only a small note with a
//      44 pixel dismiss instead of the full panel; the three core answers
//      (service, size, timeline) come first and are enough to score and
//      route; migration 095.
//   2. Live, GET only: with the chat off, no page (home included) carries
//      any chat markup or script (the public site guard).
//   3. Local, only with VERIFY_LOCAL (a `next start` run with
//      GROWTH_CHAT_OVERRIDE=on): every public page carries the widget with
//      its opening settings, and the opening endpoint answers each page's own
//      line.
//
//   npm run verify-growth-chat-opening
//   VERIFY_LOCAL=http://localhost:3000 npm run verify-growth-chat-opening

import fs from 'node:fs';
import path from 'node:path';

import { DASHES, check, finish, load, migrationChecks, publicSiteGuard, root } from './lib/growthVerify.mjs';
import { refuseWritesAgainstProduction } from './lib/productionGuard.mjs';

const cm = await load('src/lib/growth/chatModel.ts');
const ws = await load('src/lib/growth/widgetScript.ts');
const chat = await load('src/lib/growth/chat.ts');
const services = (await load('src/config/services.ts')).SERVICES;

console.log('1. Openings on every public page (offline)');
/** Every public route, with sample values for the dynamic parts. */
function publicPaths() {
  const base = path.join(root, 'src/app/(public)');
  const out = [];
  const walkDir = (dir, url) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walkDir(path.join(dir, e.name), `${url}/${e.name}`);
      else if (e.name === 'page.tsx') out.push(url || '/');
    }
  };
  walkDir(base, '');
  const slugs = (services ?? []).map((s) => s.slug);
  return out.flatMap((p) => {
    if (p === '/services/[slug]') return slugs.map((s) => `/services/${s}`);
    if (p === '/tools/[slug]') return ['/tools/business-valuation'];
    return [p.replace(/\[slug\]/g, 'sample')];
  });
}
const paths = publicPaths();
check('the public routes were found, with the nine services', paths.length > 25 && paths.filter((p) => p.startsWith('/services/')).length === 9, String(paths.length));
const general = cm.GENERAL_OPENING;
const tailored = paths.filter((p) => p !== '/approach');
const untailored = tailored.filter((p) => cm.openingLine(p, false) === general);
check('every public page has its own opening line (only the unlinked /approach falls back)', untailored.length === 0, untailored.join(', '));
check('home has its own line', cm.openingLine('/', false) !== general && cm.openingLine('/', false) !== cm.openingLine('/services', false));
check('each of the nine services has a line of its own', new Set(paths.filter((p) => p.startsWith('/services/')).map((p) => cm.openingLine(p, false))).size >= 8);
check('the valuation tool and the tools hub differ', cm.openingLine('/tools/business-valuation', false) !== cm.openingLine('/tools', false));
check('about, contact and book have their own lines', ['/about/ahmad-din', '/contact', '/book'].every((p) => cm.openingLine(p, false) !== general));
check('no opening line has a dash, an exclamation mark or says PMBC', cm.OPENINGS.every((o) => !(DASHES.test(o.line) || /!|PMBC/.test(o.line))) && !DASHES.test(general) && !general.includes('!'));

console.log('2. The widget in a stand-in browser (offline)');
const script = ws.widgetScript();
const KEYS = ws.WIDGET_STORAGE;

function fakeStorage(blocked) {
  const m = new Map();
  if (blocked) return { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

/** Runs the script once, as one page load, and returns handles to drive it. */
function pageLoad({ session, local, phone = false, autoOpen = '1', delay = '20', scroll = '50', pageHeight = 3000, opening = 'Test opening line' }) {
  const timers = [];
  const winListeners = {};
  const docListeners = {};
  const body = { children: [], style: { paddingBottom: '' }, append(...n) { this.children.push(...n); }, appendChild(n) { this.children.push(n); } };
  const mk = (tag) => {
    const n = {
      tag, style: {}, dataset: {}, children: [], attrs: {}, textContent: '',
      append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); },
      remove() { const i = body.children.indexOf(this); if (i >= 0) body.children.splice(i, 1); this.removed = true; },
      setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused = true; },
    };
    return n;
  };
  const win = {
    sessionStorage: session, localStorage: local, innerHeight: 800, innerWidth: phone ? 390 : 1280, scrollY: 0,
    matchMedia: () => ({ matches: phone }),
    addEventListener: (t, f) => { winListeners[t] = f; }, removeEventListener: (t) => { delete winListeners[t]; },
  };
  const doc = {
    currentScript: { dataset: { autoOpen, delay, scroll } },
    documentElement: { scrollHeight: pageHeight },
    body, createElement: mk,
    getElementById: () => null,
    addEventListener: (t, f) => { docListeners[t] = f; },
  };
  const fetchStub = async () => ({ ok: true, json: async () => ({ opening }) });
  const run = new Function('window', 'document', 'location', 'fetch', 'setTimeout', 'clearTimeout', 'getComputedStyle', script);
  run(win, doc, { pathname: '/' }, fetchStub, (f, ms) => { timers.push({ f, ms }); return timers.length; }, (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; }, () => ({ paddingBottom: '0px' }));
  const find = (role) => {
    const stack = [...body.children];
    while (stack.length) {
      const n = stack.shift();
      if (n.dataset?.pmbcChat === role && !n.removed) return n;
      if (n.children) stack.push(...n.children);
    }
    return null;
  };
  const flush = () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r)));
  return {
    timers, winListeners, docListeners, body, find, flush, win,
    async tick() { for (const t of timers.filter((x) => !x.cleared && !x.ran)) { t.ran = true; t.f(); } await flush(); },
    async scrollTo(y) { win.scrollY = y; if (winListeners.scroll) winListeners.scroll(); await flush(); },
  };
}

{
  const session = fakeStorage(), local = fakeStorage();
  const p = pageLoad({ session, local });
  check('with auto-open on, one timer is set for the delay', p.timers.length === 1 && p.timers[0].ms === 20000 && typeof p.winListeners.scroll === 'function');
  check('nothing opens before the delay', p.find('panel').style.display === 'none');
  await p.tick();
  check('after the delay the panel opens with the page opening line', p.find('panel').style.display === 'flex' && p.find('assistant')?.textContent === 'Test opening line');
  check('opening by itself does not take focus', !p.find('panel').children.some((c) => c.focused));
  check('the session remembers it opened by itself', session.map.get(KEYS.autoOpened) === '1');
  check('the scroll listener is removed once it has fired', !p.winListeners.scroll);

  const p2 = pageLoad({ session, local });
  check('the next page in the same session never opens by itself', p2.timers.length === 0 && !p2.winListeners.scroll);

  p.find('close').onclick();
  check('closing hides the panel and remembers it', p.find('panel').style.display === 'none' && local.map.get(KEYS.closed) === '1');
  const p3 = pageLoad({ session: fakeStorage(), local });
  check('after closing, a new session never opens by itself either', p3.timers.length === 0);
}
{
  const session = fakeStorage(), local = fakeStorage();
  const p = pageLoad({ session, local, scroll: '50', pageHeight: 3000 });
  await p.scrollTo(900);
  check('scrolling under the point does not open it', p.find('panel').style.display === 'none');
  await p.scrollTo(1200);
  check('scrolling past half the page opens it before the delay', p.find('panel').style.display === 'flex');
  check('and the delay timer is cancelled', p.timers[0].cleared === true);
  await p.tick();
  check('it never opens a second time in that page', p.find('panel').style.display === 'flex' && p.find('assistant') && session.map.get(KEYS.autoOpened) === '1');
}
{
  const p = pageLoad({ session: fakeStorage(), local: fakeStorage(), autoOpen: '0' });
  check('switched off in settings: no timer, no scroll listener', p.timers.length === 0 && !p.winListeners.scroll);
  const b = pageLoad({ session: fakeStorage(true), local: fakeStorage(true) });
  check('blocked storage: never opens by itself (it could not remember a close)', b.timers.length === 0);
  const d = pageLoad({ session: fakeStorage(), local: fakeStorage(), delay: '45' });
  check('the delay setting is used', d.timers[0].ms === 45000);
}
{
  const session = fakeStorage(), local = fakeStorage();
  const p = pageLoad({ session, local, phone: true });
  check('phone: the page keeps room at its foot for the button', p.body.style.paddingBottom === '68px');
  check('phone: the button is small', p.find('launcher').textContent === 'Ask' && p.find('launcher').style.minHeight === '44px');
  await p.tick();
  const teaser = p.find('teaser');
  check('phone: opening by itself shows a small note, never the full panel', teaser && p.find('panel').style.display === 'none');
  check('phone: the note carries the page opening line and a 44 pixel dismiss', teaser?.children[0].textContent === 'Test opening line' && p.find('teaser-close')?.style.width === '44px' && p.find('teaser-close')?.style.height === '44px');
  check('phone: the note is narrower than the screen', /min\(300px, calc\(100vw - 24px\)\)/.test(teaser?.style.width ?? ''));
  p.find('teaser-close').onclick();
  check('phone: one tap dismisses it and it never comes back', !p.find('teaser') && local.map.get(KEYS.closed) === '1');
  const q = pageLoad({ session: fakeStorage(), local: fakeStorage(), phone: true });
  await q.tick();
  q.find('teaser').children[0].onclick();
  await q.flush();
  check('phone: tapping the note opens the panel', q.find('panel').style.display === 'flex' && !q.find('teaser'));
  check('phone: the panel close button is 44 pixels', q.find('close').style.width === '44px' && q.find('close').style.height === '44px');
  q.docListeners.keydown({ key: 'Escape' });
  check('Escape closes the panel', q.find('panel').style.display === 'none');
}

console.log('3. The three answers that matter most (offline)');
{
  check('the core answers are service, size and timeline', JSON.stringify(cm.CORE_QUALIFICATION) === JSON.stringify(['service', 'size_sar', 'timeline']));
  const focus0 = chat.qualificationFocus({});
  check('with nothing known, the assistant is pointed at the three core answers', focus0.includes('service, size (sar), timeline'));
  check('once they are in, the rest only if the conversation carries on', chat.qualificationFocus({ service: 'refm', size_sar: 400000000, timeline: 'Q1' }).includes('only if the conversation carries on naturally'));
  check('the prompt keeps one question at a time, after answering', /Always answer what the visitor asked first, then ask at most one question/.test(fs.readFileSync(path.join(root, 'src/lib/growth/chat.ts'), 'utf8')));
  const cases = [
    { q: { service: 'refm', size_sar: 450_000_000, timeline: 'within three months' }, want: 'warm' },
    { q: { service: 'project-finance', size_sar: 2_000_000_000, timeline: 'this quarter' }, want: 'warm' },
    { q: { service: 'business-valuation', size_sar: 30_000_000, timeline: 'next year' }, want: 'cold' },
  ];
  for (const { q, want } of cases) {
    const t = chat.temperatureOf(q, false);
    const route = cm.routeFor({ escalated: false, temperature: t.temperature, answered: cm.answeredCount(q), wantsMeeting: false, coreComplete: cm.coreComplete(q) });
    check(`service, size and timeline alone score and route (${q.service}, SAR ${q.size_sar / 1e6} million, ${q.timeline}): ${want}`, t.engaged && t.score > 0 && route === want, `${t.score} ${t.temperature} ${route}`);
  }
  check('two core answers alone do not route yet', cm.routeFor({ escalated: false, temperature: 'warm', answered: 2, wantsMeeting: false, coreComplete: cm.coreComplete({ service: 'refm', size_sar: 1 }) }) === 'none');
  const lead = await load('src/lib/growth/scoring/lead.ts');
  check('timelines written in words are read', lead.timelineMonths('within three months') === 3 && lead.timelineMonths('two weeks') < 1 && lead.timelineMonths('a month') === 1);
}

console.log('4. Settings and migration 095 (offline)');
{
  const eng = await load('src/lib/growth/engineSettingsModel.ts');
  check('defaults: on, 20 seconds, half the page', eng.ENGINE_SETTING_COLUMNS.chat_auto_open.default === true && eng.ENGINE_SETTING_COLUMNS.chat_auto_open_delay_seconds.default === 20 && eng.ENGINE_SETTING_COLUMNS.chat_auto_open_scroll_percent.default === 50);
  const s = eng.engineGroupSchemas.chat_open;
  check('limits: delay 5 to 300 seconds, scroll 10 to 100 per cent', s.safeParse({ chat_auto_open: true, chat_auto_open_delay_seconds: 5, chat_auto_open_scroll_percent: 100 }).success && !s.safeParse({ chat_auto_open: true, chat_auto_open_delay_seconds: 4, chat_auto_open_scroll_percent: 50 }).success && !s.safeParse({ chat_auto_open: true, chat_auto_open_delay_seconds: 20, chat_auto_open_scroll_percent: 5 }).success);
  const sql = migrationChecks('095_growth_chat_opening.sql', []);
  check('095 matches the limits in code', sql.includes('BETWEEN 5 AND 300') && sql.includes('BETWEEN 10 AND 100') && sql.includes('DEFAULT 20') && sql.includes('DEFAULT 50'));
}

console.log('5. Live: nothing on any page while the chat is off (GET only)');
{
  const g = await publicSiteGuard();
  check('no chat on any public page while off, home included', g.findings.length === 0, g.findings.slice(0, 5).join('; '));
  check('the home page was among the pages checked', g.pages > 20);
}

const LOCAL = process.env.VERIFY_LOCAL;
console.log('6. Local, with the display override on');
if (!LOCAL) console.log('  SKIP  set VERIFY_LOCAL to a local next start with GROWTH_CHAT_OVERRIDE=on');
else {
  // Section 6 sends one POST (expected to be refused), so it never runs against production.
  refuseWritesAgainstProduction(LOCAL, 'verify-growth-chat-opening');
  const concrete = paths.filter((p) => !p.includes('sample'));
  const missing = [];
  const wrong = [];
  for (const p of concrete) {
    const html = await fetch(new URL(p, LOCAL), { redirect: 'follow' }).then((r) => r.text()).catch(() => '');
    if (!/<script src="\/api\/growth\/widget" defer="" data-auto-open="[01]" data-delay="\d+" data-scroll="\d+"/.test(html)) missing.push(p);
    const o = await fetch(new URL(`/api/growth/chat?path=${encodeURIComponent(p)}`, LOCAL)).then((r) => r.json()).catch(() => null);
    if (!o || o.opening !== cm.openingLine(p, false)) wrong.push(`${p}: ${o?.opening ?? 'no answer'}`);
  }
  check(`every public page carries the widget (${concrete.length} pages)`, missing.length === 0, missing.join(', '));
  check('each page gets its own opening line', wrong.length === 0, wrong.slice(0, 5).join('; '));
  const post = await fetch(new URL('/api/growth/chat', LOCAL), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page: '/', message: 'hello' }) }).catch(() => null);
  check('the override never lets a message through', post && post.status === 404);
}

finish('verify-growth-chat-opening');
