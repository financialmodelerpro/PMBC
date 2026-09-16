// scripts/verify-brevo-webhook.mjs
//
// Proves the Brevo webhook rules in src/lib/tools/webhook.ts against an
// in-memory store:
//
//   1. Authentication: unset secret refuses everything (503), a wrong or
//      missing token is 401, the token is accepted from ?token= or a Bearer
//      header, and comparison does not short-circuit on length.
//   2. Matching: by the X-Mailin-custom header first, by message-id second;
//      an event for no known lead is acknowledged and ignored.
//   3. Status: moves only forward in strength of evidence, so a late
//      `delivered` never overwrites `clicked`, and a bounce or complaint wins.
//      Alert-email events are recorded but never touch the lead's email status.
//   4. Duplicates: a retried event is recorded once.
//   5. Payloads: single objects and arrays, Brevo's event names, event time
//      from ts_event, and a malformed body refused with 400.
//
//   npm run verify-brevo-webhook
//
// With VERIFY_BASE set, also checks over HTTP that the endpoint refuses a
// request with no token and one with a wrong token (nothing is written).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const wh = await jiti.import(path.join(root, 'src/lib/tools/webhook.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

const SECRET = 'verify-secret-token-0123456789abcdef';
const LEAD = '11111111-2222-4333-8444-555555555555';
const RESULTS_MSG = '<202609161200.results@smtp-relay.mailin.fr>';
const ALERT_MSG = '<202609161200.alert@smtp-relay.mailin.fr>';

function store() {
  const lead = { id: LEAD, email_status: 'sent', email_message_id: RESULTS_MSG, alert_message_id: ALERT_MSG };
  const events = [];
  const keys = new Set();
  return {
    lead,
    events,
    async findLeadById(id) {
      return id === LEAD ? lead : null;
    },
    async findLeadByMessageId(id) {
      if (id === RESULTS_MSG) return { lead, kind: 'results' };
      if (id === ALERT_MSG) return { lead, kind: 'alert' };
      return null;
    },
    async insertEvent(e) {
      if (keys.has(e.dedupe_key)) return 'duplicate';
      keys.add(e.dedupe_key);
      events.push(e);
      return 'inserted';
    },
    async updateLeadStatus(id, patch) {
      Object.assign(lead, patch);
    },
  };
}

const ev = (event, extra = {}) => ({
  event,
  email: 'test@example.com',
  'message-id': RESULTS_MSG,
  'X-Mailin-custom': `lead:${LEAD}|kind:results`,
  ts_event: 1789560000 + Math.floor(Math.random() * 1000),
  date: '2026-09-16 12:00:00',
  ...extra,
});
const run = (s, body, token = SECRET, expected = SECRET) => wh.handleBrevoWebhook({ token, expectedToken: expected, body }, s);

console.log('Authentication');
{
  const s = store();
  // Called directly: passing undefined through run() would pick up its default.
  check('secret unset: 503', (await wh.handleBrevoWebhook({ token: SECRET, expectedToken: undefined, body: ev('delivered') }, s)).status === 503);
  check('no token: 401', (await run(s, ev('delivered'), null)).status === 401);
  check('wrong token, same length: 401', (await run(s, ev('delivered'), SECRET.replace(/.$/, 'X'))).status === 401);
  check('wrong token, different length: 401', (await run(s, ev('delivered'), 'short')).status === 401);
  check('nothing recorded by refused requests', s.events.length === 0 && s.lead.email_status === 'sent');
  check('token read from ?token=', wh.extractToken(new URL(`https://x.test/api/webhooks/brevo?token=${SECRET}`), null) === SECRET);
  check('token read from Bearer header', wh.extractToken(new URL('https://x.test/api/webhooks/brevo'), `Bearer ${SECRET}`) === SECRET);
  check('no token anywhere is null', wh.extractToken(new URL('https://x.test/api/webhooks/brevo'), 'Basic abc') === null);
  check('tokenMatches exact only', wh.tokenMatches(SECRET, SECRET) && !wh.tokenMatches('', SECRET) && !wh.tokenMatches(SECRET, ''));
}

