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
//      before version 2 still accepted, schemaVersion stamped by the server;
//      version 3: the valuation date is the server's, a stale last actual year
//      is refused, a raise amount counts only when raising equity
//      whatever the browser claims, and the new validation refused with 400.
//  11. Company profile: the name and description are cleaned by the schema
//      itself (control characters, whitespace, two paragraphs, length caps),
//      stored with the inputs, used as the lead's company when the gate has
//      none, and never change a figure.
//  10. Email me this version (src/lib/tools/leads/version.ts): found by token
//      only, recomputed, the previous version kept before the lead is
//      overwritten, 5 an hour and 20 a day per lead with staff exempt, the
//      honeypot, a Hidden tool, and a failed save that still returns results.
//
//   npm run verify-tool-lead-api
//
// Refuses to run at all when VERIFY_BASE is production (its HTTP checks POST).
// With VERIFY_BASE set to a local build, also checks over HTTP that a logged-out submission to a
// Hidden tool is refused with 404, and that the version and PDF endpoints
// refuse an unknown token with 404. None of those requests writes anything.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { VALUATION_DATE, fullFeatureCase } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Never against production: see scripts/lib/productionGuard.mjs.
const { refuseWritesAgainstProduction } = await import('./lib/productionGuard.mjs');
refuseWritesAgainstProduction(process.env.VERIFY_BASE, 'verify-tool-lead-api');
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
  return state.toInputs(state.onEnterWacc(state.onLeaveCompany(state.exampleState())), VALUATION_DATE);
}

/**
 * The inputs as the server runs them: its own schema version and valuation date
 * (the context's clock is 2026-09-16), the gate's purpose, and a raise amount
 * only when raising equity.
 */
function asServer(inputs, purpose = 'sale') {
  // Version 4 when borrowings are sent; a page from before version 4 sends net debt alone and is stamped 3.
  const version = inputs.debt === null || inputs.debt === undefined ? 3 : 4;
  return { ...inputs, schemaVersion: version, valuationDate: '2026-09-16', purpose, raiseAmount: purpose === 'raise' ? (inputs.raiseAmount ?? null) : null };
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

const expected = engine.runValuation(asServer(exampleInputs())).result;
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
    ['non-numeric cell', body({ inputs: { ...exampleInputs(), debt: 'lots' } })],
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
  s = state.applyCountryDefaults({ ...s, country: 'United Arab Emirates', debt: '400', cash: '0' });
  s = state.onEnterWacc(state.resetWacc({ ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) }));
  const r = engine.runValuation(state.toInputs(s, VALUATION_DATE)).result;
  const back = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(r))));
  check('NaN survives the round trip', Number.isNaN(r.base.evX) && Number.isNaN(back.base.evX));
  check('compsEbitda null stays null', r.compsEbitda === null && back.compsEbitda === null);
  check('finite numbers unchanged', back.ev.every((v, i) => v === r.ev[i]) && back.wacc.wacc === r.wacc.wacc);
  check('sensitivity grid shape kept', back.sensitivity.grid.length === 5 && back.sensitivity.grid.every((row) => row.length === 5));

  // A version 3 lead (net debt as one figure, no cash, no invested capital, no
  // EV / EBIT peers): each of those nulls means "not entered" and must come
  // back as null, not NaN, or the report prints "n/a" and the wrong wording.
  const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
  const v3 = { ...state.toInputs(s, VALUATION_DATE), schemaVersion: 3, netDebt: 400 };
  delete v3.debt;
  delete v3.cash;
  const r3 = engine.runValuation(v3).result;
  const b3 = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(r3))));
  const absent = ['debt', 'cash', 'investedCapital'].filter((k) => r3[k] === null);
  check('version 3 nulls stay null: borrowings, cash, invested capital', absent.length === 3 && absent.every((k) => b3[k] === null), JSON.stringify({ debt: b3.debt, cash: b3.cash, ic: b3.investedCapital }));
  check('no EV / EBIT peers stays null', r3.comparables.ebitValue === null && b3.comparables.ebitValue === null && b3.comparables.ebitMultiplesPre === null && b3.comparables.ebitMultiplesPost === null);
  check('revived version 3 result reads "as entered", with no n/a', format.enteredAs(b3) === 'as entered' && !format.timingRows(b3).flat().some((x) => /n\/a/.test(x)), JSON.stringify(format.timingRows(b3)));
}

