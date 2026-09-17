// scripts/verify-booking-links.mjs
//
// Proves the short booking links and the clean /book address.
//
// WITHOUT A SERVER (always)
//   1. Link ids: 12 characters from the 56 character alphabet, random, unique
//      over thousands, every character used; paths round-trip for each channel;
//      malformed slugs (wrong length, look-alike characters, unknown channel, an
//      access token) are refused.
//   2. Short link: a known id records the click once, with its channel, and
//      returns /book with the attribution (campaign, channel, lead reference);
//      an unknown well-formed id records nothing and sets no cookie; a
//      malformed slug never reaches the database.
//   3. Long link (emails and PDFs already sent): recorded once, cleaned to /book,
//      the cookie's reference is the lead's short id (issued if it has none),
//      never the token; an unknown token records nothing.
//   4. The redirect response: 302 to /book with no query string, never cached,
//      and a cookie holding no token, name or email.
//   5. Attribution reaches the booking calendar: cookie round trip, utm tags and
//      the lead reference on the calendar URL; /book reads query then cookie.
//   6. A short link opens the booking page only: the short link route calls
//      nothing but the redirect, and every route that returns lead data, a PDF
//      or a saved version still requires the access token.
//   7. The results page, emails and PDFs carry the short link.
//
// OVER HTTP (with VERIFY_BASE; GET only, unknown ids only, so nothing is
// recorded; safe against production)
//   8. An unknown short id and an unknown long link redirect to a clean /book
//      and set no lead reference.
//   9. /book with UTM and click ids: headless Chrome shows a clean /book in the
//      address bar without reloading, and the cookie holds the tags; a
//      non-tracking parameter (preview=1) is kept.
//
//   npm run verify-booking-links
//   VERIFY_BASE=http://127.0.0.1:3107 npm run verify-booking-links

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const links = await jiti.import(path.join(root, 'src/lib/tools/bookingLinks.ts'));
const redirect = await jiti.import(path.join(root, 'src/lib/tools/bookingRedirect.ts'));
const booking = await jiti.import(path.join(root, 'src/lib/tools/booking.ts'));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('1. Link ids');
{
  const ids = Array.from({ length: 5000 }, () => links.newBookingLinkId((n) => randomBytes(n)));
  check('12 characters, at least 10', ids.every((id) => id.length === 12) && links.BOOKING_LINK_ID_LENGTH >= 10);
  check('only the alphabet, no look-alikes (0, O, 1, l, I)', ids.every(links.isBookingLinkId) && !/[0O1lI]/.test(links.BOOKING_LINK_ALPHABET));
  check('unique over 5,000', new Set(ids).size === ids.length);
  const seen = new Set(ids.join(''));
  check('every character of the alphabet used', [...links.BOOKING_LINK_ALPHABET].every((c) => seen.has(c)));
  check('about 70 bits of randomness', 12 * Math.log2(links.BOOKING_LINK_ALPHABET.length) > 69);
  const id = ids[0];
  for (const ch of ['results', 'email', 'pdf']) {
    const p = links.bookingLinkPath(id, ch);
    const parsed = links.parseBookingLinkSlug(p.slice(3));
    check(`${ch}: path round-trips`, p.startsWith('/b/') && parsed?.id === id && parsed?.channel === ch, p);
  }
  const token = randomBytes(32).toString('base64url');
  for (const [label, slug] of [['too short', id.slice(0, 11) + 'r'], ['too long', id + 'rr'], ['look-alike character', '0' + id.slice(1) + 'r'], ['unknown channel', id + 'x'], ['an access token', token], ['empty', ''], ['path traversal', '../book/abcd']]) {
    check(`refused: ${label}`, links.parseBookingLinkSlug(slug) === null);
  }
}