console.log('Status and matching');
{
  const s = store();
  const d = await run(s, ev('delivered'));
  check('delivered: 200, recorded', d.status === 200 && d.recorded === 1);
  check('delivered: status delivered', s.lead.email_status === 'delivered');
  await run(s, ev('unique_opened'));
  check('unique_opened maps to opened', s.lead.email_status === 'opened' && s.events.at(-1).event_type === 'opened');
  await run(s, ev('click', { link: 'https://www.pacemakersglobal.com/api/tools/book?t=abc&src=email' }));
  check('click: status clicked, link kept', s.lead.email_status === 'clicked' && s.events.at(-1).link?.includes('/api/tools/book'));
  await run(s, ev('delivered'));
  check('late delivered does not downgrade clicked', s.lead.email_status === 'clicked');
  await run(s, ev('opened'));
  check('later open does not downgrade clicked', s.lead.email_status === 'clicked');
  await run(s, ev('hard_bounce', { reason: 'mailbox does not exist' }));
  check('hard bounce outranks clicked', s.lead.email_status === 'bounced' && s.events.at(-1).detail === 'mailbox does not exist');
  await run(s, ev('spam'));
  check('spam complaint outranks bounce', s.lead.email_status === 'complaint');
  check('last event time recorded', typeof s.lead.email_last_event_at === 'string');

  const s2 = store();
  const byId = await run(s2, ev('delivered', { 'X-Mailin-custom': undefined }));
  check('matched by message-id when the header is absent', byId.recorded === 1 && s2.lead.email_status === 'delivered');

  const s3 = store();
  await run(s3, ev('delivered', { 'message-id': ALERT_MSG, 'X-Mailin-custom': `lead:${LEAD}|kind:alert` }));
  await run(s3, ev('click', { 'message-id': ALERT_MSG, 'X-Mailin-custom': undefined }));
  check('alert events recorded as alert', s3.events.length === 2 && s3.events.every((e) => e.email_kind === 'alert'));
  check('alert events never touch email_status', s3.lead.email_status === 'sent');

  const s4 = store();
  const unknown = await run(s4, ev('delivered', { 'message-id': '<nobody@x>', 'X-Mailin-custom': 'lead:99999999-2222-4333-8444-555555555555|kind:results' }));
  check('unknown lead: 200, ignored', unknown.status === 200 && unknown.ignored === 1 && s4.events.length === 0);
  const untracked = await run(s4, ev('list_addition'));
  check('untracked event name: ignored', untracked.ignored === 1 && s4.events.length === 0);
  const junkHeader = await run(store(), ev('delivered', { 'X-Mailin-custom': 'lead:not-a-uuid|kind:results', 'message-id': '<nobody@x>' }));
  check('malformed custom header does not match a lead', junkHeader.ignored === 1);
}

console.log('Duplicates and payloads');
{
  const s = store();
  const once = ev('delivered', { ts_event: 1789560123 });
  await run(s, once);
  const again = await run(s, once);
  check('retried event recorded once', again.duplicates === 1 && s.events.length === 1);

  const batch = await run(store(), [ev('delivered'), ev('opened'), ev('click', { link: 'https://a.test' })]);
  check('array payload: all three recorded', batch.status === 200 && batch.recorded === 3);

  check('string body: 400', (await run(store(), 'nope')).status === 400);
  check('empty array: 400', (await run(store(), [])).status === 400);
  check('array with a non-object: 400', (await run(store(), [ev('delivered'), 5])).status === 400);

  const n = wh.normaliseEvent(ev('delivered', { ts_event: 1789560000 }));
  check('event time from ts_event', n.occurredAt === new Date(1789560000 * 1000).toISOString(), n.occurredAt);
  check('custom header parsed', n.leadId === LEAD && n.kind === 'results');
  check('dedupe key includes message, event and time', n.dedupeKey.includes(RESULTS_MSG) && n.dedupeKey.includes('delivered') && n.dedupeKey.includes('1789560000'));
}

console.log('Status ordering');
{
  const order = ['sent', 'deferred', 'delivered', 'opened', 'clicked', 'blocked', 'bounced', 'complaint'];
  const types = { sent: 'sent', deferred: 'deferred', delivered: 'delivered', opened: 'opened', clicked: 'clicked', blocked: 'blocked', bounced: 'bounced', complaint: 'complaint' };
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) {
      const next = wh.nextEmailStatus(order[i], types[order[j]]);
      const want = j > i ? order[j] : order[i];
      check(`${order[i]} then ${order[j]} is ${want}`, next === want, next);
    }
  }
  check('pending then sent is sent', wh.nextEmailStatus('pending', 'sent') === 'sent');
  check('failed then delivered is delivered', wh.nextEmailStatus('failed', 'delivered') === 'delivered');
}

const BASE = process.env.VERIFY_BASE?.replace(/\/+$/, '');
if (BASE) {
  console.log(`HTTP against ${BASE}`);
  const post = (q) => fetch(`${BASE}/api/webhooks/brevo${q}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev('delivered')) });
  const none = await post('');
  check('no token: refused (401, or 503 if unconfigured)', none.status === 401 || none.status === 503, String(none.status));
  const wrong = await post('?token=wrong-token');
  check('wrong token: refused', wrong.status === 401 || wrong.status === 503, String(wrong.status));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