console.log('Version 2 inputs');
{
  const full = state.toInputs(fullFeatureCase(state), VALUATION_DATE);
  const store = memoryStore();
  const out = await leads.processValuationSubmission(body({ inputs: full }), ctx(), store);
  check('full feature inputs: saved', out.kind === 'saved', out.kind);
  const row = store.inserted[0] ?? { inputs: {} };
  check('stored inputs keep every version 2 block', ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital'].every((k) => row.inputs[k] !== undefined));
  check('stored bridge as submitted', JSON.stringify(row.inputs.bridge) === JSON.stringify(full.bridge));
  check('stored stake as submitted', JSON.stringify(row.inputs.stake) === JSON.stringify(full.stake));
  check('stored inputs carry schemaVersion 4', row.inputs.schemaVersion === 4);
  const fullResult = engine.runValuation(asServer(full)).result;
  check('stored results are the server recomputation', JSON.stringify(row.results) === JSON.stringify(serialize.serializeResult(fullResult)));
  check('stored results carry scenarios, stake and checks', row.results.scenarios.length === 3 && row.results.stake.used === true && Array.isArray(row.results.checks) && row.results.checks.length >= 11);

  const v1 = exampleInputs();
  for (const k of ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital', 'waccAdjustment', 'schemaVersion']) delete v1[k];
  const legacyStore = memoryStore();
  const legacy = await leads.processValuationSubmission(body({ inputs: v1 }), ctx(), legacyStore);
  check('inputs from before version 2: saved', legacy.kind === 'saved', legacy.kind);
  check('... with the same result as today', JSON.stringify(legacy.body.result) === expectedJson);
  check('... stamped schemaVersion 4', legacyStore.inserted[0]?.inputs.schemaVersion === 4);

  const claimed = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), schemaVersion: 1 } }), ctx(), claimed);
  check('a browser claiming schemaVersion 1 is stored as 4', claimed.inserted[0]?.inputs.schemaVersion === 4);

  // Borrowings and cash (version 4).
  {
    const ex = exampleInputs();
    check('the form sends borrowings and cash, and net debt as their difference', ex.debt === 65 && ex.cash === 20 && ex.netDebt === 45, JSON.stringify({ debt: ex.debt, cash: ex.cash, netDebt: ex.netDebt }));
    const lying = memoryStore();
    const liar = await leads.processValuationSubmission(body({ inputs: { ...ex, netDebt: 9999 } }), ctx(), lying);
    check('the server derives net debt from borrowings and cash, whatever net debt the browser sends', liar.kind === 'saved' && JSON.stringify(liar.body.result) === expectedJson);
    const noCash = await leads.processValuationSubmission(body({ inputs: { ...ex, cash: null } }), ctx(), memoryStore());
    check('blank cash is refused with its own message', noCash.status === 400 && noCash.body.issues.some((i) => i.path === 'inputs.cash' && i.message === engine.CASH_REQUIRED_MESSAGE), JSON.stringify(noCash.body));
    const negative = await leads.processValuationSubmission(body({ inputs: { ...ex, debt: -5 } }), ctx(), memoryStore());
    check('negative borrowings are refused', negative.status === 400 && negative.body.issues.some((i) => i.path === 'inputs.debt'), JSON.stringify(negative.body));
    const oldPage = memoryStore();
    const old = { ...ex, debt: undefined, cash: null, netDebt: 45 };
    delete old.debt;
    const oldOut = await leads.processValuationSubmission(body({ inputs: old }), ctx(), oldPage);
    check('a page from before version 4 (net debt, no borrowings) is still saved, stamped 3, same net debt', oldOut.kind === 'saved' && oldPage.inserted[0]?.inputs.schemaVersion === 3 && oldOut.result.netDebt === 45, oldOut.kind);
  }

  // Version 3: what the server decides.
  const dated = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), valuationDate: '2020-01-01' } }), ctx(), dated);
  check('a browser valuation date is replaced by the server date', dated.inserted[0]?.inputs.valuationDate === '2026-09-16' && dated.inserted[0]?.results.meta.valuationDate === '2026-09-16');
  const stale = memoryStore();
  const staleOut = await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), financialYear: 2024 } }), ctx(), stale);
  check('a last actual year more than 12 months before the server date is refused', staleOut.status === 400 && stale.inserted.length === 0 && JSON.stringify(staleOut.body).includes('ended 12 months or more ago'), JSON.stringify(staleOut.body).slice(0, 200));
  const raiseSale = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), raiseAmount: 80 } }), ctx(), raiseSale);
  check('a raise amount is dropped unless the purpose is raising equity', raiseSale.inserted[0]?.inputs.raiseAmount === null && raiseSale.inserted[0]?.results.raise === null && raiseSale.inserted[0]?.inputs.purpose === 'sale');
  const raising = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), raiseAmount: 80 }, gate: { ...body().gate, purpose: 'raise' } }), ctx(), raising);
  const rr = raising.inserted[0]?.results;
  check('raising equity: pre-money and post-money stored', rr?.raise?.amount === 80 && Math.abs(rr.raise.postMoney[1] - rr.raise.preMoney[1] - 80) < 1e-9 && Math.abs(rr.raise.investorStake[1] - 80 / rr.raise.postMoney[1]) < 1e-12);
  const gcc = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), gccOwnership: 0 } }), ctx(), gcc);
  check('Saudi / GCC ownership accepted and applied', gcc.inserted[0]?.inputs.gccOwnership === 0 && gcc.inserted[0]?.results.wacc.t === 0.2);
  const missing = memoryStore();
  const missingOut = await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), gccOwnership: null } }), ctx(), missing);
  check('Saudi / GCC ownership is required: a Saudi submission without it is refused', missingOut.status === 400 && missing.inserted.length === 0 && JSON.stringify(missingOut.body).includes('Saudi / GCC ownership'));
  const zakatBase = memoryStore();
  await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), cash: 30 } }), ctx(), zakatBase);
  check('cash is accepted and stored, and reaches the zakat base', zakatBase.inserted[0]?.inputs.cash === 30 && zakatBase.inserted[0]?.results.tax.zakatBaseLtm.cash === 30 && zakatBase.inserted[0]?.results.tax.zakatBaseLtm.base === 37 + 30);
  const badCash = await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), cash: -5 } }), ctx(), memoryStore());
  check('negative cash is refused', badCash.status === 400);
  const badGcc = await leads.processValuationSubmission(body({ inputs: { ...exampleInputs(), gccOwnership: 140 } }), ctx(), memoryStore());
  check('an ownership share above 100% is refused', badGcc.status === 400);

  const refuse = [
    ['negative lease liability', { ...full, bridge: { ...full.bridge, leases: -5 } }],
    ['weights totalling 90', { ...full, scenarios: { ...full.scenarios, weightBase: 40 } }],
    ['stake of 0', { ...full, stake: { ...full.stake, percent: 0 } }],
    ['stake adjustment not in the list', { ...full, stake: { ...full.stake, adjustment: 'bonus' } }],
    ['invested capital of zero', { ...full, investedCapitalParts: null, investedCapital: 0 }],
    ['negative net fixed assets', { ...full, investedCapitalParts: { workingCapital: null, fixedAssets: -5 } }],
    ['zakat rate above 10%', { ...full, country: 'Saudi Arabia', gccOwnership: 100, zakatRate: 12 }],
    ['add-back as text', { ...full, normalisation: { ...full.normalisation, oneOff: 'ten' } }],
  ];
  for (const [label, inputs] of refuse) {
    const st = memoryStore();
    const r = await leads.processValuationSubmission(body({ inputs }), ctx(), st);
    check(`${label}: 400, nothing saved`, r.status === 400 && st.inserted.length === 0, `${r.status} ${r.kind}`);
  }
}

