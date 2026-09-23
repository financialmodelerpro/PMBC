// scripts/verify-growth-booking.mjs
//
// Proves the one booking link rule (2026-09-23): the site's /book page is the
// permanent default, the direct Bookings link setting is empty by default and
// empty means /book, and a direct link overrides /book everywhere a booking is
// offered: the website chat, no-show rebooking emails, meeting recaps and
// outreach drafts (follow-ups).
//
//   1. Offline: the rule, the default, that no Growth file builds a booking
//      URL itself, and that every path goes through booking.ts.
//   2. Only with --write-test-rows: with the setting empty, the chat's booking
//      offer, a no-show draft, a recap draft and an outreach follow-up all use
//      /book; then, with a direct link set on the settings row for the length
//      of the check (logged as a test change, restored in a finally), all four
//      use the direct link. is_test rows only, removed afterwards.
//
//   npm run verify-growth-booking
//   npm run verify-growth-booking -- --write-test-rows

import { addTestKnowledge, sweep } from './lib/growthFixtures.mjs';
import { WRITE, check, finish, load, read, serviceClient, walk } from './lib/growthVerify.mjs';

const booking = await load('src/lib/growth/booking.ts');
const engm = await load('src/lib/growth/engineSettingsModel.ts');
const mock = await load('src/lib/growth/ai/mockSamples.ts');
const SITE_BOOK = 'https://www.pacemakersglobal.com/book';
const DIRECT = 'https://outlook.office365.com/book/ZZVerifyBooking@pacemakersglobal.com/';

