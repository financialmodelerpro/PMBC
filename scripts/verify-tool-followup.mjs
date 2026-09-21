// scripts/verify-tool-followup.mjs
//
// Proves the lead features added on 2026-09-21, without a database and without sending anything:
//
//   1. One lead per email: `groupLeadsByEmail` groups projects by email (case-insensitive), names
//      each by its company or "Your business", and `countPeople` counts each email once.
//   2. Phone and country on the name and email step: the schema accepts a clean number with its code
//      and a listed country, refuses anything else, and stores both on the lead row.
//   3. Reminders: `dueReminder` sends day 7 then day 14, each only inside its week, only with the
//      follow-up box ticked, and never after an unsubscribe or a booking; at most two per email.
//      The unsubscribe signature cannot be forged. The reminder email carries the booking button,
//      the edit link and the unsubscribe line.
//   4. Save and return: resume ids are 16 characters from the booking alphabet and validated; the
//      results email carries the edit link.
//
// With VERIFY_BASE (a local build or production: every request is a GET that writes nothing), also
// checks that the reminder job refuses a caller without the cron secret, an unsigned unsubscribe link
// is refused, and an unknown resume link is a 404.
//
//   npm run verify-tool-followup

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { VALUATION_DATE, minimalCase } from './lib/valuationCases.mjs';

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];
process.env.TOOL_LEAD_IP_SALT = 'verifier-secret';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const admin = await jiti.import(path.join(root, 'src/lib/tools/admin.ts'));
const reminders = await jiti.import(path.join(root, 'src/lib/tools/leads/reminders.ts'));
const resume = await jiti.import(path.join(root, 'src/lib/tools/leads/resumeLinks.ts'));
const templates = await jiti.import(path.join(root, 'src/lib/tools/email/templates.ts'));
const leads = await jiti.import(path.join(root, 'src/lib/tools/leads/valuation.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const contact = await jiti.import(path.join(root, 'src/lib/tools/contactCountries.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('1. One lead per email');
{
  const row = (id, email, company, at, extra = {}) => ({ id, email, company, created_at: at, name: `Name ${id}`, tool_slug: 'business-valuation', is_test: false, deal_size_band: '50-200', below_minimum: false, country: 'Saudi Arabia', currency: 'SAR', equity_mid: 100, status: 'new', email_status: 'sent', booking_clicks: 0, ...extra });
  const rows = [
    row('a1', 'jane@acme.com', 'Acme Clinics', '2026-09-20T10:00:00Z', { phone: '+966 50 123 4567', contact_country: 'Saudi Arabia', booking_clicks: 1 }),
    row('a2', 'Jane@Acme.com', null, '2026-09-21T10:00:00Z'),
    row('a3', 'jane@acme.com', 'Second Co', '2026-09-19T10:00:00Z', { below_minimum: true }),
    row('b1', 'omar@gulf.com', 'Gulf Trading', '2026-09-18T10:00:00Z', { booking_clicks: 2 }),
  ];
  const people = admin.groupLeadsByEmail(rows);
  check('two people from four valuations, matched case-insensitively', people.length === 2 && people[0].projects.length === 3 && people[1].projects.length === 1);
  check('people ordered by their latest valuation', people[0].email === 'jane@acme.com' && people[0].latestAt === '2026-09-21T10:00:00Z');
  check('projects named by company, "Your business" when blank, newest first', people[0].projects.map((p) => p.projectName).join('|') === 'Your business|Acme Clinics|Second Co');
  check('phone and country from whichever project has them', people[0].phone === '+966 50 123 4567' && people[0].contactCountry === 'Saudi Arabia');
  check('booking clicks and below minimum roll up to the person', people[0].bookingClicks === 1 && people[0].belowMinimum && people[1].bookingClicks === 2);
  check('lead count counts each email once', admin.countPeople(rows) === 2);
  check('project name helper', admin.projectName('  ') === 'Your business' && admin.projectName('Acme') === 'Acme' && admin.UNNAMED_PROJECT === 'Your business');
}

console.log('2. Phone and country');
{
  const body = (gate) => ({
    inputs: state.toInputs(state.onEnterWacc(state.onLeaveCompany(state.exampleState())), VALUATION_DATE),
    gate: { name: 'Test Person', email: 't@example.com', company: '', purpose: 'sale', dealSize: '50-200', consent: true, followUp: true, ...gate },
    website: '',
    elapsedMs: 180000,
  });
  const ok = leads.submissionSchema.safeParse(body({ phone: '+966 50 123 4567', contactCountry: 'Saudi Arabia' }));
  check('a clean phone with its code and a listed country are accepted', ok.success, JSON.stringify(ok.error?.issues ?? '').slice(0, 200));
  check('phone and country are optional', leads.submissionSchema.safeParse(body({})).success);
  check('a country not on the list is refused', !leads.submissionSchema.safeParse(body({ contactCountry: 'Atlantis' })).success);
  check('a phone with letters is refused', !leads.submissionSchema.safeParse(body({ phone: '+966 call me' })).success);
  check('a phone with too few digits is refused', !leads.submissionSchema.safeParse(body({ phone: '+1 23' })).success);
  check('the phone code follows the country', contact.dialCodeFor('Saudi Arabia') === '+966' && contact.dialCodeFor('Pakistan') === '+92' && contact.dialCodeFor('Other') === '');
  check('cleanPhone keeps the code and digits, drops the rest', contact.cleanPhone('966', '(050) 123-4567') === '+966 050 123 4567' && contact.cleanPhone('+92', '') === null);
  const store = { inserted: [], async countSince() { return 0; }, async insert(row) { this.inserted.push(row); return { ok: true, id: '00000000-0000-4000-8000-000000000001' }; } };
  await leads.processValuationSubmission(body({ phone: '+92 300 1234567', contactCountry: 'Pakistan' }), { now: new Date('2026-09-16T12:00:00Z'), toolSlug: 'business-valuation', toolLive: true, isStaff: false, ipHash: 'a'.repeat(64), userAgent: 'x', newToken: () => 't'.repeat(48) }, store);
  check('the lead row carries the phone and country', store.inserted[0]?.phone === '+92 300 1234567' && store.inserted[0]?.contact_country === 'Pakistan');
}

console.log('3. Reminders');
{
  const now = new Date('2026-10-01T06:00:00Z');
  const person = (daysAgo, over = {}) => ({ email: 'jane@acme.com', name: 'Jane Smith', latestLeadId: 'a1', latestAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), latestCompany: 'Acme', toolSlug: 'business-valuation', followUp: true, unsubscribed: false, booked: false, sent: [], ...over });
  check('reminders are on day 7 and day 14', reminders.REMINDER_DAYS[0] === 7 && reminders.REMINDER_DAYS[1] === 14);
  check('day 6: nothing', reminders.dueReminder(person(6.9), now) === null);
  check('day 7: the first reminder', reminders.dueReminder(person(7), now) === 1);
  check('day 13 without the first: still the first', reminders.dueReminder(person(13.5), now) === 1);
  check('day 14 without the first: none, its week has passed', reminders.dueReminder(person(14.2), now) === null);
  check('day 14 after the first: the second', reminders.dueReminder(person(14, { sent: [1] }), now) === 2);
  check('day 20 after the first: the second', reminders.dueReminder(person(20.5, { sent: [1] }), now) === 2);
  check('day 21: none, the second week has passed', reminders.dueReminder(person(21, { sent: [1] }), now) === null);
  check('both sent: never a third', reminders.dueReminder(person(14, { sent: [1, 2] }), now) === null);
  check('no follow-up tick: none', reminders.dueReminder(person(7, { followUp: false }), now) === null);
  check('unsubscribed: none', reminders.dueReminder(person(7, { unsubscribed: true }), now) === null && reminders.dueReminder(person(14, { sent: [1], unsubscribed: true }), now) === null);
  check('booked a call: none', reminders.dueReminder(person(14, { sent: [1], booked: true }), now) === null);
  check('the claim key is per email and reminder, case-insensitive', reminders.reminderDedupeKey('Jane@Acme.com', 1) === 'reminder_sent:jane@acme.com:1');
  const sig = reminders.unsubscribeSignature('jane@acme.com');
  check('unsubscribe signature verifies for its email only', reminders.verifyUnsubscribe('jane@acme.com', sig) && !reminders.verifyUnsubscribe('omar@gulf.com', sig) && !reminders.verifyUnsubscribe('jane@acme.com', sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')));
  check('no signature without a secret', !reminders.verifyUnsubscribe('jane@acme.com', sig, ''));
  const href = reminders.unsubscribeHref('Jane@Acme.com');
  const u = new URL(href);
  check('unsubscribe link: https, the email encoded, the signature', href.startsWith('https://www.pacemakersglobal.com/api/tools/unsubscribe?') && reminders.emailFromParam(u.searchParams.get('e')) === 'jane@acme.com' && u.searchParams.get('s') === sig);
  const one = templates.buildReminderEmail({ n: 1, name: 'Jane Smith', company: 'Acme', equityRange: 'SAR 382m to SAR 504m', bookingHref: 'https://www.pacemakersglobal.com/b/abcdefghijkme', resumeHref: 'https://www.pacemakersglobal.com/tools/business-valuation?resume=abcdefghijkmnpqr', unsubscribeHref: href });
  const two = templates.buildReminderEmail({ n: 2, name: 'Jane Smith', company: null, equityRange: null, bookingHref: 'https://www.pacemakersglobal.com/b/abcdefghijkme', resumeHref: null, unsubscribeHref: href });
  check('reminder 1: subject, name, valuation, booking button, edit link, unsubscribe', one.subject === 'A second look at your valuation of Acme' && one.body.includes('Hello Jane') && one.body.includes('SAR 382m to SAR 504m') && one.body.includes('Book a free call') && one.body.includes('resume=abcdefghijkmnpqr') && one.body.includes('Unsubscribe from reminders'));
  check('reminder 2: says it is the last, works without company, range or edit link', two.subject === 'Still thinking about your valuation?' && two.body.includes('last reminder') && two.body.includes('your business') && !two.body.includes('resume='));
  check('no em or en dash in either reminder', !/[\u2013\u2014]/.test(one.subject + one.body + two.subject + two.body));
}

console.log('4. Save and return');
{
  const ids = new Set(Array.from({ length: 200 }, () => resume.newResumeId()));
  check('resume ids are unique, 16 characters, validated', ids.size === 200 && [...ids].every((id) => id.length === 16 && resume.isResumeId(id)));
  check('malformed ids are refused', !resume.isResumeId('short') && !resume.isResumeId('0'.repeat(16)) && !resume.isResumeId('abcdefghijkmnpq!') && !resume.isResumeId(null));
  check('resume link is on the live https host', resume.resumeHref('business-valuation', 'abcdefghijkmnpqr') === 'https://www.pacemakersglobal.com/tools/business-valuation?resume=abcdefghijkmnpqr');
  const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
  const result = engine.runValuation(state.toInputs(minimalCase(state), VALUATION_DATE)).result;
  const email = templates.buildResultsEmail({ template: templates.DEFAULT_TEMPLATES[templates.RESULTS_TEMPLATE_KEY], name: 'A', email: 'a@example.com', company: null, result, bookingHref: 'https://www.pacemakersglobal.com/b/abcdefghijkme', resumeHref: 'https://www.pacemakersglobal.com/tools/business-valuation?resume=abcdefghijkmnpqr' });
  check('results email carries the edit and rerun link, marked personal', email.body.includes('Edit and rerun your valuation') && email.body.includes('resume=abcdefghijkmnpqr') && email.body.includes('do not forward'));
  const plain = templates.buildResultsEmail({ template: templates.DEFAULT_TEMPLATES[templates.RESULTS_TEMPLATE_KEY], name: 'A', email: 'a@example.com', company: null, result, bookingHref: 'https://www.pacemakersglobal.com/b/abcdefghijkme' });
  check('without a resume link the results email is as before', !plain.body.includes('Edit and rerun'));
}

const base = process.env.VERIFY_BASE;
if (base) {
  console.log(`HTTP, GET only, against ${base}`);
  const get = (p, headers = {}) => fetch(new URL(p, base), { redirect: 'manual', headers });
  const cron = await get('/api/cron/tool-reminders');
  check('reminder job refuses a caller without the cron secret', cron.status === 401 || cron.status === 503, String(cron.status));
  const wrong = await get('/api/cron/tool-reminders', { authorization: 'Bearer wrong' });
  check('reminder job refuses a wrong secret', wrong.status === 401 || wrong.status === 503, String(wrong.status));
  const unsub = await get('/api/tools/unsubscribe?e=amFuZUBhY21lLmNvbQ&s=forged');
  check('an unsigned unsubscribe link is refused and changes nothing', unsub.status === 400, String(unsub.status));
  const res = await get('/api/tools/business-valuation/resume?r=abcdefghijkmnpqr');
  check('an unknown resume link is a 404', res.status === 404, String(res.status));
  const bad = await get('/api/tools/business-valuation/resume?r=bad');
  check('a malformed resume link is a 404', bad.status === 404, String(bad.status));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
