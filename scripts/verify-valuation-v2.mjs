// scripts/verify-valuation-v2.mjs
//
// Proves the version 2 features of the Business Valuation engine, which the
// reference implementation does not have and so verify-valuation-engine cannot
// check. Every expected value is derived here from the inputs by independent
// arithmetic, never read back from the engine and compared with itself.
//
// WHAT IT CHECKS
//   1. Neutral defaults: inputs with every version 2 block absent and with the
//      defaults written out produce the same numbers, and nothing extra shows.
//   2. Scenarios and weights: the rebuilt forecasts, base equal to the headline,
//      ordering, the weighted value, weight validation, and the football field.
//   3. Normalised EBITDA: comparables use it, the DCF does not unless owner
//      costs are carried, and carried costs lift every forecast year.
//   4. Each bridge item on its own, at all three points, in the sensitivity
//      grid and the waterfall, plus validation of negative amounts.
//   5. Stake: plain, with a control premium, with a minority discount, and the
//      validation ranges.
//   6. Exit multiple discount: applied to the DCF exit multiple exactly, and the
//      20% automatic default once two peers are in use, which a typed value keeps.
//   7. Every warning, triggering and not, with the metric shown to sit on the
//      right side of its threshold in both cases.
//   8. Pakistan with every feature in use at once, and every formatter run over
//      it with no NaN or undefined in the text.
//   9. Schema version and the WACC adjustment.
//  10. Review round two: the cost of capital lever equals the sensitivity
//      table's cells; a control premium on a stake of 50% or less warns and the
//      form defaults such a stake to a minority discount; terminal growth more
//      than one point below or two points above expected local inflation warns.
//  11. Version 3, each against arithmetic done here: the normalised terminal
//      cash flow (the regression case's 45.7 and 8.1x), the stub period and its
//      discount periods, the twelve month refusal, zakat by ownership share,
//      loss carry-forward with the country cap, pre-money and post-money, every
//      check triggering and silent, the recommendation rules, the dated market
//      data, the reconciliation assertions (passing, and catching a tampered
//      result), serialisation of the new null fields, stored leads from before
//      version 3 reproduced for their report, and the thousands unit.
//
// Warnings are version 3 checks: the codes below are check ids.
//
//   npm run verify-valuation-v2
//
// No server, database or browser.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { VALUATION_DATE, fullFeatureCase, minimalCase, withFin } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const data = await jiti.import(path.join(root, 'src/lib/tools/valuation/data.ts'));
const serialize = await jiti.import(path.join(root, 'src/lib/tools/valuation/serialize.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const reconcileModule = await jiti.import(path.join(root, 'src/lib/tools/valuation/reconcile.ts'));
const reportResult = await jiti.import(path.join(root, 'src/lib/tools/leads/reportResult.ts'));

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail !== '' ? `: ${detail}` : ''}`);
}
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const near = (label, got, want, tol) => check(label, close(got, want, tol), `got ${got}, want ${want}`);
const clone = (o) => JSON.parse(JSON.stringify(o));

function run(inputs) {
  const o = engine.runValuation(inputs);
  if (!o.ok) throw new Error(`engine refused at step ${o.step}: ${JSON.stringify(o.errors)}`);
  return o.result;
}
function tryRun(label, inputs) {
  const o = engine.runValuation(inputs);
  check(`${label}: runs`, o.ok, o.ok ? '' : JSON.stringify(o.errors));
  return o.ok ? o.result : null;
}

const BASE = state.toInputs(minimalCase(state), VALUATION_DATE);
const B = run(BASE);
const H = 3; // history years
const codes = (r) => r.checks.filter((c) => c.status === 'warning').map((c) => c.id);
const checkOf = (r, id) => r.checks.find((c) => c.id === id);
/** What the regression case warns on, on purpose: see section 11. */
const BASE_WARNINGS = 'method_divergence,tv_share,peer_count,capital_structure,no_normalisation';

console.log('1. Neutral defaults');
{
  const stripped = clone(BASE);
  for (const k of ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital', 'waccAdjustment']) delete stripped[k];
  const S = run(stripped);
  for (const k of ['ev', 'equity', 'equityDisplay', 'dcfRange', 'compRange']) {
    check(`${k} identical with the blocks absent`, S[k].every((v, i) => v === B[k][i]), `${S[k]} vs ${B[k]}`);
  }
  check('WACC identical', S.wacc.wacc === B.wacc.wacc && B.wacc.adjustment === 0);
  check('stake not used at 100% and no adjustment', !B.stake.used && B.stake.percent === 100);
  check('normalisation not used', !B.normalisation.used && B.ltmEbitda === B.ltmEbitdaReported);
  check('no other claims', B.bridge.otherClaims === 0);
  // Version 3: net debt at the year end, then the cash flow since it, between EV and equity.
  // Version 3: net debt at the year end, the cash flow since, and after-tax interest on that net debt.
  check('bridge table has net debt, the cash flow since the year end and the interest on it between EV and equity', format.bridgeTable(B).rows.length === 7);
  check('headline shows no stake', format.headline(B).stakeRange === null);
  check('default weights 25/50/25', B.scenarios.map((s) => s.weight).join() === '0.25,0.5,0.25');
  check('reference example warns on exactly the expected checks', codes(B).join() === BASE_WARNINGS, codes(B).join());
  const withProfile = run({ ...BASE, profile: { companyName: 'Anything Ltd', description: 'Text.' } });
  check('a company profile changes no figure', JSON.stringify(withProfile.equity) === JSON.stringify(B.equity) && withProfile.weightedEquity === B.weightedEquity);
}

console.log('2. Scenarios and weights');
{
  const fin = BASE.financials;
  const same = engine.scenarioFinancials(fin, 0, 0);
  check('zero adjustment rebuilds the forecast unchanged', [3, 4, 5, 6, 7].every((i) => close(same.rev[i], fin.rev[i]) && close(same.ebitda[i], fin.ebitda[i])));

  const up = engine.scenarioFinancials(fin, 3, 2);
  let prevBase = fin.rev[H - 1], prevNew = prevBase, ok = true, marginOk = true, capexOk = true;
  for (let i = H; i < 8; i++) {
    const want = prevNew * (fin.rev[i] / prevBase + 0.03);
    if (!close(up.rev[i], want)) ok = false;
    if (!close(up.ebitda[i] / up.rev[i], fin.ebitda[i] / fin.rev[i] + 0.02)) marginOk = false;
    if (!close(up.capex[i] / up.rev[i], fin.capex[i] / fin.rev[i])) capexOk = false;
    prevBase = fin.rev[i];
    prevNew = up.rev[i];
  }
  check('upside: each year grows 3 points faster, compounding', ok);
  check('upside: each year margin 2 points higher', marginOk);
  check('upside: capex keeps its share of revenue', capexOk);
  check('history untouched by a scenario', [0, 1, 2].every((i) => up.rev[i] === fin.rev[i] && up.ebitda[i] === fin.ebitda[i]));

  const [down, base, upS] = B.scenarios;
  check('order is downside, base, upside', [down.key, base.key, upS.key].join() === 'downside,base,upside');
  check('base scenario is the headline', base.equity.every((v, i) => v === B.equity[i]) && base.ev.every((v, i) => v === B.ev[i]));
  check('upside above base above downside', upS.equity[1] > base.equity[1] && base.equity[1] > down.equity[1]);
  const manualUp = run({ ...BASE, financials: engine.scenarioFinancials(fin, 3, 2) });
  // Net debt at the valuation date is the base forecast's for every scenario.
  near('upside equals a run on the upside forecast', upS.ev[1], manualUp.ev[1]);
  near('upside equity uses the base net debt at the valuation date', upS.equity[1], manualUp.ev[1] - B.bridge.netDebtAtValuationDate);
  const manualDown = run({ ...BASE, financials: engine.scenarioFinancials(fin, -3, -2) });
  near('downside equals a run on the downside forecast', down.ev[1], manualDown.ev[1]);
  near('downside equity uses the base net debt at the valuation date', down.equity[1], manualDown.ev[1] - B.bridge.netDebtAtValuationDate);
  near('weighted value is the weighted midpoints', B.weightedEquity, 0.25 * down.equity[1] + 0.5 * base.equity[1] + 0.25 * upS.equity[1]);

  const custom = run({ ...BASE, scenarios: { ...BASE.scenarios, weightDownside: 0, weightBase: 100, weightUpside: 0 } });
  near('weights 0/100/0: weighted value is the base midpoint', custom.weightedEquity, Math.max(0, custom.equity[1]));
  const skew = run({ ...BASE, scenarios: { ...BASE.scenarios, weightDownside: 60, weightBase: 30, weightUpside: 10 } });
  check('more weight on the downside lowers the weighted value', skew.weightedEquity < B.weightedEquity);

  const wacc = B.wacc.wacc;
  const bad = (sc) => engine.validateTerminal({ ...BASE, scenarios: { ...BASE.scenarios, ...sc } }, wacc);
  check('weights totalling 90 refused', bad({ weightBase: 40 }) === 'Scenario weights must total 100%.');
  check('weights totalling 110 refused', bad({ weightBase: 60 }) === 'Scenario weights must total 100%.');
  check('a negative weight refused', bad({ weightDownside: -5, weightBase: 80 }) === 'Enter scenario weights of 0% or more.');
  check('a missing adjustment refused', bad({ upsideGrowth: null }) === 'Enter every scenario adjustment. Use 0 for no change.');
  check('valid weights accepted', bad({}) === null);

  const ff = format.footballFieldRows(B);
  const scRow = ff.find((r) => r.key === 'scenarios');
  check('football field has a scenarios row', Boolean(scRow));
  // In enterprise value, like every other row. Version 3: the marker is the base case on every row, this one included.
  check('scenarios row is downside, base case and upside EV', scRow && close(scRow.range[0], down.ev[1]) && close(scRow.range[1], base.ev[1]) && close(scRow.range[2], upS.ev[1]), JSON.stringify(scRow?.range));
  check('scenarios table ends with the weighted row', format.scenariosTable(B).rows.at(-1).label === 'Probability-weighted');
}

console.log('3. Normalised EBITDA');
{
  const disc = B.privateDiscount;
  const one = run({ ...BASE, normalisation: { oneOff: 10, ownerCosts: null, carryOwnerCosts: false } });
  near('one-off: LTM EBITDA is reported plus 10', one.ltmEbitda, B.ltmEbitdaReported + 10);
  check('one-off: reported LTM EBITDA kept', one.ltmEbitdaReported === B.ltmEbitdaReported && one.normalisation.used);
  check('one-off: comparables EBITDA uses the normalised figure', one.compsEbitda.every((v, i) => close(v, one.ltmEbitda * one.comps.ebitda[i] * (1 - disc))));
  check('one-off: DCF unchanged', one.dcfRange.every((v, i) => v === B.dcfRange[i]));
  check('one-off: comparables value rises', one.compRange[1] > B.compRange[1]);
  near('one-off: LTM multiple on the normalised figure', one.ltmMultiple, one.ev[1] / one.ltmEbitda);
  check('one-off: normalisation rows shown', format.normalisationRows(one).length === 5);

  const owner = run({ ...BASE, normalisation: { oneOff: null, ownerCosts: 6, carryOwnerCosts: false } });
  near('owner costs, not carried: LTM plus 6', owner.ltmEbitda, B.ltmEbitdaReported + 6);
  check('owner costs, not carried: DCF unchanged', owner.dcfRange.every((v, i) => v === B.dcfRange[i]));
  const carried = run({ ...BASE, normalisation: { oneOff: null, ownerCosts: 6, carryOwnerCosts: true } });
  check('owner costs carried: every forecast year EBITDA plus 6', carried.rows.every((r, k) => close(r.ebitda, B.rows[k].ebitda + 6)));
  check('owner costs carried: history EBITDA unchanged', [0, 1, 2].every((i) => carried.ebitda[i] === B.ebitda[i]));
  check('owner costs carried: DCF rises', carried.dcfRange[1] > B.dcfRange[1]);
  const oneOffCarry = run({ ...BASE, normalisation: { oneOff: 10, ownerCosts: null, carryOwnerCosts: true } });
  check('one-off costs are never carried into the forecast', oneOffCarry.dcfRange.every((v, i) => v === B.dcfRange[i]));
  check('a non-numeric add-back refused', engine.validateFinancials(BASE.financials, { normalisation: { oneOff: NaN, ownerCosts: null, carryOwnerCosts: false } }) === 'Enter add-backs as numbers, or leave them blank.');
}

console.log('4. Bridge items');
{
  const items = [
    ['eosb', -1, 'Less end of service benefits'],
    ['leases', -1, 'Less lease liabilities'],
    ['minorityInterest', -1, 'Less minority interest'],
    ['surplusAssets', +1, 'Add surplus assets and investments'],
  ];
  const nd = B.bridge.netDebtAtValuationDate;
  for (const [key, sign, label] of items) {
    const bridge = { eosb: null, leases: null, minorityInterest: null, surplusAssets: null, [key]: 50 };
    const r = run({ ...BASE, bridge });
    check(`${key}: enterprise value unchanged`, r.ev.every((v, i) => v === B.ev[i]));
    check(`${key}: equity at low, mid and high moves by ${sign * 50}`, r.equity.every((v, i) => close(v, B.ev[i] - nd + sign * 50)), `${r.equity}`);
    near(`${key}: other claims`, r.bridge.otherClaims, -sign * 50);
    const row = format.bridgeTable(r).rows.find((x) => x.label === label);
    check(`${key}: bridge table row "${label}"`, Boolean(row));
    const steps = format.bridgeSteps(r);
    near(`${key}: waterfall steps add up to equity`, steps.slice(0, -1).reduce((a, s) => a + s.value, 0), steps.at(-1).value);
    const g = r.sensitivity.grid[2][2], g0 = B.sensitivity.grid[2][2];
    near(`${key}: sensitivity centre moves by the same amount`, g, g0 + sign * 50);
    const errs = engine.validateCompany({ ...BASE, bridge: { ...bridge, [key]: -1 } });
    check(`${key}: a negative amount refused`, errs[key] === 'Enter a positive amount, or leave blank.');
  }
}

console.log('5. Stake');
{
  const stake = (p, adjustment, cp = 25, md = 20) => ({ percent: p, adjustment, controlPremium: cp, minorityDiscount: md });
  const plain = run({ ...BASE, stake: stake(40, 'none') });
  check('40%: value is 40% of equity', plain.stake.used && plain.stake.value.every((v, i) => close(v, B.equityDisplay[i] * 0.4)));
  const prem = run({ ...BASE, stake: stake(40, 'control_premium') });
  check('40% with a 25% control premium', prem.stake.value.every((v, i) => close(v, B.equityDisplay[i] * 0.4 * 1.25)) && prem.stake.adjustmentRate === 0.25);
  const minor = run({ ...BASE, stake: stake(15, 'minority_discount') });
  check('15% with a 20% minority discount', minor.stake.value.every((v, i) => close(v, B.equityDisplay[i] * 0.15 * 0.8)) && minor.stake.adjustmentRate === -0.2);
  const whole = run({ ...BASE, stake: stake(100, 'control_premium', 10) });
  check('100% with a premium is still shown', whole.stake.used && close(whole.stake.value[1], B.equityDisplay[1] * 1.1));
  check('stake does not change equity itself', prem.equity.every((v, i) => v === B.equity[i]));
  check('headline stake label', format.headline(prem).stakeLabel === '40% stake with a 25% control premium', format.headline(prem).stakeLabel);
  check('minority label', format.stakeLabel(minor) === '15% stake with a 20% minority discount', format.stakeLabel(minor));

  const wacc = B.wacc.wacc;
  const v = (s) => engine.validateTerminal({ ...BASE, stake: s }, wacc);
  check('0% refused', v(stake(0, 'none')) === 'Enter a stake between 0% and 100%.');
  check('101% refused', v(stake(101, 'none')) === 'Enter a stake between 0% and 100%.');
  check('premium of 150% refused', v(stake(50, 'control_premium', 150)) === 'Enter a control premium between 0% and 100%.');
  check('discount of 100% refused', v(stake(50, 'minority_discount', 25, 100)) === 'Enter a minority discount between 0% and 99%.');
  check('0.5% accepted', v(stake(0.5, 'minority_discount')) === null);
}

console.log('6. Exit multiple discount and the peer default');
{
  const noDisc = run({ ...BASE, privateDiscount: 0 });
  check('no discount: exit multiple applied is exactly as entered', noDisc.exitMultipleApplied === noDisc.exitMultiple);
  const d25 = run({ ...BASE, privateDiscount: 25 });
  near('25% discount: applied multiple is 75% of entered', d25.exitMultipleApplied, BASE.exitMultiple * 0.75);
  const typedLower = run({ ...BASE, privateDiscount: 0, exitMultiple: BASE.exitMultiple * 0.75 });
  near('discounted DCF equals the DCF at the lower multiple typed in', d25.base.evX, typedLower.base.evX);
  near('discounted flexed exit range too', d25.hiX, typedLower.hiX);
  check('growth method unaffected by the discount', d25.base.evG === noDisc.base.evG);
  check('discount lowers comparables', d25.compRange[1] < noDisc.compRange[1]);
  const exitSub = format.footballFieldRows(d25).find((r) => r.key === 'dcf_exit').sub;
  check('football field names the multiple after the discount', exitSub.includes(format.fmtMultiple(d25.exitMultipleApplied)), exitSub);

  let s = state.initialState();
  s = state.applyIndustryDefaults({ ...s, industry: 'Food Processing' });
  check('no peers: discount default 0', s.privateDiscount === '0' && engine.defaultPrivateDiscount([]) === 0);
  s = state.syncPeerDefaults({ ...s, peers: [state.newPeer('One', '8', '1')] });
  check('one peer: still 0', s.privateDiscount === '0');
  s = state.syncPeerDefaults({ ...s, peers: [state.newPeer('One', '8', '1'), state.newPeer('Two', '10', '1.4')] });
  check('two peers: 20 automatically', s.privateDiscount === String(data.ASSUMPTIONS.privateDiscountWithPeers) && s.privateDiscount === '20');
  s = state.syncPeerDefaults({ ...s, peers: [] });
  check('peers removed: back to 0', s.privateDiscount === '0');
  s = { ...s, privateDiscount: '12', discountTouched: true };
  s = state.syncPeerDefaults({ ...s, peers: [state.newPeer('One', '8', '1'), state.newPeer('Two', '10', '1.4')] });
  check('a typed discount survives adding peers', s.privateDiscount === '12');
  check('the reference example starts at 20 with its two peers', minimalCase(state).privateDiscount === '20');
  check('discount of 100 refused', engine.validateTerminal({ ...BASE, privateDiscount: 100 }, B.wacc.wacc) === 'Enter a private company discount between 0% and 99%.');
}

console.log('7. Warnings');
{
  const has = (r, code) => codes(r).includes(code);
  const R = data.WARNING_RULES;

  // Terminal value share. Growth moves the share; search both sides of 75%.
  {
    const hi = run({ ...BASE, growth: 7 });
    const lo = run({ ...BASE, growth: 0, waccAdjustment: 3 });
    check('TV share: case above 75% is above', hi.tvShare > R.terminalValueShare, hi.tvShare);
    check('TV share: triggers above 75%', has(hi, 'tv_share'));
    check('TV share: case below is below', lo.tvShare <= R.terminalValueShare, lo.tvShare);
    check('TV share: silent below', !has(lo, 'tv_share'));
    check('TV share: marked strong above 85%', (checkOf(hi, 'tv_share').strong === hi.tvShare > R.terminalValueShareStrong) && R.terminalValueShareStrong === 0.85);
  }
  // Growth ceiling, Saudi 4.0 and Pakistan 9.0.
  {
    check('ceilings as stated', data.COUNTRIES['Saudi Arabia'].growthCeiling === 4 && data.COUNTRIES.Pakistan.growthCeiling === 9);
    const over = run({ ...BASE, growth: 4.5 });
    const at = run({ ...BASE, growth: 4.0 });
    check('growth ceiling: 4.5% in SAR triggers', has(over, 'growth_ceiling'));
    check('growth ceiling: exactly 4.0% in SAR is silent', !has(at, 'growth_ceiling'));
    const pk = state.toInputs(fullFeatureCase(state), VALUATION_DATE);
    check('growth ceiling: 9.5% in PKR triggers', has(run({ ...pk, growth: 9.5 }), 'growth_ceiling'));
    check('growth ceiling: 9.0% in PKR is silent', !has(run({ ...pk, growth: 9.0 }), 'growth_ceiling'));
  }
  // Exit multiple against the implied multiple.
  {
    const probe = run({ ...BASE, privateDiscount: 0 });
    const implied = probe.impliedExitMultiple;
    const aligned = run({ ...BASE, privateDiscount: 0, exitMultiple: implied });
    const far = run({ ...BASE, privateDiscount: 0, exitMultiple: implied * 1.5 });
    const edge = run({ ...BASE, privateDiscount: 0, exitMultiple: implied / 1.24 });
    const over = run({ ...BASE, privateDiscount: 0, exitMultiple: implied / 1.26 });
    check('terminal gap: implied multiple does not depend on the exit multiple', close(aligned.impliedExitMultiple, implied) && close(far.impliedExitMultiple, implied));
    check('terminal gap: equal multiples silent', !has(aligned, 'terminal_gap'));
    check('terminal gap: 50% apart triggers', has(far, 'terminal_gap'));
    check('terminal gap: 24% apart silent', !has(edge, 'terminal_gap'));
    check('terminal gap: 26% apart triggers', has(over, 'terminal_gap') && R.terminalGap === 0.25);
    const withDisc = run({ ...BASE, privateDiscount: 40, exitMultiple: implied });
    check('terminal gap: measured on the multiple after the discount', has(withDisc, 'terminal_gap') && close(checkOf(withDisc, 'terminal_gap').values.exit, implied * 0.6));
  }
  // Negative terminal free cash flow.
  {
    const fin = clone(BASE.financials);
    fin.capex[7] = fin.rev[7] * 3;
    const neg = run({ ...BASE, financials: fin });
    check('negative terminal FCF: the normalised terminal cash flow is negative', neg.terminal.fcf < 0, neg.terminal.fcf);
    check('negative terminal FCF: triggers', has(neg, 'terminal_fcf'));
    check('negative terminal FCF: base positive and silent', B.terminal.fcf > 0 && !has(B, 'terminal_fcf'));
  }
  // Margin jump into the first forecast year.
  {
    const ltmMargin = B.ltmEbitda / B.ltmRevenue;
    const withMargin = (pts) => {
      const fin = clone(BASE.financials);
      fin.ebitda[3] = fin.rev[3] * (ltmMargin + pts / 100);
      return run({ ...BASE, financials: fin });
    };
    check('year one margin: +1.6 points triggers', has(withMargin(1.6), 'margin_step'));
    check('year one margin: +1.4 points silent', !has(withMargin(1.4), 'margin_step'));
    check('year one margin: a step down is not a step up, silent', !has(withMargin(-11), 'margin_step'));
    const norm = run({ ...BASE, normalisation: { oneOff: -B.ltmRevenue * 0.03, ownerCosts: null, carryOwnerCosts: false } });
    check('year one margin: measured from normalised EBITDA', has(norm, 'margin_step') && !has(B, 'margin_step'));
  }
  // ROIC against WACC. At 0% GCC ownership, since entering invested capital
  // switches a GCC-owned business to the zakat base method and so moves tax.
  const CIT = { ...BASE, gccOwnership: 0 };
  const C0 = run(CIT);
  {
    const nopat = (C0.ltmEbitda - BASE.financials.da[2]) * (1 - C0.wacc.t);
    const lowIc = nopat / (C0.wacc.wacc + 0.05);
    const highIc = nopat / (C0.wacc.wacc - 0.03);
    const good = run({ ...CIT, investedCapital: lowIc });
    const poor = run({ ...CIT, investedCapital: highIc });
    near('ROIC: computed as after-tax EBIT over invested capital', good.ratios.roic, C0.wacc.wacc + 0.05);
    check('ROIC: above WACC silent', !has(good, 'roic_below_wacc'));
    check('ROIC: below WACC triggers', has(poor, 'roic_below_wacc'));
    check('ROIC: without invested capital, no ROIC and no ROIC checks listed', !Number.isFinite(B.ratios.roic) && !checkOf(B, 'roic_below_wacc') && !checkOf(B, 'reinvestment'));
    check('invested capital of zero refused', engine.validateFinancials(BASE.financials, { investedCapital: 0 }) === 'Enter invested capital above zero, or leave it blank.');
  }
  // Reinvestment against growth.
  {
    const nopat = (C0.ltmEbitda - BASE.financials.da[2]) * (1 - C0.wacc.t);
    const rr = C0.ratios.reinvestmentRate;
    check('reinvestment: base reinvests a positive share', rr > 0, rr);
    const icFor = (impliedGrowth) => nopat / (impliedGrowth / rr);
    const g = C0.growth;
    const consistent = run({ ...CIT, investedCapital: icFor(g + 0.01) });
    const inconsistent = run({ ...CIT, investedCapital: icFor(g + 0.05) });
    near('reinvestment: implied growth is reinvestment rate times ROIC', consistent.ratios.impliedGrowthFromReinvestment, g + 0.01, 1e-6);
    check('reinvestment: 1 point apart silent', !has(consistent, 'reinvestment'));
    check('reinvestment: 5 points apart triggers', has(inconsistent, 'reinvestment'));
  }
  // Every code has text.
  {
    // Stored version 2 leads still carry these codes; their wording must survive.
    const all = ['terminal_value_share', 'growth_ceiling', 'exit_multiple_mismatch', 'terminal_fcf_negative', 'margin_jump', 'roic_below_wacc', 'reinvestment_inconsistent'];
    for (const code of all) {
      const t = format.warningText({ code, values: { share: 0.8, threshold: 0.3, growth: 0.05, ceiling: 0.04, applied: 8, implied: 12, fcf: -5, from: 0.1, to: 0.25, roic: 0.06, wacc: 0.1, reinvestmentRate: 0.4, implied2: 0 } }, B);
      check(`${code}: has a title and detail`, Boolean(t.title && t.detail && !/NaN|undefined/.test(t.title + t.detail)), t.detail);
    }
  }
}

console.log('8. Pakistan with every feature');
{
  const s = fullFeatureCase(state);
  const i = state.toInputs(s, VALUATION_DATE);
  const r = tryRun('full feature case', i);
  if (r) {
    check('currency PKR, not pegged', r.currency.code === 'PKR' && !r.currency.pegged);
    check('discount defaulted to 20 from two peers', s.privateDiscount === '20' && r.privateDiscount === 0.2);
    near('exit multiple applied after the discount', r.exitMultipleApplied, i.exitMultiple * 0.8);
    near('normalised LTM EBITDA', r.ltmEbitda, 1720 + 85 + 40);
    check('owner costs carried into the forecast', r.rows.every((row, k) => close(row.ebitda, i.financials.ebitda[3 + k] + 40)));
    near('other claims 160 + 220 + 75 - 300', r.bridge.otherClaims, 155);
    check('equity is EV less net debt at the valuation date less claims', r.equity.every((v, k) => close(v, r.ev[k] - (1200 - r.rows[0].fcf * r.meta.stubFraction + 1200 * r.wacc.kd * (1 - r.wacc.t) * r.meta.stubFraction) - 155)));
    check('stake 40% with a 20% minority discount', r.stake.value.every((v, k) => close(v, r.equityDisplay[k] * 0.4 * 0.8)));
    check('the full example raises no stake warning', !codes(r).includes('stake_premium'));
    check('scenario weights 30/50/20', r.scenarios.map((x) => x.weight).join() === '0.3,0.5,0.2');
    near('weighted value', r.weightedEquity, Math.max(0, 0.3 * r.scenarios[0].equity[1] + 0.5 * r.scenarios[1].equity[1] + 0.2 * r.scenarios[2].equity[1]));
    check('ROIC computed from invested capital', Number.isFinite(r.ratios.roic));
    check('WACC includes inflation conversion', r.wacc.wacc > r.wacc.waccUsd);
    const texts = [
      ...format.executiveSummary(r),
      ...format.valueLevers(r).flatMap((l) => [l.title, l.detail]),
      ...format.warningTexts(r).flatMap((w) => [w.title, w.detail]),
      ...[format.scenariosTable(r), format.keyRatiosTable(r), format.bridgeTable(r), format.fcfTable(r), format.sensitivityTable(r)].flatMap((t) => [...t.head, ...t.rows.flatMap((x) => [x.label, ...x.values])]),
      ...format.footballFieldRows(r).flatMap((x) => [x.label, x.sub]),
      ...format.waccBuildRows(r).flat(),
      ...format.terminalRows(r).flat(),
      ...format.normalisationRows(r).flat(),
      ...Object.values(format.headline(r)).filter((x) => typeof x === 'string'),
    ];
    const bad = texts.filter((t) => /NaN|undefined|Infinity/.test(String(t)));
    check('every formatted string free of NaN, undefined and Infinity', bad.length === 0, bad.slice(0, 3).join(' | '));
    check('headline carries weighted and stake values', Boolean(format.headline(r).weighted && format.headline(r).stakeRange));
    check('the executive summary mentions the stake', format.executiveSummary(r).some((p) => p.includes('40%')));
    const round = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(r))));
    check('stored and revived result formats identically', JSON.stringify(format.headline(round)) === JSON.stringify(format.headline(r)) && JSON.stringify(format.scenariosTable(round)) === JSON.stringify(format.scenariosTable(r)));
    const back = state.toInputs(state.stateFromInputs(i), VALUATION_DATE);
    const r2 = run(back);
    check('inputs survive the form round trip', r2.equity.every((v, k) => close(v, r.equity[k])) && close(r2.weightedEquity, r.weightedEquity));
  }
}

console.log('10. Lever, stake rule and inflation band');
{
  // The lever reads the table: centre cell and one point lower WACC, same growth.
  for (const [label, inputs] of [['minimal', BASE], ['full', state.toInputs(fullFeatureCase(state), VALUATION_DATE)]]) {
    const r = run(inputs);
    const lever = format.waccLeverFromSensitivity(r);
    const s = r.sensitivity;
    const wi = s.waccs.findIndex((w) => close(w, r.wacc.wacc)), wl = s.waccs.findIndex((w) => close(w, r.wacc.wacc - 0.01));
    const gi = s.growths.findIndex((g) => close(g, r.growth));
    check(`${label}: lever uses the table's centre and one point lower WACC at the same growth`, lever && lever.from === s.grid[wi][gi] && lever.to === s.grid[wl][gi], JSON.stringify(lever));
    check(`${label}: lever is not the old flexed figure (which also moved growth)`, lever && !close(lever.uplift, r.hiG - r.base.evG));
    const table = format.sensitivityTable(r);
    const material = lever.uplift / lever.from > data.RECOMMENDATION_RULES.waccSensitivityMaterial;
    check(`${label}: the cost of capital point is chosen exactly when a point of WACC moves equity by more than 10%`, r.recommendations.some((x) => x.id === 'reduce_risk') === material, `share ${lever.uplift / lever.from}`);
    if (material) {
      const leverText = format.valueLevers(r).find((l) => l.title === 'Reduce the risk a buyer prices in')?.detail ?? '';
      check(`${label}: lever text quotes the two table cells exactly as printed`, leverText.includes(table.rows[wi].values[gi]) && leverText.includes(table.rows[wl].values[gi]), leverText);
    }
    // An independent recomputation of the cell: equity at WACC minus one point, same growth.
    const alt = run({ ...inputs, waccAdjustment: (inputs.waccAdjustment ?? 0) - 1 });
    check(`${label}: the lower cell equals a full run at one point lower WACC`, close(lever.to, alt.base.evG - alt.bridge.netDebtAtValuationDate - alt.bridge.otherClaims, 1e-9), `${lever.to} vs ${alt.base.evG - alt.bridge.netDebtAtValuationDate - alt.bridge.otherClaims}`);
  }

  // Stake: a premium on 50% or less warns; above 50% it does not; a discount never does.
  const stake = (percent, adjustment) => ({ ...BASE, stake: { percent, adjustment, controlPremium: 25, minorityDiscount: 20 } });
  check('40% with a control premium warns', codes(run(stake(40, 'control_premium'))).includes('stake_premium'));
  check('exactly 50% with a control premium warns', codes(run(stake(50, 'control_premium'))).includes('stake_premium'));
  check('51% with a control premium is silent', !codes(run(stake(51, 'control_premium'))).includes('stake_premium'));
  check('40% with a minority discount is not tested, so not listed', !checkOf(run(stake(40, 'minority_discount')), 'stake_premium'));
  check('the premium is still applied as chosen', close(run(stake(40, 'control_premium')).stake.value[1], B.equityDisplay[1] * 0.4 * 1.25));

  // The form: the adjustment follows the stake until chosen.
  let st = minimalCase(state);
  const setStake = (s0, p) => state.syncStakeAdjustment({ ...s0, stake: { ...s0.stake, ...p }, stakeAdjustmentTouched: s0.stakeAdjustmentTouched || 'adjustment' in p });
  check('form: 100% starts with no adjustment', st.stake.adjustment === 'none' && !st.stakeAdjustmentTouched);
  st = setStake(st, { percent: '40' });
  check('form: 40% defaults to a minority discount', st.stake.adjustment === 'minority_discount');
  st = setStake(st, { percent: '50' });
  check('form: 50% is still a minority discount', st.stake.adjustment === 'minority_discount');
  st = setStake(st, { percent: '60' });
  check('form: 60% returns to no adjustment', st.stake.adjustment === 'none');
  st = setStake(st, { percent: '30' });
  st = setStake(st, { adjustment: 'control_premium' });
  check('form: a premium chosen at 30% is kept, not overridden', st.stake.adjustment === 'control_premium' && st.stakeAdjustmentTouched);
  st = setStake(st, { percent: '20' });
  check('form: once chosen, changing the stake keeps the choice', st.stake.adjustment === 'control_premium');
  check('form: stored inputs restore as chosen', state.stateFromInputs(state.toInputs(st, VALUATION_DATE)).stakeAdjustmentTouched === true);

  // Inflation band. SAR is pegged: US long-run inflation 2.5, so 1.5 to 4.5 is silent.
  const has = (r, code) => codes(r).includes(code);
  check('pegged currencies use long-run US inflation', data.MARKET.usInflationLongRun === 2.5 && data.WARNING_RULES.inflationBelowPoints === 1 && data.WARNING_RULES.inflationAbovePoints === 2);
  check('SAR growth 1.4% warns (below inflation less one point)', has(run({ ...BASE, growth: 1.4 }), 'growth_vs_inflation'));
  check('SAR growth 1.5% is silent (at the lower edge)', !has(run({ ...BASE, growth: 1.5 }), 'growth_vs_inflation'));
  check('SAR growth 4.5% is silent (at the upper edge)', !has(run({ ...BASE, growth: 4.5 }), 'growth_vs_inflation'));
  check('SAR growth 4.6% warns (above inflation plus two points)', has(run({ ...BASE, growth: 4.6 }), 'growth_vs_inflation'));
  check('the reference example still warns on exactly the expected checks', codes(B).join() === BASE_WARNINGS, codes(B).join());
  const pk = state.toInputs(fullFeatureCase(state), VALUATION_DATE);
  const pkInfl = pk.wacc.inflationLocal;
  check('PKR uses the local inflation entered', pkInfl === 7);
  check('PKR growth 5.9% warns', has(run({ ...pk, growth: 5.9 }), 'growth_vs_inflation'));
  check('PKR growth 6.0% is silent', !has(run({ ...pk, growth: 6.0 }), 'growth_vs_inflation'));
  check('PKR growth 9.0% is silent', !has(run({ ...pk, growth: 9.0 }), 'growth_vs_inflation'));
  check('PKR growth 9.1% warns', has(run({ ...pk, growth: 9.1 }), 'growth_vs_inflation'));
  check('PKR with 10% local inflation, growth 6.0% now warns', has(run({ ...pk, growth: 6.0, wacc: { ...pk.wacc, inflationLocal: 10 } }), 'growth_vs_inflation'));
  const low = checkOf(run({ ...BASE, growth: 1 }), 'growth_vs_inflation');
  check('inflation warning carries growth, inflation and both edges', low && close(low.values.inflation, 0.025) && close(low.values.low, 0.015) && close(low.values.high, 0.045));
  for (const [code, values] of [['growth_vs_inflation', { growth: 0.01, inflation: 0.025, low: 0.015, high: 0.045 }], ['growth_vs_inflation', { growth: 0.05, inflation: 0.025, low: 0.015, high: 0.045 }], ['premium_on_minority_stake', { percent: 40, threshold: 50, premium: 0.25 }]]) {
    const t = format.warningText({ code, values }, B);
    check(`${code}: has a title and detail`, Boolean(t && t.title && t.detail && !/NaN|undefined/.test(t.title + t.detail)), t?.detail);
  }
}

