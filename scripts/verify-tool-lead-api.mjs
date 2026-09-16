// scripts/verify-tool-lead-api.mjs
//
// Proves the lead submission rules in src/lib/tools/leads/valuation.ts against
// an in-memory store, so nothing touches the database or sends an email.
//
//   1. The server recomputes. A `result` sent by the browser is ignored, and
//      what is returned and stored equals a fresh engine run on the inputs.
//   2. Hidden tool: 404 to the public, saved as a test lead for staff.
//   3. Validation matches the form: consent, email, purpose, deal size,
//      malformed financials, and engine-level errors all refuse with 400.
//   4. Honeypot and the 3 second floor: results as normal, nothing saved, and a
//      response the same shape as a real save.
//   5. Rate limit: 5 per hour and 20 per day per IP hash, staff exempt.
//   6. A failed save (table missing) still returns results.
//   7. The stored row: consent text and time, follow-up consent, data version,
//      below-minimum flag, attribution, IP hash, a fresh access token.
//   8. Result serialisation round-trips NaN, which JSON cannot carry.
//
//   npm run verify-tool-lead-api
//
// With VERIFY_BASE set, also checks over HTTP that a logged-out submission to a
// Hidden tool is refused with 404 (nothing is saved by that request).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const leads = await jiti.import(path.join(root, 'src/lib/tools/leads/valuation.ts'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const data = await jiti.import(path.join(root, 'src/lib/tools/valuation/data.ts'));
const serialize = await jiti.import(path.join(root, 'src/lib/tools/valuation/serialize.ts'));
const consent = await jiti.import(path.join(root, 'src/lib/tools/consent.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

function exampleInputs() {
  return state.toInputs(state.onEnterWacc(state.onLeaveCompany(state.exampleState())));
}

function body(overrides = {}) {
  return {
    inputs: exampleInputs(),
    gate: { name: 'Test Person', email: 'Test@Example.com', company: 'Example Co', purpose: 'sale', dealSize: '50-200', consent: true, followUp: true },
    attribution: { utm_source: 'linkedin', utm_medium: 'social', utm_campaign: 'launch', referrer: 'https://www.linkedin.com/', landing_path: '/tools/business-valuation' },
    website: '',
    elapsedMs: 180000,
    ...overrides,
  };
}

function memoryStore({ hour = 0, day = 0, insertFails = null } = {}) {
  const inserted = [];
  return {
    inserted,
    async countSince(_ip, since) {
      const ago = Date.parse('2026-09-16T12:00:00Z') - Date.parse(since);
      return ago <= 3600_000 ? hour : day;
    },
    async insert(row) {
      if (insertFails) return { ok: false, reason: insertFails };
      inserted.push(row);
      return { ok: true, id: `00000000-0000-4000-8000-${String(inserted.length).padStart(12, '0')}` };
    },
  };
}

let tokenSeq = 0;
const ctx = (over = {}) => ({
  now: new Date('2026-09-16T12:00:00Z'),
  toolSlug: 'business-valuation',
  toolLive: true,
  isStaff: false,
  ipHash: 'a'.repeat(64),
  userAgent: 'VerifierAgent/1.0',
  newToken: () => `token-${++tokenSeq}-${'x'.repeat(40)}`,
  ...over,
});

const expected = engine.runValuation(exampleInputs()).result;
const expectedJson = JSON.stringify(serialize.serializeResult(expected));

console.log('Saved lead');
{
  const store = memoryStore();
  // A browser claiming a different result must be ignored.
  const out = await leads.processValuationSubmission({ ...body(), result: { equityDisplay: [1, 2, 3] } }, ctx(), store);
  check('status 200, kind saved', out.status === 200 && out.kind === 'saved', out.kind);
  check('returned result is the server recomputation', JSON.stringify(out.body.result) === expectedJson);
  check('one row inserted', store.inserted.length === 1);
  const row = store.inserted[0] ?? {};
  check('stored results equal the recomputation', JSON.stringify(row.results) === expectedJson);
  check('is_test false for a public submission', row.is_test === false);
  check('data_version stamped', row.data_version === data.VALUATION_DATA_VERSION);
  check('email lowercased', row.email === 'test@example.com');
  check('consent recorded with exact wording and time', row.consent_given === true && row.consent_text === consent.CONSENT_TEXT && row.consent_at === '2026-09-16T12:00:00.000Z');
  check('follow-up consent recorded', row.follow_up_consent === true && row.follow_up_consent_at === '2026-09-16T12:00:00.000Z');
  check('below_minimum false for 50-200', row.below_minimum === false);
  check('attribution stored', row.utm_source === 'linkedin' && row.utm_campaign === 'launch' && row.referrer === 'https://www.linkedin.com/' && row.landing_path === '/tools/business-valuation');
  check('ip hash stored, no raw IP', row.ip_hash === 'a'.repeat(64) && !('ip' in row));
  check('headline columns copied', row.equity_mid === expected.equityDisplay[1] && row.wacc === expected.wacc.wacc);
  check('currency, country and industry stored', row.currency === 'SAR' && row.country === 'Saudi Arabia' && row.industry === 'Healthcare Support Services');
  check('access token returned to the browser', out.body.lead?.token === row.access_token && row.access_token.length > 20);
  check('email statuses start pending', row.email_status === 'pending' && row.alert_status === 'pending');

  const noFollow = await leads.processValuationSubmission(body({ gate: { ...body().gate, followUp: false, dealSize: 'lt50' } }), ctx(), memoryStore());
  check('follow-up consent off is stored as false with no time', noFollow.saved.row.follow_up_consent === false && noFollow.saved.row.follow_up_consent_at === null);
  check('below_minimum true for lt50', noFollow.saved.row.below_minimum === true);
}

console.log('Visibility');
{
  const store = memoryStore();
  const hidden = await leads.processValuationSubmission(body(), ctx({ toolLive: false }), store);
  check('hidden tool, public: 404', hidden.status === 404 && store.inserted.length === 0);
  const preview = await leads.processValuationSubmission(body(), ctx({ toolLive: false, isStaff: true }), store);
  check('hidden tool, staff: saved as test', preview.kind === 'saved' && store.inserted[0]?.is_test === true);
  const liveStaff = await leads.processValuationSubmission(body(), ctx({ isStaff: true }), memoryStore());
  check('live tool, staff: saved as test', liveStaff.saved?.row.is_test === true);
}

console.log('Validation');
{
  const cases = [
    ['consent unticked', body({ gate: { ...body().gate, consent: false } })],
    ['bad email', body({ gate: { ...body().gate, email: 'not-an-email' } })],
    ['short name', body({ gate: { ...body().gate, name: 'A' } })],
    ['unknown purpose', body({ gate: { ...body().gate, purpose: 'other' } })],
    ['unknown deal size', body({ gate: { ...body().gate, dealSize: 'huge' } })],
    ['seven years of revenue', body({ inputs: { ...exampleInputs(), financials: { ...exampleInputs().financials, rev: [1, 2, 3, 4, 5, 6, 7] } } })],
    ['non-numeric cell', body({ inputs: { ...exampleInputs(), netDebt: 'lots' } })],
    ['no industry', body({ inputs: { ...exampleInputs(), industry: 'Crypto' } })],
    ['growth above WACC', body({ inputs: { ...exampleInputs(), growth: 15 } })],
    ['DCF weight above 100', body({ inputs: { ...exampleInputs(), dcfWeight: 120 } })],
    ['revenue zero in a year', body({ inputs: { ...exampleInputs(), financials: { ...exampleInputs().financials, rev: [180, 205, 0, 1, 1, 1, 1, 1] } } })],
    ['not an object', 'hello'],
  ];
  for (const [label, b] of cases) {
    const store = memoryStore();
    const out = await leads.processValuationSubmission(b, ctx(), store);
    check(`${label}: 400`, out.status === 400, `${out.status} ${out.kind}`);
    check(`${label}: nothing saved`, store.inserted.length === 0);
  }
  const growth = await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), growth: 15 } }), ctx(), memoryStore());
  check('engine error message is the form wording', growth.body.issues?.[0]?.message?.startsWith('Long-term growth must be at least 1% below WACC'), JSON.stringify(growth.body.issues));
}