console.log('Company profile');
{
  const profileInputs = (profile) => ({ ...exampleInputs(), profile });
  const messy = {
    companyName: '  Acme\u0007   Foods \n Ltd  ',
    description: '  First   paragraph\u0000 here.  \r\n\r\n\r\nSecond\tparagraph.\nThird paragraph is dropped.',
  };
  const st = memoryStore();
  const out = await leads.processValuationSubmission(body({ inputs: profileInputs(messy), gate: { ...body().gate, company: '' } }), ctx(), st);
  const stored = st.inserted[0]?.inputs.profile;
  check('profile: saved', out.kind === 'saved', out.kind);
  check('profile: company name cleaned', stored?.companyName === 'Acme Foods Ltd', JSON.stringify(stored?.companyName));
  check('profile: two paragraphs kept, cleaned, the third dropped', stored?.description === 'First paragraph here.\n\nSecond paragraph.', JSON.stringify(stored?.description));
  check('profile: the gate had no company, so the lead takes the profile name', st.inserted[0]?.company === 'Acme Foods Ltd');
  // The profile reaches the result's meta block only; every figure is unchanged.
  const withoutCompany = (x) => JSON.stringify({ ...x, meta: { ...x.meta, company: null } });
  check('profile: figures unchanged', withoutCompany(out.body.result) === withoutCompany(JSON.parse(expectedJson)) && out.body.result.meta.company === 'Acme Foods Ltd');

  const gateWins = memoryStore();
  await leads.processValuationSubmission(body({ inputs: profileInputs(messy) }), ctx(), gateWins);
  check('profile: a company typed at the gate wins', gateWins.inserted[0]?.company === 'Example Co');

  const long = memoryStore();
  await leads.processValuationSubmission(body({ inputs: profileInputs({ companyName: 'N'.repeat(500), description: 'x'.repeat(4000) }) }), ctx(), long);
  const lp = long.inserted[0]?.inputs.profile;
  check('profile: name capped at 120 and description at 1,000 characters', lp?.companyName.length === 120 && lp?.description.length === 1000, JSON.stringify([lp?.companyName?.length, lp?.description?.length]));

  const empty = memoryStore();
  await leads.processValuationSubmission(body({ inputs: profileInputs({ companyName: '   ', description: '\n\n' }) }), ctx(), empty);
  check('profile: blank fields store no profile', empty.inserted[0] && !('profile' in empty.inserted[0].inputs && empty.inserted[0].inputs.profile));

  const absurd = memoryStore();
  const refused = await leads.processValuationSubmission(body({ inputs: profileInputs({ companyName: 'x', description: 'y'.repeat(20000) }) }), ctx(), absurd);
  check('profile: an absurd payload is refused', refused.status === 400 && absurd.inserted.length === 0, refused.status);
  const wrongType = await leads.processValuationSubmission(body({ inputs: profileInputs({ companyName: 5 }) }), ctx(), memoryStore());
  check('profile: a non-string name is refused', wrongType.status === 400);
}

