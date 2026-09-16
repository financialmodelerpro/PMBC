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
//
//   npm run verify-valuation-v2
//
// No server, database or browser.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const data = await jiti.import(path.join(root, 'src/lib/tools/valuation/data.ts'));
const serialize = await jiti.import(path.join(root, 'src/lib/tools/valuation/serialize.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));

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

const BASE = state.toInputs(minimalCase(state));
const B = run(BASE);
const H = 3; // history years
const codes = (r) => r.warnings.map((w) => w.code);

console.log('1. Neutral defaults');
{
  const stripped = clone(BASE);
  for (const k of ['normalisation', 'bridge', 'stake', 'scenarios', 'investedCapital', 'waccAdjustment', 'schemaVersion']) delete stripped[k];
  const S = run(stripped);
  for (const k of ['ev', 'equity', 'equityDisplay', 'dcfRange', 'compRange']) {
    check(`${k} identical with the blocks absent`, S[k].every((v, i) => v === B[k][i]), `${S[k]} vs ${B[k]}`);
  }
  check('WACC identical', S.wacc.wacc === B.wacc.wacc && B.wacc.adjustment === 0);
  check('stake not used at 100% and no adjustment', !B.stake.used && B.stake.percent === 100);
  check('normalisation not used', !B.normalisation.used && B.ltmEbitda === B.ltmEbitdaReported);
  check('no other claims', B.bridge.otherClaims === 0);
  check('bridge table has only net debt between EV and equity', format.bridgeTable(B).rows.length === 5);
  check('headline shows no stake', format.headline(B).stakeRange === null);
  check('default weights 25/50/25', B.scenarios.map((s) => s.weight).join() === '0.25,0.5,0.25');
  check('reference example triggers no warnings', B.warnings.length === 0, codes(B).join());
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
  near('upside equals a run on the upside forecast', upS.equity[1], manualUp.equity[1]);
  const manualDown = run({ ...BASE, financials: engine.scenarioFinancials(fin, -3, -2) });
  near('downside equals a run on the downside forecast', down.equity[1], manualDown.equity[1]);
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
  // In enterprise value, like every other row: downside, weighted, upside midpoints.
  check('scenarios row is downside, weighted and upside EV', scRow && close(scRow.range[0], down.ev[1]) && close(scRow.range[1], 0.25 * down.ev[1] + 0.5 * base.ev[1] + 0.25 * upS.ev[1]) && close(scRow.range[2], upS.ev[1]), JSON.stringify(scRow?.range));
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
  const nd = B.netDebt;
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
    check('TV share: triggers above 75%', has(hi, 'terminal_value_share'));
    check('TV share: case below is below', lo.tvShare <= R.terminalValueShare, lo.tvShare);
    check('TV share: silent below', !has(lo, 'terminal_value_share'));
  }
  // Growth ceiling, Saudi 4.0 and Pakistan 9.0.
  {
    check('ceilings as stated', data.COUNTRIES['Saudi Arabia'].growthCeiling === 4 && data.COUNTRIES.Pakistan.growthCeiling === 9);
    const over = run({ ...BASE, growth: 4.5 });
    const at = run({ ...BASE, growth: 4.0 });
    check('growth ceiling: 4.5% in SAR triggers', has(over, 'growth_ceiling'));
    check('growth ceiling: exactly 4.0% in SAR is silent', !has(at, 'growth_ceiling'));
    const pk = state.toInputs(fullFeatureCase(state));
    check('growth ceiling: 9.5% in PKR triggers', has(run({ ...pk, growth: 9.5 }), 'growth_ceiling'));
    check('growth ceiling: 9.0% in PKR is silent', !has(run({ ...pk, growth: 9.0 }), 'growth_ceiling'));
  }
  // Exit multiple against the implied multiple.
  {
    const probe = run({ ...BASE, privateDiscount: 0 });
    const implied = probe.impliedExitMultiple;
    const aligned = run({ ...BASE, privateDiscount: 0, exitMultiple: implied });
    const far = run({ ...BASE, privateDiscount: 0, exitMultiple: implied * 1.5 });
    const edge = run({ ...BASE, privateDiscount: 0, exitMultiple: implied / 1.29 });
    check('mismatch: implied multiple does not depend on the exit multiple', close(aligned.impliedExitMultiple, implied) && close(far.impliedExitMultiple, implied));
    check('mismatch: equal multiples silent', !has(aligned, 'exit_multiple_mismatch'));
    check('mismatch: 50% apart triggers', has(far, 'exit_multiple_mismatch'));
    check('mismatch: 29% apart silent', !has(edge, 'exit_multiple_mismatch'));
    const withDisc = run({ ...BASE, privateDiscount: 40, exitMultiple: implied });
    check('mismatch: measured on the multiple after the discount', has(withDisc, 'exit_multiple_mismatch') && close(withDisc.warnings.find((w) => w.code === 'exit_multiple_mismatch').values.applied, implied * 0.6));
  }
  // Negative terminal free cash flow.
  {
    const fin = clone(BASE.financials);
    fin.capex[7] = fin.rev[7];
    const neg = run({ ...BASE, financials: fin });
    check('negative FCF: final year FCF is negative', neg.rows[4].fcf < 0);
    check('negative FCF: triggers', has(neg, 'terminal_fcf_negative'));
    check('negative FCF: base final FCF positive and silent', B.rows[4].fcf > 0 && !has(B, 'terminal_fcf_negative'));
  }
  // Margin jump into the first forecast year.
  {
    const ltmMargin = B.ltmEbitda / B.ltmRevenue;
    const withMargin = (pts) => {
      const fin = clone(BASE.financials);
      fin.ebitda[3] = fin.rev[3] * (ltmMargin + pts / 100);
      return run({ ...BASE, financials: fin });
    };
    check('margin jump: +11 points triggers', has(withMargin(11), 'margin_jump'));
    check('margin jump: -11 points triggers', has(withMargin(-11), 'margin_jump'));
    check('margin jump: +9 points silent', !has(withMargin(9), 'margin_jump'));
    const norm = run({ ...BASE, normalisation: { oneOff: B.ltmRevenue * 0.12, ownerCosts: null, carryOwnerCosts: false } });
    check('margin jump: measured from normalised EBITDA', has(norm, 'margin_jump'));
  }
  // ROIC against WACC.
  {
    const nopat = (B.ltmEbitda - BASE.financials.da[2]) * (1 - B.wacc.t);
    const lowIc = nopat / (B.wacc.wacc + 0.05);
    const highIc = nopat / (B.wacc.wacc - 0.03);
    const good = run({ ...BASE, investedCapital: lowIc });
    const poor = run({ ...BASE, investedCapital: highIc });
    near('ROIC: computed as after-tax EBIT over invested capital', good.ratios.roic, B.wacc.wacc + 0.05);
    check('ROIC: above WACC silent', !has(good, 'roic_below_wacc'));
    check('ROIC: below WACC triggers', has(poor, 'roic_below_wacc'));
    check('ROIC: without invested capital, no ROIC and silent', !Number.isFinite(B.ratios.roic) && !has(B, 'roic_below_wacc') && !has(B, 'reinvestment_inconsistent'));
    check('invested capital of zero refused', engine.validateFinancials(BASE.financials, { investedCapital: 0 }) === 'Enter invested capital above zero, or leave it blank.');
  }
  // Reinvestment against growth.
  {
    const nopat = (B.ltmEbitda - BASE.financials.da[2]) * (1 - B.wacc.t);
    const rr = B.ratios.reinvestmentRate;
    check('reinvestment: base reinvests a positive share', rr > 0, rr);
    const icFor = (impliedGrowth) => nopat / (impliedGrowth / rr);
    const g = B.growth;
    const consistent = run({ ...BASE, investedCapital: icFor(g + 0.01) });
    const inconsistent = run({ ...BASE, investedCapital: icFor(g + 0.05) });
    near('reinvestment: implied growth is reinvestment rate times ROIC', consistent.ratios.impliedGrowthFromReinvestment, g + 0.01, 1e-6);
    check('reinvestment: 1 point apart silent', !has(consistent, 'reinvestment_inconsistent'));
    check('reinvestment: 5 points apart triggers', has(inconsistent, 'reinvestment_inconsistent'));
  }
  // Every code has text.
  {
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
  const i = state.toInputs(s);
  const r = tryRun('full feature case', i);
  if (r) {
    check('currency PKR, not pegged', r.currency.code === 'PKR' && !r.currency.pegged);
    check('discount defaulted to 20 from two peers', s.privateDiscount === '20' && r.privateDiscount === 0.2);
    near('exit multiple applied after the discount', r.exitMultipleApplied, i.exitMultiple * 0.8);
    near('normalised LTM EBITDA', r.ltmEbitda, 1720 + 85 + 40);
    check('owner costs carried into the forecast', r.rows.every((row, k) => close(row.ebitda, i.financials.ebitda[3 + k] + 40)));
    near('other claims 160 + 220 + 75 - 300', r.bridge.otherClaims, 155);
    check('equity is EV less net debt less claims', r.equity.every((v, k) => close(v, r.ev[k] - 1200 - 155)));
    check('stake 40% with a 20% minority discount', r.stake.value.every((v, k) => close(v, r.equityDisplay[k] * 0.4 * 0.8)));
    check('the full example raises no stake warning', !codes(r).includes('premium_on_minority_stake'));
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
    const back = state.toInputs(state.stateFromInputs(i));
    const r2 = run(back);
    check('inputs survive the form round trip', r2.equity.every((v, k) => close(v, r.equity[k])) && close(r2.weightedEquity, r.weightedEquity));
  }
}

console.log('10. Lever, stake rule and inflation band');
{
  // The lever reads the table: centre cell and one point lower WACC, same growth.
  for (const [label, inputs] of [['minimal', BASE], ['full', state.toInputs(fullFeatureCase(state))]]) {
    const r = run(inputs);
    const lever = format.waccLeverFromSensitivity(r);
    const s = r.sensitivity;
    const wi = s.waccs.findIndex((w) => close(w, r.wacc.wacc)), wl = s.waccs.findIndex((w) => close(w, r.wacc.wacc - 0.01));
    const gi = s.growths.findIndex((g) => close(g, r.growth));
    check(`${label}: lever uses the table's centre and one point lower WACC at the same growth`, lever && lever.from === s.grid[wi][gi] && lever.to === s.grid[wl][gi], JSON.stringify(lever));
    check(`${label}: lever is not the old flexed figure (which also moved growth)`, lever && !close(lever.uplift, r.hiG - r.base.evG));
    const table = format.sensitivityTable(r);
    const leverText = format.valueLevers(r).find((l) => l.title === 'Lower the risk a buyer prices in')?.detail ?? '';
    check(`${label}: lever text quotes the two table cells exactly as printed`, leverText.includes(table.rows[wi].values[gi]) && leverText.includes(table.rows[wl].values[gi]), leverText);
    // An independent recomputation of the cell: equity at WACC minus one point, same growth.
    const alt = run({ ...inputs, waccAdjustment: (inputs.waccAdjustment ?? 0) - 1 });
    check(`${label}: the lower cell equals a full run at one point lower WACC`, close(lever.to, alt.base.evG - alt.netDebt - alt.bridge.otherClaims, 1e-9), `${lever.to} vs ${alt.base.evG - alt.netDebt - alt.bridge.otherClaims}`);
  }

  // Stake: a premium on 50% or less warns; above 50% it does not; a discount never does.
  const stake = (percent, adjustment) => ({ ...BASE, stake: { percent, adjustment, controlPremium: 25, minorityDiscount: 20 } });
  check('40% with a control premium warns', codes(run(stake(40, 'control_premium'))).includes('premium_on_minority_stake'));
  check('exactly 50% with a control premium warns', codes(run(stake(50, 'control_premium'))).includes('premium_on_minority_stake'));
  check('51% with a control premium is silent', !codes(run(stake(51, 'control_premium'))).includes('premium_on_minority_stake'));
  check('40% with a minority discount is silent', !codes(run(stake(40, 'minority_discount'))).includes('premium_on_minority_stake'));
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
  check('form: stored inputs restore as chosen', state.stateFromInputs(state.toInputs(st)).stakeAdjustmentTouched === true);

  // Inflation band. SAR is pegged: US long-run inflation 2.5, so 1.5 to 4.5 is silent.
  const has = (r, code) => codes(r).includes(code);
  check('pegged currencies use long-run US inflation', data.MARKET.usInflationLongRun === 2.5 && data.WARNING_RULES.inflationBelowPoints === 1 && data.WARNING_RULES.inflationAbovePoints === 2);
  check('SAR growth 1.4% warns (below inflation less one point)', has(run({ ...BASE, growth: 1.4 }), 'growth_vs_inflation'));
  check('SAR growth 1.5% is silent (at the lower edge)', !has(run({ ...BASE, growth: 1.5 }), 'growth_vs_inflation'));
  check('SAR growth 4.5% is silent (at the upper edge)', !has(run({ ...BASE, growth: 4.5 }), 'growth_vs_inflation'));
  check('SAR growth 4.6% warns (above inflation plus two points)', has(run({ ...BASE, growth: 4.6 }), 'growth_vs_inflation'));
  check('the reference example stays free of warnings', B.warnings.length === 0, codes(B).join());
  const pk = state.toInputs(fullFeatureCase(state));
  const pkInfl = pk.wacc.inflationLocal;
  check('PKR uses the local inflation entered', pkInfl === 7);
  check('PKR growth 5.9% warns', has(run({ ...pk, growth: 5.9 }), 'growth_vs_inflation'));
  check('PKR growth 6.0% is silent', !has(run({ ...pk, growth: 6.0 }), 'growth_vs_inflation'));
  check('PKR growth 9.0% is silent', !has(run({ ...pk, growth: 9.0 }), 'growth_vs_inflation'));
  check('PKR growth 9.1% warns', has(run({ ...pk, growth: 9.1 }), 'growth_vs_inflation'));
  check('PKR with 10% local inflation, growth 6.0% now warns', has(run({ ...pk, growth: 6.0, wacc: { ...pk.wacc, inflationLocal: 10 } }), 'growth_vs_inflation'));
  const low = run({ ...BASE, growth: 1 }).warnings.find((w) => w.code === 'growth_vs_inflation');
  check('inflation warning carries growth, inflation and both edges', low && close(low.values.inflation, 0.025) && close(low.values.low, 0.015) && close(low.values.high, 0.045));
  for (const [code, values] of [['growth_vs_inflation', { growth: 0.01, inflation: 0.025, low: 0.015, high: 0.045 }], ['growth_vs_inflation', { growth: 0.05, inflation: 0.025, low: 0.015, high: 0.045 }], ['premium_on_minority_stake', { percent: 40, threshold: 50, premium: 0.25 }]]) {
    const t = format.warningText({ code, values }, B);
    check(`${code}: has a title and detail`, Boolean(t && t.title && t.detail && !/NaN|undefined/.test(t.title + t.detail)), t?.detail);
  }
}

console.log('9. Schema version and WACC adjustment');
{
  check('schema version is 2', engine.INPUT_SCHEMA_VERSION === 2 && B.schemaVersion === 2 && BASE.schemaVersion === 2);
  const w0 = engine.computeWacc(BASE.wacc, B.currency, 0).wacc;
  const w1 = engine.computeWacc(BASE.wacc, B.currency, 1.5).wacc;
  near('adjustment of 1.5 points adds 0.015', w1, w0 + 0.015);
  const adj = run({ ...BASE, waccAdjustment: 1 });
  check('a higher WACC lowers the DCF', adj.dcfRange[1] < B.dcfRange[1]);
  check('growth must stay 1 point below the adjusted WACC', engine.validateTerminal({ ...BASE, growth: (w0 - 0.035) * 100 }, w0 - 0.03) !== null);
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