console.log('Spam filters');
{
  const store = memoryStore();
  const honeypot = await leads.processValuationSubmission(body({ website: 'http://spam.example' }), ctx(), store);
  check('honeypot: 200 with results', honeypot.status === 200 && honeypot.kind === 'honeypot' && JSON.stringify(honeypot.body.result) === expectedJson);
  check('honeypot: nothing saved', store.inserted.length === 0);
  check('honeypot: response shape matches a save', JSON.stringify(Object.keys(honeypot.body)) === JSON.stringify(['ok', 'result', 'lead']) && honeypot.body.lead === null);
  const fast = await leads.processValuationSubmission(body({ elapsedMs: 2999 }), ctx(), store);
  check('under 3 seconds: results, nothing saved', fast.kind === 'too_fast' && store.inserted.length === 0);
  const edge = await leads.processValuationSubmission(body({ elapsedMs: 3000 }), ctx(), memoryStore());
  check('exactly 3 seconds is allowed', edge.kind === 'saved');
}

console.log('Rate limit');
{
  const at = async (hour, day, over = {}) => leads.processValuationSubmission(body(), ctx(over), memoryStore({ hour, day }));
  check(`${leads.RATE_LIMIT.perHour - 1} this hour: saved`, (await at(leads.RATE_LIMIT.perHour - 1, 10)).kind === 'saved');
  check(`${leads.RATE_LIMIT.perHour} this hour: rate limited`, (await at(leads.RATE_LIMIT.perHour, 10)).kind === 'rate_limited');
  check(`${leads.RATE_LIMIT.perDay - 1} today: saved`, (await at(0, leads.RATE_LIMIT.perDay - 1)).kind === 'saved');
  check(`${leads.RATE_LIMIT.perDay} today: rate limited`, (await at(0, leads.RATE_LIMIT.perDay)).kind === 'rate_limited');
  const limited = await at(99, 99);
  check('rate limited still returns results', JSON.stringify(limited.body.result) === expectedJson && limited.body.lead === null);
  check('staff are exempt', (await at(99, 99, { isStaff: true })).kind === 'saved');
  check('no IP hash: not limited', (await at(99, 99, { ipHash: null })).kind === 'saved');
}