function fakeDeps({ known = {}, tokens = {}, linkFor = {} } = {}) {
  const calls = { leadIdForLink: 0, leadById: 0, leadByToken: 0, linkIdForLead: 0, issueLink: 0, record: [] };
  const leads = { L1: { id: 'L1', tool_slug: 'business-valuation', name: 'Secret Name', email: 'secret@example.com', access_token: 'TOKEN-SECRET' } };
  return {
    calls,
    deps: {
      leadIdForLink: async (id) => (calls.leadIdForLink++, known[id] ?? null),
      leadById: async (id) => (calls.leadById++, leads[id] ?? null),
      leadByToken: async (t) => (calls.leadByToken++, tokens[t] ? leads[tokens[t]] : null),
      linkIdForLead: async (id) => (calls.linkIdForLead++, linkFor[id] ?? null),
      issueLink: async () => (calls.issueLink++, 'NEWkmnpqrstu'),
      recordClick: async (lead, channel, ua) => calls.record.push({ lead: lead.id, channel, ua }),
    },
  };
}

console.log('2. Short link');
{
  const id = links.newBookingLinkId((n) => randomBytes(n));
  const { calls, deps } = fakeDeps({ known: { [id]: 'L1' } });
  const out = await redirect.resolveShortLink(`${id}p`, 'UA', deps);
  check('known id: to /book', out.location === '/book');
  check('known id: click recorded once, with the channel', calls.record.length === 1 && calls.record[0].channel === 'pdf' && calls.record[0].lead === 'L1', JSON.stringify(calls.record));
  check('known id: attribution carries campaign, channel and the link id as reference', out.recorded && out.attribution?.campaign === 'business-valuation' && out.attribution?.content === 'pdf' && out.attribution?.ref === id && out.attribution?.source === 'pacemakersglobal' && out.attribution?.medium === 'free-tool', JSON.stringify(out.attribution));

  const other = links.newBookingLinkId((n) => randomBytes(n));
  const u = fakeDeps({ known: { [id]: 'L1' } });
  const unknown = await redirect.resolveShortLink(`${other}e`, 'UA', u.deps);
  check('unknown id: to /book, nothing recorded, no cookie', unknown.location === '/book' && !unknown.recorded && unknown.attribution === null && u.calls.record.length === 0 && u.calls.leadById === 0);

  const m = fakeDeps({ known: { [id]: 'L1' } });
  for (const slug of [id, `${id}x`, 'TOKEN-SECRET', '']) await redirect.resolveShortLink(slug, 'UA', m.deps);
  check('malformed slugs: to /book without a database read', m.calls.leadIdForLink === 0 && m.calls.record.length === 0);
}

console.log('3. Long link');
{
  const { calls, deps } = fakeDeps({ tokens: { 'TOKEN-SECRET': 'L1' }, linkFor: { L1: 'abcdefghijkm' } });
  const out = await redirect.resolveLegacyLink('TOKEN-SECRET', 'email', 'UA', deps);
  check('known token: to /book, recorded once with the channel', out.location === '/book' && out.recorded && calls.record.length === 1 && calls.record[0].channel === 'email');
  check('known token: cookie reference is the short id, never the token', out.attribution?.ref === 'abcdefghijkm' && !JSON.stringify(out.attribution).includes('TOKEN'));
  const n = fakeDeps({ tokens: { 'TOKEN-SECRET': 'L1' } });
  const issued = await redirect.resolveLegacyLink('TOKEN-SECRET', 'pdf', 'UA', n.deps);
  check('lead saved before short links: a short id is issued for the reference', n.calls.issueLink === 1 && issued.attribution?.ref && links.isBookingLinkId(issued.attribution.ref));
  const bad = fakeDeps({ tokens: { 'TOKEN-SECRET': 'L1' } });
  const none = await redirect.resolveLegacyLink('wrong-token', 'pdf', 'UA', bad.deps);
  check('unknown token: to /book, nothing recorded, no cookie', none.location === '/book' && !none.recorded && none.attribution === null && bad.calls.record.length === 0);
  const odd = fakeDeps({ tokens: { 'TOKEN-SECRET': 'L1' }, linkFor: { L1: 'abcdefghijkm' } });
  const oddOut = await redirect.resolveLegacyLink('TOKEN-SECRET', 'javascript:alert(1)', 'UA', odd.deps);
  check('unknown src falls back to results', oddOut.attribution?.content === 'results');
}