console.log('Email me this version');
{
  const TOKEN = 'lead-token-' + 'y'.repeat(40);
  const original = { inputs: exampleInputs(), results: JSON.parse(expectedJson) };
  function versionStore({ hour = 0, day = 0, rerunHour = 0, rerunDay = 0, saveFails = false } = {}) {
    const lead = { id: '00000000-0000-4000-8000-000000000001', tool_slug: 'business-valuation', is_test: false, inputs: original.inputs, results: original.results, data_version: '2026-01-01' };
    const events = [];
    const saves = [];
    return {
      lead, events, saves,
      async findByToken(t) { return t === TOKEN ? lead : null; },
      async countVersionsSince(_id, since, kind) {
        const ago = Date.parse('2026-09-16T12:00:00Z') - Date.parse(since);
        return kind === 'rerun' ? (ago <= 3600_000 ? rerunHour : rerunDay) : ago <= 3600_000 ? hour : day;
      },
      async saveVersion(l, next, kind) {
        if (saveFails) return false;
        // As the route does: the previous version is recorded first, then overwritten.
        events.push({ event_type: 'version_saved', payload: { kind, previous: { inputs: l.inputs, results: l.results, data_version: l.data_version } } });
        saves.push(next);
        Object.assign(l, next);
        return true;
      },
    };
  }
  const vctx = (over = {}) => ({ now: new Date('2026-09-16T12:00:00Z'), toolLive: true, isStaff: false, ...over });
  const changed = { ...exampleInputs(), growth: 3, exitMultiple: 9, waccAdjustment: 1 };
  const changedResult = engine.runValuation({ ...changed, schemaVersion: 4, valuationDate: '2026-09-16' }).result;
  const changedJson = JSON.stringify(serialize.serializeResult(changedResult));

  const st = versionStore();
  const out = await version.processVersionUpdate({ token: TOKEN, inputs: changed, result: { forged: true } }, vctx(), st);
  check('version: 200 saved', out.status === 200 && out.kind === 'saved', out.kind);
  check('version: result is the server recomputation', JSON.stringify(out.body.result) === changedJson);
  check('version: the lead now holds the new inputs and results', st.lead.inputs.growth === 3 && JSON.stringify(st.lead.results) === changedJson);
  check('version: stamped schemaVersion 4, the server date and the current data version', st.saves[0].inputs.schemaVersion === 4 && st.saves[0].inputs.valuationDate === '2026-09-16' && st.saves[0].data_version === data.VALUATION_DATA_VERSION);
  check('version: headline columns updated', st.saves[0].equity_mid === changedResult.equityDisplay[1] && st.saves[0].wacc === changedResult.wacc.wacc);
  check('version: previous inputs and results kept in the event', st.events.length === 1 && st.events[0].payload.previous.inputs.growth === original.inputs.growth && JSON.stringify(st.events[0].payload.previous.results) === expectedJson);
  check('version: previous data version kept', st.events[0].payload.previous.data_version === '2026-01-01');
  check('version: returns the lead for the resend', out.lead?.id === st.lead.id && out.result?.equityDisplay[1] === changedResult.equityDisplay[1]);
  check('version: Email me this version is emailed, recorded as kind results', out.emailed === true && st.events[0].payload.kind === 'results');

  // Running again in the same session: a new version on the same lead, nothing sent.
  const rr = versionStore();
  const rerun = await version.processVersionUpdate({ token: TOKEN, inputs: changed, sendEmail: false }, vctx(), rr);
  check('re-run: saved to the same lead as a new version', rerun.kind === 'saved' && rr.saves.length === 1 && rr.lead.inputs.growth === 3 && rr.events.length === 1);
  check('re-run: not emailed, recorded as kind rerun', rerun.emailed === false && rr.events[0].payload.kind === 'rerun');
  check('re-run: previous version kept for the history', JSON.stringify(rr.events[0].payload.previous.results) === expectedJson);
  const R = version.RERUN_RATE_LIMIT;
  check('re-run limits are 30 an hour and 100 a day', R.perHour === 30 && R.perDay === 100);
  check('re-runs do not use up the email limit', (await version.processVersionUpdate({ token: TOKEN, inputs: changed, sendEmail: false }, vctx(), versionStore({ hour: 9, day: 9 }))).kind === 'saved');
  check('emailed versions do not use up the re-run limit', (await version.processVersionUpdate({ token: TOKEN, inputs: changed }, vctx(), versionStore({ rerunHour: 99, rerunDay: 99 }))).kind === 'saved');
  const rrLimited = versionStore({ rerunHour: 30, rerunDay: 30 });
  const rrOut = await version.processVersionUpdate({ token: TOKEN, inputs: changed, sendEmail: false }, vctx(), rrLimited);
  check('re-run over its limit: 429 with the result, nothing saved', rrOut.status === 429 && Boolean(rrOut.body.result) && rrLimited.saves.length === 0);
  check('sendEmail must be a boolean', (await version.processVersionUpdate({ token: TOKEN, inputs: changed, sendEmail: 'no' }, vctx(), versionStore())).status === 400);

  // The purpose is the lead's: a sale lead cannot be given a pre-money section by the browser.
  const saleStore = versionStore();
  saleStore.lead.purpose = 'sale';
  const asRaise = await version.processVersionUpdate({ token: TOKEN, inputs: { ...changed, purpose: 'raise', raiseAmount: 50 } }, vctx(), saleStore);
  check('version: a sale lead stays a sale, no raise section', asRaise.kind === 'saved' && asRaise.result.raise === null && saleStore.saves[0]?.inputs.purpose === 'sale', JSON.stringify(asRaise.result?.raise));
  const raiseStore = versionStore();
  raiseStore.lead.purpose = 'raise';
  const realRaise = await version.processVersionUpdate({ token: TOKEN, inputs: { ...changed, purpose: 'sale', raiseAmount: 50 } }, vctx(), raiseStore);
  check('version: a raise lead keeps its raise amount', realRaise.kind === 'saved' && realRaise.result.raise !== null && raiseStore.saves[0]?.inputs.purpose === 'raise');

  const claimedStore = versionStore();
  await version.processVersionUpdate({ token: TOKEN, inputs: { ...changed, schemaVersion: 1 } }, vctx(), claimedStore);
  check('version: inputs claiming schemaVersion 1 stored as 4', claimedStore.saves[0]?.inputs.schemaVersion === 4, String(claimedStore.saves[0]?.inputs.schemaVersion));

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
  // SAFETY. A valid submission to a Live tool is a real lead: it is saved and
  // both emails are sent. On 2026-09-16 this check ran against production after
  // the tool had been switched Live and created one. So the submission is only
  // sent after a GET proves the tool page is a 404 (Hidden) at this base URL,
  // and never when EXPECT_LIVE names the tool. Otherwise it is skipped, loudly.
  const expectLive = (process.env.EXPECT_LIVE ?? '').split(',').includes('business-valuation');
  const toolPage = await fetch(`${BASE}/tools/business-valuation`, { redirect: 'manual' });
  if (!expectLive && toolPage.status === 404) {
    const res = await fetch(`${BASE}/api/tools/business-valuation/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()) });
    check('logged-out submission to a Hidden tool is 404', res.status === 404, String(res.status));
  } else {
    console.log(`  SKIPPED  the lead submission: the tool page is ${toolPage.status}${expectLive ? ' and EXPECT_LIVE names it' : ''}. Sending it would save a real lead and email it.`);
    check('a Live tool is not submitted to (tool page status read first)', true);
  }
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