console.log('9. Schema version and WACC adjustment');
{
  check('schema version is 4', engine.INPUT_SCHEMA_VERSION === 4 && B.schemaVersion === 4 && BASE.schemaVersion === 4);
  const w0 = engine.computeWacc(BASE.wacc, B.currency, 0).wacc;
  const w1 = engine.computeWacc(BASE.wacc, B.currency, 1.5).wacc;
  near('adjustment of 1.5 points adds 0.015', w1, w0 + 0.015);
  const adj = run({ ...BASE, waccAdjustment: 1 });
  check('a higher WACC lowers the DCF', adj.dcfRange[1] < B.dcfRange[1]);
  check('growth must stay 1 point below the adjusted WACC', engine.validateTerminal({ ...BASE, growth: (w0 - 0.035) * 100 }, w0 - 0.03) !== null);
}

console.log('11. Version 3');
{
  const fin = BASE.financials;
  // The old report's inputs, including its 4.23% January 2026 ERP, so the
  // before and after comparison is like for like after the September ERP.
  // Version 3 inputs: net debt entered as one figure (45), cash for the zakat base only.
  const REG = { ...BASE, schemaVersion: 3, debt: undefined, cash: undefined, netDebt: 45, gccOwnership: 0, valuationDate: null, wacc: { ...BASE.wacc, erp: 4.23 } };
  check('the form now prefills the 1 September 2026 ERP of 4.14%', BASE.wacc.erp === 4.14 && data.MARKET.matureErp === 4.14);
  const reg = run(REG);
  const T = 7, P = 6;

  // Terminal cash flow, by hand, on the old report's inputs (20% tax, no stub).
  {
    const g = 0.025, t = 0.2;
    const ebit = fin.ebitda[T] - fin.da[T];
    const growthT = fin.rev[T] / fin.rev[P] - 1;
    const netCapexT = fin.capex[T] - fin.da[T];
    const netCapex = growthT > g ? netCapexT * (g / growthT) : netCapexT * (1 + g);
    const dWc = (fin.nwc[T] / fin.rev[T]) * fin.rev[T] * g;
    const fcf = Math.max(ebit, 0) * (1 + g) * (1 - t) - netCapex - dWc;
    near('terminal FCF matches the formula', reg.terminal.fcf, fcf);
    check('terminal FCF is about 45.7 (was about 35.2)', Math.abs(reg.terminal.fcf - 45.7) < 0.05, reg.terminal.fcf);
    const tv = fcf / (reg.wacc.wacc - g);
    near('perpetuity TV is FCF over WACC less g', reg.terminal.tvPerpetuity, tv);
    near('implied terminal multiple is TV over final year EBITDA', reg.terminal.impliedMultiple, tv / fin.ebitda[T]);
    const nopatTv = Math.max(ebit, 0) * (1 + g) * (1 - t);
    near('terminal reinvestment rate is net capex plus working capital over NOPAT', reg.terminal.reinvestmentRate, (netCapex + dWc) / nopatTv);
    near('implied terminal ROIC is g over the reinvestment rate', reg.terminal.impliedRoic, g / ((netCapex + dWc) / nopatTv));
    check('terminal returns check: silent when the implied ROIC is above WACC', reg.terminal.impliedRoic > reg.wacc.wacc && checkOf(reg, 'terminal_roic')?.status === 'pass');
    {
      // Lift final year reinvestment until the implied return falls below WACC.
      const heavy = clone(fin);
      heavy.capex[T] = heavy.da[T] + 150;
      const lowRoic = run({ ...REG, financials: heavy });
      check('terminal returns check: warns when the implied ROIC is below WACC', lowRoic.terminal.impliedRoic < lowRoic.wacc.wacc && checkOf(lowRoic, 'terminal_roic')?.status === 'warning', `${lowRoic.terminal.impliedRoic} vs ${lowRoic.wacc.wacc}`);
      check('terminal returns check: chooses the returns point', lowRoic.recommendations.some((x) => x.id === 'returns'));
      check('terminal returns check: needs no invested capital', !Number.isFinite(lowRoic.ratios.roic));
      const noReinvest = clone(fin);
      noReinvest.capex[T] = noReinvest.da[T] - 20;
      noReinvest.nwc[T] = noReinvest.nwc[P];
      const nr = run({ ...REG, financials: noReinvest });
      check('terminal returns check: not listed when reinvestment is not positive', !Number.isFinite(nr.terminal.impliedRoic) === !checkOf(nr, 'terminal_roic'));
    }
    check('terminal ROIC and reinvestment rate are on the assumptions', format.terminalRows(reg).some(([k]) => k === 'Implied terminal ROIC') && format.terminalRows(reg).some(([k]) => k === 'Terminal reinvestment rate'));
    check('implied terminal multiple is about 8.1x (was 6.2x)', format.fmtMultiple(reg.terminal.impliedMultiple) === '8.1x', reg.terminal.impliedMultiple);
    const old = engine.runValuation(REG, engine.REFERENCE_METHOD).result;
    check('the reference method keeps 35.2 and 6.2x', Math.abs(old.terminal.fcf - 35.2) < 0.05 && format.fmtMultiple(old.impliedExitMultiple) === '6.2x', `${old.terminal.fcf} ${old.impliedExitMultiple}`);
    check('the reference method keeps the old DCF mid 441.0 and sensitivity 343.9', format.fmtMillions(old.dcfRange[1]) === '441.0' && format.fmtMillions(old.sensitivity.grid[2][2]) === '343.9' && format.fmtMultiple(old.ltmMultiple) === '10.0x');
    const flat = clone(fin);
    flat.rev[T] = flat.rev[P] * 1.01;
    const f2 = run({ ...REG, financials: flat });
    const nc2 = (flat.capex[T] - flat.da[T]) * 1.025;
    near('final year growth below g: net capex grows at g instead', f2.terminal.netCapex, nc2);
    const sens = reg.sensitivity;
    near('sensitivity rows sit on the unrounded WACC, one point apart', sens.waccs[1], reg.wacc.wacc - 0.01);
    check('sensitivity centre is the perpetuity DCF base equity', sens.grid[2][2] === reg.dcfBlock.perpetuityEquityBase && sens.waccs[2] === reg.wacc.wacc);
    near('combined DCF is the average of the two methods', reg.dcfBlock.combined[1], (reg.dcfBlock.perpetuity[1] + reg.dcfBlock.exit[1]) / 2);
    near('implied EV / LTM EBITDA is blended base EV over last actual EBITDA', reg.ltmMultiple, reg.ev[1] / fin.ebitda[2]);
  }

  // Stub period.
  {
    const r = run({ ...REG, valuationDate: '2026-09-16' });
    const f = (8 + 16 / 30) / 12;
    near('stub fraction from 31 December 2025 to 16 September 2026', r.meta.stubFraction, f);
    const w = r.wacc.wacc;
    const periods = [(1 - f) / 2, 1.5 - f, 2.5 - f, 3.5 - f, 4.5 - f];
    check('discount periods: (1 - f) / 2, then (i - 0.5) - f', r.forecast.every((x, k) => close(x.period, periods[k])));
    near('terminal value discounted at N - f', r.terminal.period, 5 - f);
    near('year one cash flow cut to (1 - f)', r.forecast[0].fcfValued, r.rows[0].fcf * (1 - f));
    const pv = r.forecast.reduce((a, x, k) => a + (k === 0 ? x.fcf * (1 - f) : x.fcf) / Math.pow(1 + w, periods[k]), 0);
    near('perpetuity DCF rebuilt by hand', r.dcfBlock.perpetuity[1], pv + r.terminal.tvPerpetuity / Math.pow(1 + w, 5 - f));
    const eoy = run({ ...REG, valuationDate: '2026-09-16', midYear: false });
    check('end of year convention: 1 - f, then i - f', close(eoy.forecast[0].period, 1 - f) && close(eoy.forecast[3].period, 4 - f));
    const old = engine.validateCompany({ ...REG, financialYear: 2024, valuationDate: '2026-09-16' });
    check('a last actual year over 12 months old is refused with the set message', old.financialYear === 'Your latest actual year is more than 12 months old. Please enter the latest full year as actuals.', old.financialYear);
    check('refused by runValuation at step 1', engine.runValuation({ ...REG, financialYear: 2024, valuationDate: '2026-09-16' }).ok === false);
    check('exactly 12 months is refused', Boolean(engine.validateCompany({ ...REG, valuationDate: '2026-12-31' }).financialYear));
    check('a day short of 12 months runs', !engine.validateCompany({ ...REG, valuationDate: '2026-12-30' }).financialYear);
    const kd = 0.0477 + 0.0051 + 0.02; // risk-free, country default spread, company credit spread
    near('the interest rate is the pre-tax cost of debt from the WACC build', r.wacc.kd, kd);
    const interest = 45 * kd * (1 - 0.2) * f;
    near('after-tax interest on net debt for the elapsed period', r.bridge.elapsedInterest, interest);
    near('net debt at the valuation date is year end net debt less the elapsed cash flow plus after-tax interest', r.bridge.netDebtAtValuationDate, 45 - r.rows[0].fcf * f + interest);
    const cashCo = run({ ...REG, valuationDate: '2026-09-16', netDebt: -30 });
    check('net cash accrues no interest', cashCo.bridge.elapsedInterest === 0 && close(cashCo.bridge.netDebtAtValuationDate, -30 - cashCo.rows[0].fcf * f));
    check('the elapsed period is disclosed as forecast cash flow', format.disclosures(r).valuationDate.includes('uses forecast free cash flow, not actual results') && format.disclosures(r).valuationDate.includes('after-tax interest'));
    check('elapsed cash flow is exactly the part of year one not valued in the DCF', close(r.bridge.elapsedFcf + r.forecast[0].fcfValued, r.rows[0].fcf));
    near('equity is EV less net debt at the valuation date', r.equity[1], r.ev[1] - (45 - r.rows[0].fcf * f + interest));
    check('no stub: net debt is the entered figure exactly', reg.bridge.netDebtAtValuationDate === 45 && reg.bridge.elapsedFcf === 0);
    check('the financial year end disclosure is always present', format.disclosures(r).financialYearEnd === 'Financial years are assumed to end on 31 December.' && format.disclosures(reg).financialYearEnd.length > 0);
    check('a year still running takes no stub', run({ ...REG, financialYear: 2026, valuationDate: '2026-09-16' }).meta.stubFraction === 0);
    check('the headline reads as at the valuation date', format.headline(r).asAt === 'as at 16 September 2026' && format.headline(r).netDebtNote === 'Net debt at 31 December 2025, as entered, less free cash flow earned from then to 16 September 2026, plus after-tax interest on it for that period, gives net debt at the valuation date.');
  }

  // Tax and zakat.
  {
    const at = (gcc) => run({ ...REG, gccOwnership: gcc });
    near('0% GCC ownership: corporate tax', at(0).wacc.t, 0.2);
    near('100% GCC ownership: no income tax, zakat on the base', at(100).wacc.t, 0);
    near('50% GCC ownership: income tax on the non-GCC half only', at(50).wacc.t, 0.5 * 0.2);
    const z = at(100);
    check('the income tax rate reaches FCFF, terminal NOPAT and after-tax cost of debt', close(z.rows[2].incomeTax, 0) && close(z.terminal.tax, z.terminal.zakat) && close(z.wacc.kdt, z.wacc.kd));
    check('the tax row says tax and zakat', format.taxRowLabel(z) === 'Less tax and zakat' && format.taxRowLabel(at(0)) === 'Less tax at 20.0%');

    // The zakat base, by hand: working capital plus cash, floored at zero, cash
    // held at its year end level.
    for (const [gccPct, cash] of [[100, 30], [100, null], [40, 12], [100, 0]]) {
      const zb = run({ ...REG, gccOwnership: gccPct, cash });
      const share = gccPct / 100;
      const tag = `zakat base (${gccPct}%, cash ${cash ?? 'blank'})`;
      check(`${tag}: method is the base`, zb.tax.zakatMethod === 'base');
      near(`${tag}: income tax on the non-GCC share only`, zb.wacc.t, (1 - share) * 0.2);
      const want = [3, 4, 5, 6, 7].map((i) => Math.max(0, fin.nwc[i] + (cash ?? 0)) * share * 0.025);
      check(`${tag}: zakat each year is 2.5% of working capital plus cash on the GCC share`, zb.rows.every((row, k) => close(row.zakat, want[k])), JSON.stringify(zb.rows.map((x) => x.zakat)) + ' vs ' + JSON.stringify(want));
      check(`${tag}: tax row is income tax plus zakat`, zb.rows.every((row) => close(row.tax, Math.max(0, row.ebit) * (1 - share) * 0.2 + row.zakat)));
      const ltm = zb.tax.zakatBaseLtm;
      check(`${tag}: the last actual base is shown with its parts`, close(ltm.workingCapital, fin.nwc[2]) && ltm.cash === cash && close(ltm.base, Math.max(0, fin.nwc[2] + (cash ?? 0))));
      near(`${tag}: terminal zakat is the final base grown at g`, zb.terminal.zakat, zb.rows[4].zakatBase * 1.025 * share * 0.025);
      const rows = format.taxRows(zb);
      check(`${tag}: assumptions show working capital, cash, the base and the amounts`, rows.some(([k]) => k === 'Zakat base (approximate)') && rows.some(([k, v]) => k === 'Add cash, year end' && (cash === null ? v === 'Not entered' : v !== 'Not entered')) && rows.some(([k]) => k === 'Zakat, FY2026 to FY2030'));
      check(`${tag}: the missing cash disclosure appears only when cash is blank`, format.disclosures(zb).zakat.includes('Cash was not entered') === (cash === null));
      check(`${tag}: reconciles`, reconcileModule.reconcile({ ...zb }).length === 0);
    }
    const negBase = clone(fin);
    negBase.nwc = negBase.nwc.map(() => -40);
    check('a negative working capital base floors at zero', run({ ...REG, financials: negBase, gccOwnership: 100, cash: 10 }).rows.every((row) => row.zakat === 0));
    check('zakat is charged in a loss year', (() => { const lf = clone(fin); lf.ebitda[3] = -20; const r0 = run({ ...REG, financials: lf, gccOwnership: 100, cash: 5 }); return r0.rows[0].incomeTax === 0 && r0.rows[0].zakat > 0; })());
    check('cash changes nothing but zakat', (() => { const a = run({ ...REG, gccOwnership: 0, cash: 500 }); return a.equity.every((v, k) => v === reg.equity[k]); })());
    check('negative cash is refused', engine.validateCompany({ ...REG, cash: -1 }).cash === 'Enter cash as a positive amount, or leave it blank.');
    check('Saudi / GCC ownership is required from version 3, with no default', engine.validateCompany({ ...REG, gccOwnership: undefined }).gccOwnership === engine.GCC_REQUIRED_MESSAGE && engine.validateCompany({ ...REG, gccOwnership: null }).gccOwnership === engine.GCC_REQUIRED_MESSAGE);
    check('form: a new form leaves ownership blank; the example company fills it', state.initialState().gccOwnership === '' && state.exampleState().gccOwnership === '100');
    check('not required outside Saudi Arabia', !engine.validateCompany({ ...REG, country: 'Qatar', gccOwnership: null }).gccOwnership);
    check('stored inputs before version 3 mean corporate tax', close(run({ ...REG, gccOwnership: undefined, schemaVersion: 2 }).wacc.t, 0.2));
    const uae = run({ ...state.toInputs(fullFeatureCase(state), VALUATION_DATE), country: 'United Arab Emirates', wacc: { ...BASE.wacc, tax: 9 }, gccOwnership: 100 });
    check('outside Saudi Arabia ownership is ignored and corporate tax applies', close(uae.wacc.t, 0.09) && uae.tax.zakatApplies === false);
    check('form: the ownership field is sent for Saudi Arabia only', state.toInputs({ ...minimalCase(state), country: 'Qatar' }, VALUATION_DATE).gccOwnership === null && BASE.gccOwnership === 100);
    check('an ownership share above 100% is refused', Boolean(engine.validateCompany({ ...REG, gccOwnership: 101 }).gccOwnership));
  }

  // Loss carry-forward.
  {
    const lossFin = clone(fin);
    lossFin.ebitda = [0, 3, 5, 12, 16, 28, 38, 48];
    lossFin.da = [10, 8, 8, 8, 8, 8, 8, 8];
    const t = 0.2;
    const byHand = (capPct) => {
      let pool = 0;
      for (let i = 0; i < 3; i++) {
        const e = lossFin.ebitda[i] - lossFin.da[i];
        if (e < 0) pool += -e;
        else pool -= Math.min(pool, (capPct / 100) * e);
      }
      return [3, 4, 5, 6, 7].map((i) => {
        const e = lossFin.ebitda[i] - lossFin.da[i];
        if (e < 0) {
          pool += -e;
          return 0;
        }
        const used = Math.min(pool, (capPct / 100) * e);
        pool -= used;
        return (e - used) * t;
      });
    };
    const ksa = run({ ...REG, financials: lossFin });
    const want = byHand(25);
    check('Saudi Arabia: losses from the actual years offset up to 25% of each later profit', ksa.rows.every((row, k) => close(row.tax, want[k])), JSON.stringify(ksa.rows.map((x) => x.tax)) + ' vs ' + JSON.stringify(want));
    check('losses were actually used', ksa.tax.lossesUsed > 0 && ksa.rows[0].lossUsed > 0);
    const refTax = engine.runValuation({ ...REG, financials: lossFin }, engine.REFERENCE_METHOD).result;
    check('the reference method carries nothing forward', refTax.rows.every((row) => close(row.tax, Math.max(0, row.ebit) * t)));
    check('the cap is configurable per country', data.COUNTRIES['Saudi Arabia'].lossOffsetCap === 25 && data.COUNTRIES['United Arab Emirates'].lossOffsetCap === 75 && data.COUNTRIES.Pakistan.lossOffsetCap === 100);
    check('the old footnote about losses not carried forward is gone', !format.taxNote(ksa).includes('not carried forward'));
  }

  // Pre-money and post-money.
  {
    const r = run({ ...REG, purpose: 'raise', raiseAmount: 100 });
    check('pre-money is the base equity', r.raise.preMoney.every((v, k) => v === r.equityDisplay[k]));
    check('post-money adds the raise', r.raise.postMoney.every((v, k) => close(v, r.equityDisplay[k] + 100)));
    check('investor stake is raise over post-money', r.raise.investorStake.every((v, k) => close(v, 100 / (r.equityDisplay[k] + 100))));
    check('no amount: no table, and the pre-money note', run({ ...REG, purpose: 'raise' }).raise === null && format.PRE_MONEY_NOTE === 'Values shown are pre-money.');
    check('figures are unchanged by a raise', JSON.stringify(r.equity) === JSON.stringify(reg.equity));
  }

  // Checks: all run, the regression case's statuses, and each new rule on both sides.
  {
    const ids = reg.checks.map((c) => c.id);
    check('the eight specified checks always run', ['method_divergence', 'terminal_gap', 'tv_share', 'peer_count', 'capital_structure', 'margin_step', 'no_normalisation', 'negative_ebitda'].every((id) => ids.includes(id)));
    check('regression case: divergence, peer count, capital structure and normalisation warn', ['method_divergence', 'peer_count', 'capital_structure', 'no_normalisation'].every((id) => codes(reg).includes(id)));
    check('regression case: terminal value share warns too, at 77% after the terminal fix', codes(reg).includes('tv_share') && Math.abs(reg.tvShare - 0.7735) < 0.001, reg.tvShare);
    const gap = Math.abs(reg.dcfRange[1] / reg.compRange[1] - 1);
    check('divergence measured as DCF base over comparables base', close(checkOf(reg, 'method_divergence').values.gap, gap) && checkOf(reg, 'method_divergence').message.includes(format.fmtPct(gap, 0)));
    const agree = run({ ...REG, peers: [], privateDiscount: 0, exitMultiple: 10 });
    check('divergence silent when within 20%', (Math.abs(agree.dcfRange[1] / agree.compRange[1] - 1) <= 0.2) === !codes(agree).includes('method_divergence'));
    const actualDe = reg.netDebt / reg.equity[1];
    check('capital structure measured against net debt over base equity', close(checkOf(reg, 'capital_structure').values.actual, actualDe) && Math.abs(reg.wacc.de - actualDe) * 100 > 20);
    const levered = run({ ...REG, netDebt: reg.wacc.de * (reg.ev[1] - 150) });
    check('capital structure silent when close to the target', !codes(levered).includes('capital_structure'), JSON.stringify(checkOf(levered, 'capital_structure').values));
    const threePeers = run({ ...REG, peers: [...REG.peers, { name: 'Third', evEbitda: 10, evRevenue: 1.5 }] });
    check('peer count: three peers pass', !codes(threePeers).includes('peer_count'));
    check('peer count: no peers pass on preset ranges', !codes(run({ ...REG, peers: [] })).includes('peer_count'));
    const normalised = run({ ...REG, normalisation: { oneOff: 2, ownerCosts: null, carryOwnerCosts: false } });
    check('normalisation passes once add-backs are entered', !codes(normalised).includes('no_normalisation'));
    const negFin = clone(fin);
    negFin.ebitda[2] = -3;
    check('negative last actual EBITDA warns and uses EV / Revenue', codes(run({ ...REG, financials: negFin })).includes('negative_ebitda') && run({ ...REG, financials: negFin }).comparables.basis === 'revenue');
    check('every check has a label and a message, free of NaN', reg.checks.every((c) => c.label && c.message && !/NaN|undefined|Infinity/.test(c.message)));
  }

  // Recommendations.
  {
    for (const [label, r] of [['regression', reg], ['full', run(state.toInputs(fullFeatureCase(state), VALUATION_DATE))], ['base', B]]) {
      const recs = r.recommendations.map((x) => x.id);
      check(`${label}: diligence readiness is always last`, recs.at(-1) === 'diligence');
      check(`${label}: at most five`, recs.length <= 5 && recs.length >= 1);
      check(`${label}: no normalisation means the normalisation point is chosen`, codes(r).includes('no_normalisation') === recs.includes('review_normalisation'));
      const conv = r.ratios.fcfConversion;
      check(`${label}: cash conversion chosen exactly below 60%`, recs.includes('cash_conversion') === (conv < 0.6), conv);
      const text = format.valueLevers(r).map((l) => `${l.title} ${l.detail}`).join(' ');
      check(`${label}: no promise of a higher value`, !/will (increase|raise|lift)|increase your value|raises the/i.test(text), text.slice(0, 200));
    }
    check('the heading is the new wording', format.LABELS.factors === 'Factors that could support a higher valuation');
  }

  // Market data.
  {
    const m = data.marketDataInUse();
    check('the September ERP is used, aligned with the Treasury month', m.aligned === true && m.erp.asOf === '2026-09-01' && m.erp.value === 4.14 && m.treasury.asOf === '2026-09-15');
    check('the data version and its label moved with the ERP', data.VALUATION_DATA_VERSION === '2026-09-17' && data.dataVersionLabel('2026-09-17').includes('September 2026') && data.dataVersionLabel('2026-09-16') === 'Damodaran January 2026, risk-free September 2026');
    const rf = data.SOURCE_NOTES.find((n) => n.label === 'Risk-free rate');
    check('the risk-free source prints the yield to two decimals and its exact date', rf.source.includes('5.00%') && rf.asOf === '15 September 2026' && !JSON.stringify(data.SOURCE_NOTES).includes('about 5.0%'));
    check('the market data line prints both exact dates', format.marketDataLine(reg).includes('15 September 2026') && format.marketDataLine(reg).includes('4.14% (1 September 2026)'));
    const erpNote = data.SOURCE_NOTES.find((x) => x.label === 'Mature market implied equity risk premium');
    check('the ERP source names the figure, its basis and its date', erpNote.source.includes('4.14%') && erpNote.source.includes('adjusted payout') && erpNote.asOf === '1 September 2026');
  }

  // Reconciliation assertions.
  {
    const distressed = (() => {
      let s0 = state.initialState();
      s0 = state.applyIndustryDefaults({ ...s0, industry: 'Engineering/Construction' });
      s0 = state.applyCountryDefaults({ ...s0, country: 'United Arab Emirates', debt: '400', cash: '0', financialYear: '2025' });
      s0 = withFin(s0, { rev: [300, 280, 250, 260, 275, 290, 305, 320], ebitda: [12, 4, -6, 2, 8, 14, 20, 24], da: [10, 10, 9, 9, 9, 9, 10, 10], capex: [8, 6, 5, 5, 6, 6, 7, 7], nwc: [60, 58, 55, 56, 58, 60, 62, 64] });
      return run(state.toInputs(state.onEnterWacc(state.resetWacc(s0)), VALUATION_DATE));
    })();
    for (const [label, r] of [['base', B], ['regression', reg], ['full', run(state.toInputs(fullFeatureCase(state), VALUATION_DATE))], ['distressed', distressed], ['raise', run({ ...BASE, purpose: 'raise', raiseAmount: 90 })]]) {
      const mm = reconcileModule.reconcile(r);
      check(`${label}: reconciles`, mm.length === 0, JSON.stringify(mm.slice(0, 3)));
    }
    const tampered = clone(B);
    tampered.ev[1] += 1;
    check('a tampered blend is caught', reconcileModule.reconcile(tampered).some((x) => x.id === 'blend_1'));
    const shifted = clone(B);
    shifted.sensitivity.grid[2][2] += 1;
    check('a sensitivity centre that is not the base case is caught', reconcileModule.reconcile(shifted).some((x) => x.id === 'sensitivity_centre'));
    let threw = false;
    try {
      reconcileModule.assertReconciled(tampered);
    } catch {
      threw = true;
    }
    check('outside production a mismatch throws', threw);
    check('no "-0.0" or "(0.0)" from the formatters', format.fmtMillions(-0.01) === '0.0' && format.fmtPct(-0.00001) === '0.00%' && format.fmtPoints(-0.01) === '0.0 pts');
  }

  // Serialisation, stored leads, units.
  {
    const r = run({ ...REG, purpose: 'sale' });
    const negFin = clone(fin);
    negFin.ebitda[7] = -2;
    const noExit = run({ ...REG, financials: negFin });
    const back = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(r))));
    const backNoExit = serialize.reviveResult(JSON.parse(JSON.stringify(serialize.serializeResult(noExit))));
    check('revive keeps a null raise, a null valuation date and a null company', back.raise === null && back.meta.valuationDate === null && back.meta.company === null);
    check('revive keeps a null exit multiple DCF', noExit.dcfBlock.exit === null && backNoExit.dcfBlock.exit === null);
    check('a revived result reconciles', reconcileModule.reconcile(back).length === 0);

    // A lead stored before version 3: schema 2 inputs and a result without the canonical blocks.
    const v2Inputs = clone(BASE);
    delete v2Inputs.gccOwnership;
    delete v2Inputs.valuationDate;
    v2Inputs.schemaVersion = 2;
    const oldResult = engine.runValuation(v2Inputs, engine.REFERENCE_METHOD).result;
    const stored = serialize.serializeResult(oldResult);
    for (const k of ['checks', 'recommendations', 'dcfBlock', 'terminal', 'forecast', 'comparables', 'blend', 'meta', 'tax', 'raise', 'weightedEquityRaw', 'weightsTotal']) delete stored[k];
    stored.schemaVersion = 2;
    const forReport = reportResult.resultForReport({ id: 'x', inputs: v2Inputs, results: stored });
    check('a stored version 2 lead is rebuilt with the figures it was sent', forReport.equity.every((v, k) => close(v, oldResult.equity[k])) && engine.isCanonicalResult(forReport));
    check('... and is labelled with the method it was valued under', format.terminalNote(forReport).includes('before 17 September 2026') && format.headline(forReport).asAt === 'as at end of FY2025');

    let small = state.initialState();
    small = state.applyIndustryDefaults({ ...small, industry: 'Restaurant/Dining' });
    small = state.applyCountryDefaults({ ...small, country: 'Saudi Arabia', debt: '0.02', cash: '0', financialYear: '2025', gccOwnership: '100' });
    small = withFin(small, { rev: [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5], ebitda: [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24], da: [0.02, 0.02, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04], capex: [0.03, 0.03, 0.03, 0.04, 0.04, 0.04, 0.05, 0.05], nwc: [0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.08, 0.08] });
    const sm = run(state.toInputs(state.onEnterWacc(state.resetWacc(small)), VALUATION_DATE));
    check('a small business prints in thousands', format.amountUnit(sm).label === 'SAR thousands' && format.bridgeTable(sm).head[0] === 'SAR thousands' && format.amountUnit(B).label === 'SAR millions');
    check('thousands reconcile', reconcileModule.reconcile(sm).length === 0, JSON.stringify(reconcileModule.reconcile(sm).slice(0, 2)));
    check('sub-million headline in thousands, zero stays in millions', format.fmtBig(0.45, sm.currency) === 'SAR 450 thousand' && format.fmtBig(0, sm.currency) === 'SAR 0.0 million');
  }
}

