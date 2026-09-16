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
//   9. Version 2 inputs: every optional block accepted and stored, inputs from
//      before version 2 still accepted, schemaVersion stamped by the server
//      whatever the browser claims, and the new validation refused with 400.
//  10. Email me this version (src/lib/tools/leads/version.ts): found by token
//      only, recomputed, the previous version kept before the lead is
//      overwritten, 5 an hour and 20 a day per lead with staff exempt, the
//      honeypot, a Hidden tool, and a failed save that still returns results.
//
//   npm run verify-tool-lead-api
//
// With VERIFY_BASE set, also checks over HTTP that a logged-out submission to a
// Hidden tool is refused with 404, and that the version and PDF endpoints
// refuse an unknown token with 404. None of those requests writes anything.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { fullFeatureCase } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const leads = await jiti.import(path.join(root, 'src/lib/tools/leads/valuation.ts'));
const version = await jiti.import(path.join(root, 'src/lib/tools/leads/version.ts'));
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

console.log('Version 2 inputs');
{
  const full = state.toInputs(fullFeatureCase(state));
  const store = memoryStore();
  const out = await leads.processValuationSubmission(body({ inputs: full }), ctx(), store);
  check('full feature inputs: saved', out.kind === 'saved', out.kind);
  const row = store.inserted[0] ?? { inputs: {} };
  check('stored inputs keep every version 2 block', ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital'].every((k) => row.inputs[k] !== undefined));
  check('stored bridge as submitted', JSON.stringify(row.inputs.bridge) === JSON.stringify(full.bridge));
  check('stored stake as submitted', JSON.stringify(row.inputs.stake) === JSON.stringify(full.stake));
  check('stored inputs carry schemaVersion 2', row.inputs.schemaVersion === 2);
  const fullResult = engine.runValuation(full).result;
  check('stored results are the version 2 recomputation', JSON.stringify(row.results) === JSON.stringify(serialize.serializeResult(fullResult)));
  check('stored results carry scenarios, stake and warnings', row.results.scenarios.length === 3 && row.results.stake.used === true && Array.isArray(row.results.warnings));

  const v1 = exampleInputs();
  for (const k of ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital', 'waccAdjustment', 'schemaVersion']) delete v1[k];
  const legacyStore = memoryStore();
  const legacy = await leads.processValuationSubmission(body({ inputs: v1 }), ctx(), legacyStore);
  check('inputs from before version 2: saved', legacy.kind === 'saved', legacy.kind);
  check('... with the same result as today', JSON.stringify(legacy.body.result) === expectedJson);
  check('... stamped schemaVersion 2', legacyStore.inserted[0]?.inputs.schemaVersion === 2);

  const claimed = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), schemaVersion: 1 } }), ctx(), claimed);
  check('a browser claiming schemaVersion 1 is stored as 2', claimed.inserted[0]?.inputs.schemaVersion === 2);

  const refuse = [
    ['negative lease liability', { ...full, bridge: { ...full.bridge, leases: -5 } }],
    ['weights totalling 90', { ...full, scenarios: { ...full.scenarios, weightBase: 40 } }],
    ['stake of 0', { ...full, stake: { ...full.stake, percent: 0 } }],
    ['stake adjustment not in the list', { ...full, stake: { ...full.stake, adjustment: 'bonus' } }],
    ['invested capital of zero', { ...full, investedCapital: 0 }],
    ['add-back as text', { ...full, normalisation: { ...full.normalisation, oneOff: 'ten' } }],
  ];
  for (const [label, inputs] of refuse) {
    const st = memoryStore();
    const r = await leads.processValuationSubmission(body({ inputs }), ctx(), st);
    check(`${label}: 400, nothing saved`, r.status === 400 && st.inserted.length === 0, `${r.status} ${r.kind}`);
  }
}