console.log('Save failure');
{
  const out = await leads.processValuationSubmission(body(), ctx(), memoryStore({ insertFails: 'missing_table' }));
  check('table missing: 200 with results', out.status === 200 && out.kind === 'save_failed' && JSON.stringify(out.body.result) === expectedJson);
  check('table missing: no token, no delivery', out.body.lead === null && out.saved === null);
}

console.log('Serialisation');
{
  // Negative LTM EBITDA: EV from EBITDA comps is null, exit multiple values are NaN.
  const fin = { rev: [300, 280, 250, 260, 275, 290, 305, 320], ebitda: [12, 4, -6, 2, 8, 14, -3, -1], da: [10, 10, 9, 9, 9, 9, 10, 10], capex: [8, 6, 5, 5, 6, 6, 7, 7], nwc: [60, 58, 55, 56, 58, 60, 62, 64] };
  let s = state.initialState();
  s = state.applyIndustryDefaults({ ...s, industry: 'Engineering/Construction' });
  s = state.applyCountryDefaults({ ...s, country: 'United Arab Emirates', netDebt: '400' });
  s = state.onEnterWacc(state.resetWacc({ ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) }));
  const r = engine.runValuation(state.toInputs(s)).result;
  const back = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(r))));
  check('NaN survives the round trip', Number.isNaN(r.base.evX) && Number.isNaN(back.base.evX));
  check('compsEbitda null stays null', r.compsEbitda === null && back.compsEbitda === null);
  check('finite numbers unchanged', back.ev.every((v, i) => v === r.ev[i]) && back.wacc.wacc === r.wacc.wacc);
  check('sensitivity grid shape kept', back.sensitivity.grid.length === 5 && back.sensitivity.grid.every((row) => row.length === 5));
}

const BASE = process.env.VERIFY_BASE?.replace(/\/+$/, '');
if (BASE) {
  console.log(`HTTP against ${BASE}, logged out`);
  const res = await fetch(`${BASE}/api/tools/business-valuation/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()) });
  const expectLive = (process.env.EXPECT_LIVE ?? '').split(',').includes('business-valuation');
  check(`logged-out submission to a ${expectLive ? 'Live' : 'Hidden'} tool is ${expectLive ? '200' : '404'}`, res.status === (expectLive ? 200 : 404), String(res.status));
  const unknown = await fetch(`${BASE}/api/tools/not-a-tool/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('unknown tool is 404', unknown.status === 404, String(unknown.status));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