console.log('12. Version 4: borrowings and cash');
{
  check('the example company enters borrowings 65 and cash 20 (net debt 45)', BASE.debt === 65 && BASE.cash === 20 && BASE.netDebt === 45 && data.EXAMPLE_COMPANY.debt === 65 && data.EXAMPLE_COMPANY.cash === 20);
  const b = run(BASE);
  check('net debt is borrowings less cash', b.netDebt === 45 && b.debt === 65 && b.cash === 20);
  check('a net debt figure sent alongside borrowings is ignored', run({ ...BASE, netDebt: 9999 }).equity.every((v, k) => v === b.equity[k]));
  const asV3 = run({ ...BASE, schemaVersion: 3, debt: undefined, netDebt: 45, cash: 20 });
  check('the same valuation as version 3 inputs with net debt 45 and zakat cash 20', asV3.equity.every((v, k) => close(v, b.equity[k])) && asV3.debt === null);
  const netCash = run({ ...BASE, debt: 0, cash: 30 });
  check('cash above borrowings is net cash', netCash.netDebt === -30 && netCash.equity[1] > b.equity[1]);
  check('blank cash is refused', engine.validateCompany({ ...BASE, cash: null }).cash === engine.CASH_REQUIRED_MESSAGE);
  check('blank borrowings are refused', engine.validateCompany({ ...BASE, debt: null }).debt === engine.DEBT_REQUIRED_MESSAGE);
  check('negative borrowings or cash are refused', Boolean(engine.validateCompany({ ...BASE, debt: -1 }).debt) && Boolean(engine.validateCompany({ ...BASE, cash: -1 }).cash));
  check('zero borrowings and zero cash are accepted', !engine.validateCompany({ ...BASE, debt: 0, cash: 0 }).debt && !engine.validateCompany({ ...BASE, debt: 0, cash: 0 }).cash);
  check('runValuation refuses blank cash at step 1', engine.runValuation({ ...BASE, cash: null }).ok === false);
  const qatar = state.toInputs({ ...minimalCase(state), country: 'Qatar' }, VALUATION_DATE);
  check('outside Saudi Arabia cash is sent and required too', qatar.cash === 20 && engine.validateCompany({ ...qatar, cash: null }).cash === engine.CASH_REQUIRED_MESSAGE);
  check('in Saudi Arabia cash also adds to the zakat base, with no missing-cash note', b.tax.zakatBaseLtm?.cash === 20 && !format.disclosures(b).zakat.includes('Cash was not entered'));
  const t = format.timingRows(b);
  check('assumptions list borrowings, cash and net debt', t.some(([k]) => k === 'Borrowings, year end') && t.some(([k]) => k === 'Cash, year end') && t.some(([k]) => k === 'Net debt at year end (borrowings less cash)'));
  check('the bridge and the net debt sentence say borrowings less cash', format.bridgeTable(b).rows.some((row) => row.label === 'Less net debt at 31 December 2025, borrowings less cash') && format.netDebtSentence(b).startsWith('Net debt at 31 December 2025, borrowings less cash'));
  const v3 = run({ ...BASE, schemaVersion: 3, debt: undefined, cash: undefined, netDebt: 45 });
  check('version 3 results keep the as entered wording', format.netDebtSentence(v3).startsWith('Net debt at 31 December 2025, as entered') && format.timingRows(v3).some(([k]) => k === 'Net debt at year end (entered)'));
  check('form: net debt is worked out as the fields are typed', state.netDebtOf({ debt: '65', cash: '20' }) === 45 && state.netDebtOf({ debt: '', cash: '20' }) === null && state.netDebtOf({ debt: '0', cash: '12.5' }) === -12.5);
  // Stored version 3 inputs split into borrowings and cash with the same net debt and zakat cash.
  const split = (netDebt, cash) => state.balancesFromInputs({ ...BASE, schemaVersion: 3, debt: undefined, netDebt, cash });
  check('version 3, net debt 45 with zakat cash 20: borrowings 65, cash 20', JSON.stringify(split(45, 20)) === JSON.stringify({ debt: '65', cash: '20' }), JSON.stringify(split(45, 20)));
  check('version 3, net debt 45 with no cash: borrowings 45, cash 0', JSON.stringify(split(45, null)) === JSON.stringify({ debt: '45', cash: '0' }), JSON.stringify(split(45, null)));
  check('version 3, net cash 30: borrowings 0, cash 30', JSON.stringify(split(-30, null)) === JSON.stringify({ debt: '0', cash: '30' }), JSON.stringify(split(-30, null)));
  const revived = run(state.toInputs(state.stateFromInputs({ ...BASE, schemaVersion: 3, debt: undefined, netDebt: 45, cash: 20 }), VALUATION_DATE));
  check('a revived version 3 input values the same after the split', revived.equity.every((v, k) => close(v, asV3.equity[k])));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