console.log('Email me this version');
{
  const TOKEN = 'lead-token-' + 'y'.repeat(40);
  const original = { inputs: exampleInputs(), results: JSON.parse(expectedJson) };
  function versionStore({ hour = 0, day = 0, saveFails = false } = {}) {
    const lead = { id: '00000000-0000-4000-8000-000000000001', tool_slug: 'business-valuation', is_test: false, inputs: original.inputs, results: original.results, data_version: '2026-01-01' };
    const events = [];
    const saves = [];
    return {
      lead, events, saves,
      async findByToken(t) { return t === TOKEN ? lead : null; },
      async countVersionsSince(_id, since) {
        const ago = Date.parse('2026-09-16T12:00:00Z') - Date.parse(since);
        return ago <= 3600_000 ? hour : day;
      },
      async saveVersion(l, next) {
        if (saveFails) return false;
        // As the route does: the previous version is recorded first, then overwritten.
        events.push({ event_type: 'version_saved', payload: { previous: { inputs: l.inputs, results: l.results, data_version: l.data_version } } });
        saves.push(next);
        Object.assign(l, next);
        return true;
      },
    };
  }
  const vctx = (over = {}) => ({ now: new Date('2026-09-16T12:00:00Z'), toolLive: true, isStaff: false, ...over });
  const changed = { ...exampleInputs(), growth: 3, exitMultiple: 9, waccAdjustment: 1 };
  const changedResult = engine.runValuation(changed).result;
  const changedJson = JSON.stringify(serialize.serializeResult(changedResult));

  const st = versionStore();
  const out = await version.processVersionUpdate({ token: TOKEN, inputs: changed, result: { forged: true } }, vctx(), st);
  check('version: 200 saved', out.status === 200 && out.kind === 'saved', out.kind);
  check('version: result is the server recomputation', JSON.stringify(out.body.result) === changedJson);
  check('version: the lead now holds the new inputs and results', st.lead.inputs.growth === 3 && JSON.stringify(st.lead.results) === changedJson);
  check('version: stamped schemaVersion 2 and the current data version', st.saves[0].inputs.schemaVersion === 2 && st.saves[0].data_version === data.VALUATION_DATA_VERSION);
  check('version: headline columns updated', st.saves[0].equity_mid === changedResult.equityDisplay[1] && st.saves[0].wacc === changedResult.wacc.wacc);
  check('version: previous inputs and results kept in the event', st.events.length === 1 && st.events[0].payload.previous.inputs.growth === original.inputs.growth && JSON.stringify(st.events[0].payload.previous.results) === expectedJson);
  check('version: previous data version kept', st.events[0].payload.previous.data_version === '2026-01-01');
  check('version: returns the lead for the resend', out.lead?.id === st.lead.id && out.result?.equityDisplay[1] === changedResult.equityDisplay[1]);

  const claimedStore = versionStore();
  await version.processVersionUpdate({ token: TOKEN, inputs: { ...changed, schemaVersion: 1 } }, vctx(), claimedStore);
  check('version: inputs claiming schemaVersion 1 stored as 2', claimedStore.saves[0]?.inputs.schemaVersion === 2, String(claimedStore.saves[0]?.inputs.schemaVersion));

  const at = async (hour, day, over = {}) => version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx(over), versionStore({ hour, day }));
  const L = version.VERSION_RATE_LIMIT;
  check('limits are 5 an hour and 20 a day', L.perHour === 5 && L.perDay === 20);
  check('4 this hour: saved', (await at(4, 4)).kind === 'saved');
  const limited = await at(5, 5);
  check('5 this hour: 429', limited.status === 429 && limited.kind === 'rate_limited');
  check('19 today: saved', (await at(0, 19)).kind === 'saved');
  check('20 today: 429', (await at(0, 20)).status === 429);
  const limitedStore = versionStore({ hour: 9, day: 9 });
  const limited2 = await version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx(), limitedStore);
  check('rate limited: nothing saved, no event', limitedStore.saves.length === 0 && limitedStore.events.length === 0 && limited2.lead === null);
  check('staff exempt from the limit', (await at(99, 99, { isStaff: true })).kind === 'saved');

  const unknown = await version.processVersionUpdate({ token: 'z'.repeat(40), inputs: changed }, vctx(), versionStore());
  check('unknown token: 404', unknown.status === 404 && unknown.kind === 'not_found');
  check('short token: 400', (await version.processVersionUpdate({ token: 'abc', inputs: changed }, vctx(), versionStore())).status === 400);
  check('no token: 400', (await version.processVersionUpdate({ inputs: changed }, vctx(), versionStore())).status === 400);
  const hiddenStore = versionStore();
  check('hidden tool, public: 404, nothing saved', (await version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx({ toolLive: false }), hiddenStore)).status === 404 && hiddenStore.saves.length === 0);
  check('hidden tool, staff: saved', (await version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx({ toolLive: false, isStaff: true }), versionStore())).kind === 'saved');

  const badStore = versionStore();
  const bad = await version.processVersionUpdate({ token: TOKEN, inputs: { ...changed, growth: 15 } }, vctx(), badStore);
  check('invalid inputs: 400 with the form wording, nothing saved', bad.status === 400 && bad.body.issues?.[0]?.message?.startsWith('Long-term growth') && badStore.saves.length === 0);

  const honeyStore = versionStore();
  const honey = await version.processVersionUpdate({ token: TOKEN, inputs: changed, website: 'http://spam.example' }, vctx(), honeyStore);
  check('honeypot: 200 with results, nothing saved', honey.status === 200 && JSON.stringify(honey.body.result) === changedJson && honeyStore.saves.length === 0 && honey.lead === null);
  check('honeypot: body shape matches a save', JSON.stringify(Object.keys(honey.body)) === JSON.stringify(Object.keys(out.body)));

  const failStore = versionStore({ saveFails: true });
  const failed = await version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx(), failStore);
  check('save failure: 500 that still carries the results', failed.status === 500 && JSON.stringify(failed.body.result) === changedJson && failed.lead === null);
}

const BASE = process.env.VERIFY_BASE?.replace(/\/+$/, '');
if (BASE) {
  console.log(`HTTP against ${BASE}, logged out`);
  const res = await fetch(`${BASE}/api/tools/business-valuation/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()) });
  const expectLive = (process.env.EXPECT_LIVE ?? '').split(',').includes('business-valuation');
  check(`logged-out submission to a ${expectLive ? 'Live' : 'Hidden'} tool is ${expectLive ? '200' : '404'}`, res.status === (expectLive ? 200 : 404), String(res.status));
  const unknown = await fetch(`${BASE}/api/tools/not-a-tool/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check('unknown tool is 404', unknown.status === 404, String(unknown.status));
  const post = (route, payload) => fetch(`${BASE}/api/tools/business-valuation/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const bogus = 'verifier-unknown-token-' + '0'.repeat(30);
  const v = await post('lead/version', { token: bogus, inputs: exampleInputs() });
  check('version endpoint, unknown token: 404', v.status === 404, String(v.status));
  const pdf = await post('pdf', { token: bogus, inputs: exampleInputs() });
  check('PDF endpoint, unknown token: 404', pdf.status === 404, String(pdf.status));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