console.log('4. Redirect response');
{
  const { bookingRedirectResponse } = await jiti.import(path.join(root, 'src/lib/tools/bookingResponse.ts'));
  const a = links.attributionForLink('business-valuation', 'email', 'abcdefghijkm');
  const res = bookingRedirectResponse(new Request('https://www.pacemakersglobal.com/b/abcdefghijkme?x=1'), { location: '/book', attribution: a, recorded: true });
  const loc = res.headers.get('location');
  check('302 to /book with no query string, on the host the visitor used', res.status === 302 && loc === '/book', `${res.status} ${loc}`);
  const cookie = res.headers.get('set-cookie') ?? '';
  check('cookie set, first-party, Lax, Secure on https, 30 days', cookie.startsWith('pmbc_booking=') && /Path=\//.test(cookie) && /SameSite=Lax/.test(cookie) && /Secure/.test(cookie) && /Max-Age=2592000/.test(cookie), cookie);
  check('cookie holds no token, name or email', !/TOKEN|secret|%40|@/i.test(cookie), cookie);
  check('not cached, not indexed', res.headers.get('cache-control') === 'no-store' && res.headers.get('x-robots-tag') === 'noindex');
  const plain = bookingRedirectResponse(new Request('http://127.0.0.1:3107/b/zzz'), { location: '/book', attribution: null, recorded: false });
  check('no attribution: no cookie', !plain.headers.get('set-cookie') && plain.headers.get('location') === '/book');
}

console.log('5. Attribution reaches the booking calendar');
{
  const a = links.attributionForLink('business-valuation', 'pdf', 'abcdefghijkm');
  const decoded = links.decodeAttribution(encodeURIComponent(links.encodeAttribution(a)));
  check('cookie round trip', JSON.stringify(decoded) === JSON.stringify(a), JSON.stringify(decoded));
  check('junk cookie is ignored', links.decodeAttribution('%%%') === null && links.decodeAttribution('utm_source=<script>') === null);
  check('a malformed reference is dropped', links.attributionFromSearch({ ref: 'TOKEN-SECRET', utm_source: 'x' })?.ref === undefined);
  const params = links.calendarParams(a, { name: 'N', email: 'e@example.com' });
  const url = new URL(booking.withBookingPrefill('https://calendly.com/pacemakers/intro', params));
  check('calendar URL carries source, medium, campaign, channel and the lead reference', url.searchParams.get('utm_source') === 'pacemakersglobal' && url.searchParams.get('utm_medium') === 'free-tool' && url.searchParams.get('utm_campaign') === 'business-valuation' && url.searchParams.get('utm_content') === 'pdf' && url.searchParams.get('utm_term') === 'ref-abcdefghijkm', url.toString());
  check('calendar URL carries the prefill name and email', url.searchParams.get('name') === 'N' && url.searchParams.get('email') === 'e@example.com');
  const src = read('src/app/(public)/book/page.tsx');
  check('/book: query first, then the cookie, into the calendar', src.includes('attributionFromSearch(search) ?? decodeAttribution(cookieStore.get(ATTRIBUTION_COOKIE)?.value)') && src.includes('calendarParams(attribution, person)') && src.includes('<BookingUrlCleaner />'));
  check('tracking keys include utm tags and click ids, not preview', ['utm_source', 'utm_campaign', 'gclid', 'fbclid', 'ref'].every((k) => links.TRACKING_QUERY_KEYS.includes(k)) && !links.TRACKING_QUERY_KEYS.includes('preview'));
}

console.log('6. A short link opens the booking page only');
{
  const route = read('src/app/b/[slug]/route.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  check('the short link route only resolves and redirects', /resolveShortLink\(/.test(route) && /bookingRedirectResponse\(/.test(route) && !/getLead|renderValuationReport|results|inputs|access_token/.test(route));
  for (const p of ['src/app/api/tools/[slug]/pdf/route.ts', 'src/app/api/tools/[slug]/lead/version/route.ts']) {
    const s = read(p);
    check(`${p}: still requires the access token, never a short id`, s.includes('getLeadByToken(') && !/leadIdForLink|parseBookingLinkSlug|personForBookingRef/.test(s));
  }
  const store = read('src/lib/tools/leads/bookingLinkStore.ts');
  check('the /book prefill takes only name and email from the lead', /return lead \? \{ name: lead\.name, email: lead\.email \} : null;/.test(store));
  check('short ids are not derived from the access token', !/access_token/.test(read('src/lib/tools/bookingLinks.ts')) && /newBookingLinkId\(\(n\) => randomBytes\(n\)\)/.test(store));
}

console.log('7. The short link is what results, emails and PDFs carry');
{
  check('lead API issues the link once the lead is saved and returns it', /const booking = await issueBookingLink\(id\);/.test(read('src/app/api/tools/[slug]/lead/route.ts')));
  check('results page uses the short link', read('src/components/tools/valuation/ResultsDashboard.tsx').includes("bookingLinkPath(lead.booking, 'results')"));
  const deliver = read('src/lib/tools/leads/deliver.ts');
  check('email and attached PDF use the short link', deliver.includes("await bookingLinkFor(lead, 'email')") && deliver.includes("await bookingLinkFor(lead, 'pdf')") && !deliver.includes('/api/tools/book?t='));
  for (const p of ['src/app/api/tools/[slug]/pdf/route.ts', 'src/app/api/admin/tool-leads/[id]/pdf/route.ts']) check(`${p}: PDF and QR code use the short link`, read(p).includes("await bookingLinkFor(lead, 'pdf')"));
  check('robots keeps /b/ out of search', read('src/app/robots.ts').includes("'/b/'"));
}

const BASE = process.env.VERIFY_BASE;
if (BASE) {
  console.log(`8. Over HTTP, ${BASE} (GET only, unknown ids only)`);
  const get = (p) => fetch(new URL(p, BASE), { redirect: 'manual' });
  const bookUrl = new URL('/book', BASE).toString();
  const unknownId = links.newBookingLinkId((n) => randomBytes(n));
  for (const [label, p] of [['unknown short id', `/b/${unknownId}r`], ['malformed short id', '/b/nope'], ['unknown long link', '/api/tools/book?t=not-a-real-token&src=pdf']]) {
    const res = await get(p);
    const loc = res.headers.get('location') ?? '';
    check(`${label}: redirects to a clean /book`, (res.status === 302 || res.status === 307) && new URL(loc, BASE).toString() === bookUrl, `${res.status} ${loc}`);
    check(`${label}: no lead reference stored`, !/ref=/.test(decodeURIComponent(res.headers.get('set-cookie') ?? '')));
  }

  console.log('9. /book in a browser');
  const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((c) => fs.existsSync(c));
  const port = 9431;
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'bl-'))}`, 'about:blank'], { stdio: 'ignore' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    let tabs;
    for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (tabs.find((t) => t.type === 'page')) break; } catch {} await wait(250); }
    const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0; const pending = new Map(); const nonGet = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.startsWith(new URL(BASE).origin) && !['GET', 'HEAD'].includes(m.params.request.method)) nonGet.push(`${m.params.request.method} ${m.params.request.url}`);
    });
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
    await send('Network.enable'); await send('Page.enable');
    for (const [label, query, expect] of [
      ['UTM tags and click ids', '?utm_source=newsletter&utm_medium=email&utm_campaign=autumn&gclid=abc123', '/book'],
      ['a non-tracking parameter is kept', '?preview=1&utm_source=partner', '/book?preview=1'],
    ]) {
      await send('Network.clearBrowserCookies');
      await send('Page.navigate', { url: `${bookUrl}${query}` });
      let shown = '';
      for (let i = 0; i < 60; i++) { await wait(250); shown = (await evaluate('document.readyState === "complete" ? location.pathname + location.search : ""').catch(() => '')) ?? ''; if (shown === expect) break; }
      check(`${label}: address bar shows ${expect}`, shown === expect, shown);
      const navs = await evaluate('performance.getEntriesByType("navigation").length');
      check(`${label}: cleaned without a reload`, navs === 1 && (await evaluate('performance.getEntriesByType("navigation")[0].type')) === 'navigate');
      const cookie = decodeURIComponent((await evaluate('document.cookie')) ?? '');
      check(`${label}: cookie holds the tags`, cookie.includes('pmbc_booking=') && /utm_source=(newsletter|partner)/.test(cookie), cookie);
    }
    check('nothing but GET sent to the site', nonGet.length === 0, nonGet.join(', '));
    ws.close();
  } finally {
    proc.kill();
  }
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