console.log('1. The rule (offline)');
check('empty means the site /book page', booking.resolveBookingUrl('') === SITE_BOOK && booking.resolveBookingUrl('   ') === SITE_BOOK && booking.resolveBookingUrl(null) === SITE_BOOK);
check('a direct link overrides /book', booking.resolveBookingUrl(DIRECT) === DIRECT);
check('the setting is empty by default', engm.ENGINE_SETTING_COLUMNS.bookings_url.default === '');
check('the placeholder is filled with the link', booking.fillBookingLink('Book here: [Booking link].', DIRECT) === `Book here: ${DIRECT}.`);
{
  const files = [...walk('src/lib/growth'), ...walk('src/app/api/growth'), ...walk('src/components/growth'), ...walk('src/app/api/admin/growth')].filter((f) => f !== 'src/lib/growth/booking.ts');
  const builders = files.filter((f) => /\/book['`"]|\$\{SITE_HREF\}\/book|bookings_url\)?\s*\|\|/.test(read(f)));
  check('no Growth file builds a booking URL itself', builders.length === 0, builders.join(', '));
  check('the website chat uses the rule', read('src/lib/growth/chat.ts').includes('const bookingUrl = growthBookingUrl;'));
  check('meeting recaps and no-show emails use the rule', /const booking = await growthBookingUrl\(\);/.test(read('src/lib/growth/meetings.ts')) && read('src/lib/growth/meetings.ts').includes('bookingUrl: booking'));
  check('outreach drafts use the rule', read('src/lib/growth/outreach.ts').includes('bookingUrl: await growthBookingUrl()'));
  check('drafts are told to use the placeholder, never an address', read('src/lib/growth/outreach.ts').includes('never write a booking address yourself') && read('src/lib/growth/meetings.ts').includes('[Booking link]'));
  const samples = ['no_show', 'meeting_recap', 'outreach_follow_up'].map((k) => JSON.stringify(mock.JSON_SAMPLES[k]({ messages: [] })));
  check('the mock drafts that offer a call use the placeholder', samples.every((t) => t.includes('[Booking link]')));
  check('the Settings screen explains the default', read('src/components/admin/growth/settings/EngineForms.tsx').includes("unless a direct Bookings link is entered here"));
}

console.log('2. Live, test rows');
const svc = serviceClient();
if (!svc) console.log('  SKIP  no SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
else if (!WRITE) console.log('  Write phase skipped (pass --write-test-rows to run it).');
else await live(svc);

async function live(svc) {
  const pros = await load('src/lib/growth/prospects.ts');
  const sigs = await load('src/lib/growth/signals.ts');
  const out = await load('src/lib/growth/outreach.ts');
  const meet = await load('src/lib/growth/meetings.ts');
  const chat = await load('src/lib/growth/chat.ts');
  const eng = await load('src/lib/growth/engineSettings.ts');
  const ts = Date.now();
  const TAG = `ZZ-BOOK-${ts}`;
  const ETAG = `zz-book-${ts}`;
  const actor = { id: 'verify-growth-booking', name: 'Booking verifier' };
  const started = new Date(Date.now() - 1000).toISOString();
  const { data: before } = await svc.from('growth_settings').select('bookings_url').eq('id', 1).single();
  const kbIds = await addTestKnowledge(TAG);
  const convIds = [];
  const setLink = async (url) => {
    const r = await eng.updateEngineSettings({ bookings_url: url }, actor, { isTest: true });
    if (!r.ok) throw new Error(r.error);
  };
  let n = 0;
  async function everyPath(expected) {
    n++;
    const co = await pros.createCompany({ name: `${TAG} Co ${n}`, sector: 'Real estate', country: 'Saudi Arabia' }, actor, { isTest: true });
    const ct = await pros.createContact(co.value.id, { full_name: `Test Person ${n}`, email: `${ETAG}-${n}@example.invalid`, is_decision_maker: true }, actor, { isTest: true });
    await sigs.createSignal({ trigger_type: 'new_project', signal_date: '2026-09-20', summary: `${TAG} project ${n}`, evidence_url: `https://www.pacemakersglobal.com/?book-verify=${ts}-${n}`, company_id: co.value.id }, actor, { isTest: true });
    const lead = await pros.createLead(co.value.id, { title: `${TAG} lead ${n}`, contact_id: ct.value.id, recommended_service: 'refm' }, actor, { isTest: true });
    const results = {};
    // Website chat: a Hot visitor giving consent is offered the booking link.
    const ctx = { ipHash: null, userAgent: 'verify', trackToken: null, preview: true };
    const first = await chat.handleChat({ page: '/services/refm', message: 'We need a model for a SAR 300 million project.' }, ctx);
    const { data: conv } = await svc.from('growth_conversations').select('id').eq('access_token', first.value.token).single();
    convIds.push(conv.id);
    await svc.from('growth_conversations').update({ route: 'hot', temperature: 'hot' }).eq('id', conv.id).eq('is_test', true);
    const consent = await chat.handleChat({ token: first.value.token, page: '/services/refm', consent: { given: true, name: 'Visitor', email: `${ETAG}-v${n}@example.invalid`, company: `${TAG} Visitor Co ${n}` } }, ctx);
    results.chat = consent.ok && consent.value.bookingUrl === expected && consent.value.reply.includes(expected);
    // No-show rebooking.
    const m1 = await meet.createManualMeeting({ lead_id: lead.value.id, starts_at: new Date(Date.now() - 3_600_000).toISOString() }, actor, { isTest: true });
    await meet.recordOutcome(m1.value.id, { status: 'no_show' }, actor);
    const ns = await meet.draftMeetingEmail(m1.value.id, 'no_show', actor);
    results.noShow = ns.ok && ns.value.body.includes(expected) && !ns.value.body.includes('[Booking link]');
    // Meeting recap.
    const m2 = await meet.createManualMeeting({ lead_id: lead.value.id, starts_at: new Date(Date.now() - 7_200_000).toISOString() }, actor, { isTest: true });
    await meet.recordOutcome(m2.value.id, { status: 'completed', outcome: 'needs_follow_up', notes: 'Follow up next week' }, actor);
    const rc = await meet.draftMeetingEmail(m2.value.id, 'recap', actor);
    results.recap = rc.ok && rc.value.body.includes(expected) && !rc.value.body.includes('[Booking link]');
    // Outreach follow-up: an initial email sent (mock), then the due follow-up drafted.
    await svc.from('growth_messages').insert({ is_test: true, lead_id: lead.value.id, company_id: co.value.id, contact_id: ct.value.id, channel: 'email', kind: 'initial', subject: 'Hello', body: 'Hello [Link]', status: 'sent', approved_at: new Date().toISOString(), sent_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), send_mode: 'mock' });
    await svc.from('growth_leads').update({ stage: 'contacted', sequence_status: 'active', sequence_started_at: new Date(Date.now() - 6 * 86_400_000).toISOString(), next_follow_up_at: new Date(Date.now() - 86_400_000).toISOString() }).eq('id', lead.value.id).eq('is_test', true);
    await out.draftDueFollowUps(new Date());
    const { data: fu } = await svc.from('growth_messages').select('body').eq('lead_id', lead.value.id).eq('kind', 'follow_up').maybeSingle();
    results.outreach = Boolean(fu?.body?.includes(expected)) && !fu.body.includes('[Booking link]');
    return results;
  }
  try {
    check('the real setting starts empty', (before?.bookings_url ?? '') === '', before?.bookings_url);
    await setLink('');
    const empty = await everyPath(SITE_BOOK);
    check('empty: the website chat offers /book', empty.chat);
    check('empty: the no-show email offers /book', empty.noShow);
    check('empty: the meeting recap offers /book', empty.recap);
    check('empty: the outreach follow-up offers /book', empty.outreach);
    await setLink(DIRECT);
    const direct = await everyPath(DIRECT);
    check('direct link: the website chat uses it', direct.chat);
    check('direct link: the no-show email uses it', direct.noShow);
    check('direct link: the meeting recap uses it', direct.recap);
    check('direct link: the outreach follow-up uses it', direct.outreach);
  } finally {
    await setLink(before?.bookings_url ?? '');
    const { data: after } = await svc.from('growth_settings').select('bookings_url').eq('id', 1).single();
    check('the setting is restored', after.bookings_url === (before?.bookings_url ?? ''));
    await sweep({ namePrefix: TAG, emailPrefix: ETAG, kbIds, conversationIds: convIds });
    await svc.from('growth_activity').delete().eq('is_test', true).gte('created_at', started).is('company_id', null).is('lead_id', null).is('contact_id', null).is('signal_id', null);
    await svc.from('growth_ai_usage').delete().eq('is_test', true).gte('created_at', started).is('company_id', null).is('lead_id', null);
    const { count } = await svc.from('growth_companies').select('id', { count: 'exact', head: true }).like('name', `${TAG}%`);
    check('every test row removed', count === 0);
  }
}

finish('verify-growth-booking');
