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
//   5. Concurrency: status writes are conditional on the stored status being
//      weaker, so events applied in any order, interleaved with the send
//      recording `sent`, settle on the strongest status. The mock applies the
//      condition exactly as the conditional UPDATE in setEmailStatusIf does.
//   6. Detail: Brevo's reason is kept only on events it explains.
//   8. Engagement (src/lib/tools/engagement.ts): alert emails are resolved
//      from the header, their own tag, message ids and recipient, and never
//      move the status; a results click within 60 seconds of delivery (or of
//      the send, before a delivered event) or on a bounced or blocked email is
//      kept, flagged and not counted; booking clicks follow the same rule for
//      the email link only; the lead detail shows the flag.
//   7. Payloads: single objects and arrays, Brevo's event names, event time
//      from ts_event, and a malformed body refused with 400.
//
//   npm run verify-brevo-webhook
//
// Refuses to run at all when VERIFY_BASE is production (its HTTP checks POST).
// With VERIFY_BASE set to a local build, also checks over HTTP that the endpoint refuses a
// request with no token and one with a wrong token (nothing is written).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Never against production: see scripts/lib/productionGuard.mjs.
const { refuseWritesAgainstProduction } = await import('./lib/productionGuard.mjs');
refuseWritesAgainstProduction(process.env.VERIFY_BASE, 'verify-brevo-webhook');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const wh = await jiti.import(path.join(root, 'src/lib/tools/webhook.ts'));
const eng = await jiti.import(path.join(root, 'src/lib/tools/engagement.ts'));
const fs = await import('node:fs');

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
  const lead = { id: LEAD, email: 'test@example.com', email_status: 'sent', email_message_id: RESULTS_MSG, email_sent_at: null, alert_message_id: ALERT_MSG };
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
    // Mirrors resultsMessageTimeline: results events for that message only.
    async resultsMessageTimeline(leadId, messageId) {
      const rows = events
        .filter((e) => e.lead_id === leadId && e.email_kind === 'results' && (!messageId || e.message_id === messageId))
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      return {
        deliveredAt: rows.find((e) => e.event_type === 'delivered')?.occurred_at ?? null,
        bounced: rows.some((e) => e.event_type === 'bounced' || e.event_type === 'blocked'),
      };
    },
    // Mirrors setEmailStatusIf: one conditional UPDATE, never a read-then-write.
    async advanceLeadStatus(id, { to, onlyFrom, at }) {
      if (id !== lead.id) return;
      if (onlyFrom.includes(lead.email_status)) lead.email_status = to;
      if (at && (!lead.email_last_event_at || lead.email_last_event_at < at)) lead.email_last_event_at = at;
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
  const d = await run(s, ev('delivered', { ts_event: 1789560000 }));
  check('delivered: 200, recorded', d.status === 200 && d.recorded === 1);
  check('delivered: status delivered', s.lead.email_status === 'delivered');
  await run(s, ev('unique_opened', { ts_event: 1789560100 }));
  check('unique_opened maps to opened', s.lead.email_status === 'opened' && s.events.at(-1).event_type === 'opened');
  await run(s, ev('click', { link: 'https://www.pacemakersglobal.com/api/tools/book?t=abc&src=email', ts_event: 1789560200 }));
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

console.log('Concurrency');
{
  // The bug seen on the first real lead: a bounce and a stale 'sent' racing.
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
  const names = ['request', 'delivered', 'hard_bounce', 'opened'];
  for (const order of perms(names)) {
    const s = store();
    s.lead.email_status = 'pending';
    // All four in flight at once, as separate requests.
    await Promise.all(order.map((n, i) => run(s, ev(n, { ts_event: 1789560000 + i }))));
    check(`${order.join(', ')} settles on bounced`, s.lead.email_status === 'bounced', s.lead.email_status);
  }
  {
    // The send records 'sent' only from pending, after Brevo already bounced it.
    const s = store();
    s.lead.email_status = 'pending';
    await run(s, ev('hard_bounce', { reason: 'no such user' }));
    await s.advanceLeadStatus(LEAD, { to: 'sent', onlyFrom: ['pending'] });
    check('send recording sent after a bounce leaves bounced', s.lead.email_status === 'bounced', s.lead.email_status);
  }
  {
    const s = store();
    s.lead.email_status = 'pending';
    await s.advanceLeadStatus(LEAD, { to: 'sent', onlyFrom: ['pending'] });
    await run(s, ev('delivered'));
    check('send first, then delivered: delivered', s.lead.email_status === 'delivered');
  }
  {
    const s = store();
    await run(s, ev('delivered', { ts_event: 1789560500 }));
    const later = s.lead.email_last_event_at;
    await run(s, ev('opened', { ts_event: 1789560100 }));
    check('event time never moves backward', s.lead.email_last_event_at === later);
  }
  check('weakerStatuses(bounced) excludes complaint and bounced', !wh.weakerStatuses('bounced').includes('complaint') && !wh.weakerStatuses('bounced').includes('bounced') && wh.weakerStatuses('bounced').includes('clicked'));
  check('weakerStatuses(sent) is the unsent states', ['pending', 'failed', 'not_configured'].every((x) => wh.weakerStatuses('sent').includes(x)) && wh.weakerStatuses('sent').length === 3);
  check('an error event never overwrites a status', wh.weakerStatuses(wh.statusForEvent('error')).length === 0);
}

console.log('Event detail');
{
  const s = store();
  await run(s, ev('delivered', { reason: 'sent' }));
  check('delivered with reason "sent": no detail', s.events.at(-1).detail === null, String(s.events.at(-1).detail));
  await run(s, ev('unique_opened', { reason: 'sent' }));
  check('unique_opened: detail is the Brevo event name', s.events.at(-1).detail === 'unique_opened');
  await run(s, ev('soft_bounce', { reason: 'mailbox full' }));
  check('soft bounce keeps its reason', s.events.at(-1).detail === 'mailbox full');
  await run(s, ev('blocked', { reason: 'blocklisted' }));
  check('blocked keeps its reason', s.events.at(-1).detail === 'blocklisted');
}

console.log('Engagement');
{
  const T0 = 1789570000;
  const at = (sec) => new Date((T0 + sec) * 1000).toISOString();

  // Results clicks around delivery.
  {
    const s = store();
    s.lead.email_status = 'sent';
    await run(s, ev('delivered', { ts_event: T0 }));
    const soon = await run(s, ev('click', { ts_event: T0 + 30, link: 'https://www.pacemakersglobal.com/api/tools/book?t=x&src=email' }));
    const flagged = s.events.at(-1);
    check('click 30s after delivery: recorded in history', soon.recorded === 1 && flagged.event_type === 'clicked');
    check('click 30s after delivery: flagged likely automated with the reason', eng.automatedReasonOf(flagged.payload) === 'within_60s_of_delivery' && flagged.detail === eng.AUTOMATED_REASON_TEXT.within_60s_of_delivery);
    check('click 30s after delivery: raw Brevo payload kept', flagged.payload.event === 'click' && flagged.payload['message-id'] === RESULTS_MSG);
    check('click 30s after delivery: status stays delivered', s.lead.email_status === 'delivered', s.lead.email_status);
    await run(s, ev('click', { ts_event: T0 + 59 }));
    check('click 59s after delivery: still flagged, status unchanged', eng.automatedReasonOf(s.events.at(-1).payload) === 'within_60s_of_delivery' && s.lead.email_status === 'delivered');
    await run(s, ev('click', { ts_event: T0 + 60 }));
    check('click 60s after delivery: counts, status clicked', eng.automatedReasonOf(s.events.at(-1).payload) === null && s.lead.email_status === 'clicked', s.lead.email_status);
  }
  {
    const s = store();
    s.lead.email_status = 'sent';
    s.lead.email_sent_at = at(-20);
    await run(s, ev('click', { ts_event: T0 }));
    check('no delivered event yet: 20s after the send is flagged', eng.automatedReasonOf(s.events.at(-1).payload) === 'within_60s_of_delivery' && s.lead.email_status === 'sent');
    const s2 = store();
    s2.lead.email_status = 'sent';
    s2.lead.email_sent_at = at(-300);
    await run(s2, ev('click', { ts_event: T0 }));
    check('no delivered event yet: 5 minutes after the send counts', eng.automatedReasonOf(s2.events.at(-1).payload) === null && s2.lead.email_status === 'clicked');
  }
  {
    const s = store();
    s.lead.email_status = 'sent';
    await run(s, ev('hard_bounce', { ts_event: T0, reason: 'no such user' }));
    await run(s, ev('click', { ts_event: T0 + 600 }));
    check('click on a bounced email, 10 minutes later: flagged', eng.automatedReasonOf(s.events.at(-1).payload) === 'email_bounced');
    check('click on a bounced email: status stays bounced', s.lead.email_status === 'bounced');
    // The bounce is in the history but the lead's status never caught up.
    const s3 = store();
    s3.lead.email_status = 'delivered';
    s3.events.push({ lead_id: LEAD, event_type: 'bounced', email_kind: 'results', message_id: RESULTS_MSG, occurred_at: at(0), payload: {}, dedupe_key: 'manual-bounce' });
    await run(s3, ev('click', { ts_event: T0 + 600 }));
    check('click on a message with a recorded bounce, status not yet bounced: flagged', eng.automatedReasonOf(s3.events.at(-1).payload) === 'email_bounced' && s3.lead.email_status === 'delivered', s3.lead.email_status);
    const s2 = store();
    s2.lead.email_status = 'blocked';
    await run(s2, ev('click', { ts_event: T0 + 600 }));
    check('click on a blocked email: flagged', eng.automatedReasonOf(s2.events.at(-1).payload) === 'email_bounced' && s2.lead.email_status === 'blocked');
  }
  {
    // Opens and deliveries are not judged by the click rule.
    const s = store();
    s.lead.email_status = 'sent';
    await run(s, ev('delivered', { ts_event: T0 }));
    await run(s, ev('opened', { ts_event: T0 + 5 }));
    check('an open inside the window is not flagged (weak signal, unchanged rule)', eng.automatedReasonOf(s.events.at(-1).payload) === null && s.lead.email_status === 'opened');
  }

  // Alert emails, however the event arrives.
  const alertCases = [
    ['header says alert', { 'X-Mailin-custom': `lead:${LEAD}|kind:alert`, email: 'advisory@pacemakersglobal.com' }],
    ['no kind in header, new alert tag', { 'X-Mailin-custom': `lead:${LEAD}`, tags: ['tool-lead-alert', 'business-valuation', 'alert'], 'message-id': '<new@x>', email: 'advisory@pacemakersglobal.com' }],
    ['no kind in header, old alert tags', { 'X-Mailin-custom': `lead:${LEAD}`, tags: ['tool-lead', 'business-valuation', 'alert'], 'message-id': '<new@x>', email: 'advisory@pacemakersglobal.com' }],
    ['no kind, no tags, alert message id', { 'X-Mailin-custom': `lead:${LEAD}`, 'message-id': ALERT_MSG, email: 'advisory@pacemakersglobal.com' }],
    ['no kind, no tags, unknown message, another recipient', { 'X-Mailin-custom': `lead:${LEAD}`, 'message-id': '<unknown@x>', email: 'someone@firm.test' }],
  ];
  for (const [label, extra] of alertCases) {
    const s = store();
    s.lead.email_status = 'delivered';
    await run(s, [ev('delivered', { ts_event: T0, ...extra }), ev('click', { ts_event: T0 + 900, ...extra })]);
    check(`alert (${label}): recorded as alert`, s.events.length === 2 && s.events.every((e) => e.email_kind === 'alert'), JSON.stringify(s.events.map((e) => e.email_kind)));
    check(`alert (${label}): status never moves`, s.lead.email_status === 'delivered', s.lead.email_status);
  }
  {
    const s = store();
    s.lead.email_status = 'sent';
    await run(s, ev('click', { ts_event: T0 + 900, 'X-Mailin-custom': `lead:${LEAD}`, 'message-id': '<unknown@x>', email: 'TEST@example.com' }));
    check('no kind, no tags, unknown message, recipient is the visitor: results', s.events.at(-1).email_kind === 'results' && s.lead.email_status === 'clicked');
  }

  // The pure rules.
  check('resolveEmailKind: new results tags are results', eng.resolveEmailKind({ headerKind: null, tags: ['tool-lead', 'x', 'results'], messageId: null, resultsMessageId: null, alertMessageId: null, recipient: null, leadEmail: null }) === 'results');
  check('resolveEmailKind: nothing known is alert', eng.resolveEmailKind({ headerKind: null, tags: [], messageId: null, resultsMessageId: null, alertMessageId: null, recipient: null, leadEmail: null }) === 'alert');
  const book = (src, clickSec, status = 'delivered', deliveredSec = 0) =>
    eng.classifyBookingClick({ src, clickedAt: at(clickSec), deliveredAt: deliveredSec === null ? null : at(deliveredSec), sentAt: null, emailStatus: status });
  check('booking click from the email 10s after delivery: not counted', book('email', 10) === 'within_60s_of_delivery');
  check('booking click from the email 2 minutes after delivery: counted', book('email', 120) === null);
  check('booking click from a bounced email: not counted', book('email', 3600, 'bounced') === 'email_bounced');
  check('booking click from the results page is never judged', book('results', 1) === null && book('results', 1, 'bounced') === null);
  check('booking click from the PDF is never judged', book('pdf', 1) === null);
  check('marker round trip', eng.automatedReasonOf({ pmbc_engagement: eng.automatedMarker('email_bounced', null) }) === 'email_bounced' && eng.automatedReasonOf({ pmbc_engagement: { likely_automated: 'yes' } }) === null && eng.automatedReasonOf(null) === null);

  // Wiring, read from source.
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  check('alert emails carry their own tag', read('src/lib/tools/leads/deliver.ts').includes("tags: [ALERT_TAG, lead.tool_slug, 'alert'") && eng.ALERT_TAG !== eng.RESULTS_TAG);
  check('booking redirect does not count a likely automated click', read('src/app/api/tools/book/route.ts').includes('automated ? Promise.resolve(true) : updateLead(lead.id, { booking_clicks'));
  check('webhook status write skipped for a flagged click', read('src/lib/tools/webhook.ts').includes("if (kind === 'results' && to && !automated)"));
  const detail = read('src/app/admin/tool-leads/[id]/page.tsx');
  check('lead detail shows the flag, labels alerts, and says clicks were not counted', detail.includes('AUTOMATED_REASON_TEXT[automatedReasonOf(e.payload)!]') && detail.includes('Internal alert, not visitor engagement') && detail.includes('likely automated'));
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
