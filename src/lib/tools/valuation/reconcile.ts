/**
 * Reconciliation assertions, run on a result before the PDF report is rendered.
 *
 * Every figure the report prints is read from one result object, so these do
 * not re-derive the valuation. They prove the object is internally consistent
 * (the identities the report's pages rely on hold) and that the strings the
 * pages print agree with the numbers underneath. A failure means a page would
 * contradict another page.
 *
 * Tolerance is 0.05 in display units: millions for money (half a thousand when
 * a small business is printed in thousands), percentage points for rates,
 * turns for multiples. Discount factors, which print to three
 * decimals, are held to 0.0005.
 *
 * In development and in the verifiers a mismatch throws. In production it is
 * logged and the report still renders: a visitor gets their report, and the
 * log says what to fix.
 */

import type { Range3, ValuationResult } from './engine';
import {
  bridgeTable,
  checkItems,
  dcfSummaryRows,
  executiveSummary,
  fcfTable,
  fmtBig,
  amountUnit,
  fmtAmount,
  headline,
  profileRatios,
  raiseTable,
  scenariosTable,
  sensitivityTable,
  taxRows,
  terminalRows,
  timingRows,
  valueLevers,
  waccBuildRows,
  comparablesRows,
  type Table,
} from './format';

export type Mismatch = { id: string; detail: string };

const TOL = 0.05;
const near = (a: number, b: number, tol = TOL) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** "1,234.5" and "(12.0)" back to numbers. */
function parseMillions(s: string): number {
  const neg = s.startsWith('(');
  const v = parseFloat(s.replace(/[(),]/g, ''));
  return neg ? -v : v;
}

function rowValues(t: Table, label: string): string[] | null {
  return t.rows.find((r) => r.label === label)?.values ?? null;
}

export function reconcile(r: ValuationResult): Mismatch[] {
  const out: Mismatch[] = [];
  const expect = (id: string, ok: boolean, detail: string) => {
    if (!ok) out.push({ id, detail });
  };
  const c = r.currency;
  const u = amountUnit(r);
  const money = (text: string) => parseMillions(text) / u.scale;
  // 0.05 in the printed unit where it prints a decimal, half a unit where it does not, held in millions.
  const tolM = (u.digits ? 0.05 : 0.5) / u.scale;
  const nearM = (a: number, b: number) => near(a, b, tolM);
  const w = r.blend.dcfWeight;
  const claims = r.bridge.eosb + r.bridge.leases + r.bridge.minorityInterest;
  const netDebtAtDate = r.bridge.netDebtAtValuationDate ?? r.netDebt;
  const bridgeOf = (ev: number) => ev - netDebtAtDate - claims + r.bridge.surplusAssets;

  // Page consistency: the headline equity range and base case, and the page 3 table.
  const h = headline(r);
  const bt = bridgeTable(r);
  const tableEquity = (rowValues(bt, 'Equity value') ?? []).map(money);
  [0, 1, 2].forEach((k) => {
    expect(`page_equity_${k}`, nearM(tableEquity[k], r.equity[k]), `bridge table ${tableEquity[k]} against equity ${r.equity[k]}`);
    expect(`headline_floor_${k}`, r.equityDisplay[k] === Math.max(0, r.equity[k]), `display ${r.equityDisplay[k]} against equity ${r.equity[k]}`);
  });
  // The headline prints the same numbers the table does, at its own precision.
  expect('headline_range', h.equityRange === `${fmtBig(r.equityDisplay[0], c)} to ${fmtBig(r.equityDisplay[2], c)}`, `${h.equityRange} against the equity range`);
  expect('headline_base', h.midpoint === fmtBig(r.equityDisplay[1], c), `${h.midpoint} against the base case`);

  // Blend, at low, base and high.
  [0, 1, 2].forEach((k) => {
    const want = r.dcfBlock.combined[k] * w + r.comparables.value[k] * (1 - w);
    expect(`blend_${k}`, nearM(r.ev[k], want), `blended EV ${r.ev[k]} against ${want}`);
  });

  // Equity bridge: blended, DCF, and each scenario.
  const bridgeRange = (label: string, ev: Range3, equity: Range3) =>
    [0, 1, 2].forEach((k) => expect(`bridge_${label}_${k}`, nearM(equity[k], bridgeOf(ev[k])), `${label} equity ${equity[k]} against ${bridgeOf(ev[k])}`));
  bridgeRange('blended', r.ev, r.equity);
  bridgeRange('dcf', r.dcfBlock.combined, r.dcfBlock.equity);
  for (const s of r.scenarios) bridgeRange(`scenario_${s.key}`, s.ev, s.equity);

  // Probability weighting.
  if (r.scenarios.length) {
    const sumP = r.scenarios.reduce((a, s) => a + s.weight, 0);
    const sumEq = r.scenarios.reduce((a, s) => a + s.weight * s.equity[1], 0);
    expect('probabilities_total', Math.abs(sumP - 1) < 1e-9, `probabilities total ${sumP}`);
    expect('weighted_equity', nearM(r.weightedEquityRaw, sumEq), `weighted ${r.weightedEquityRaw} against ${sumEq}`);
    const st = scenariosTable(r);
    const printed = money(st.rows.at(-1)?.values.at(-1) ?? '');
    const printedSum = st.rows.slice(0, -1).reduce((a, row, k) => a + r.scenarios[k].weight * money(row.values.at(-1) ?? ''), 0);
    expect('weighted_row_reconciles', near(printed, printedSum, tolM * (1 + r.scenarios.length)), `weighted row ${printed} against printed rows ${printedSum}`);
  }

  // Sensitivity: the highlighted centre cell is the perpetuity DCF base equity.
  const centre = r.sensitivity.grid[2]?.[2];
  expect('sensitivity_centre', nearM(centre, r.dcfBlock.perpetuityEquityBase), `centre ${centre} against ${r.dcfBlock.perpetuityEquityBase}`);
  expect('sensitivity_centre_wacc', r.sensitivity.waccs[2] === r.wacc.wacc, `centre WACC ${r.sensitivity.waccs[2]} against ${r.wacc.wacc}`);
  expect('sensitivity_centre_printed', sensitivityTable(r).rows[2]?.values[2] === fmtAmount(r.dcfBlock.perpetuityEquityBase, u), 'printed centre cell');

  // Terminal value share, for the perpetuity method.
  const share = r.terminal.pvPerpetuity / r.dcfBlock.perpetuity[1];
  expect('tv_share', near(r.terminal.tvShare * 100, share * 100), `share ${r.terminal.tvShare} against ${share}`);

  // Implied EV / LTM EBITDA.
  if (r.ltmEbitda > 0) expect('implied_ltm_multiple', near(r.ltmMultiple, r.ev[1] / r.ltmEbitda), `${r.ltmMultiple} against ${r.ev[1] / r.ltmEbitda}`);

  // Discount factors on the unrounded WACC.
  r.forecast.forEach((f, k) => {
    const df = 1 / Math.pow(1 + r.wacc.wacc, f.period);
    expect(`discount_factor_${k}`, near(f.df, df, 0.0005), `year ${k + 1}: ${f.df} against ${df}`);
    expect(`present_value_${k}`, nearM(f.pv, f.fcfValued * f.df), `year ${k + 1} PV`);
  });
  expect('discount_factor_terminal', near(r.terminal.df, 1 / Math.pow(1 + r.wacc.wacc, r.terminal.period), 0.0005), 'terminal discount factor');
  const evPerp = r.dcfBlock.pvForecast + r.terminal.pvPerpetuity;
  expect('dcf_perpetuity_adds_up', nearM(evPerp, r.dcfBlock.perpetuity[1]), `PV ${r.dcfBlock.pvForecast} + PV(TV) ${r.terminal.pvPerpetuity} against ${r.dcfBlock.perpetuity[1]}`);

  // Output hygiene over every string the report prints.
  const strings: string[] = [
    ...Object.values(h).filter((v): v is string => typeof v === 'string'),
    ...executiveSummary(r),
    ...[bt, fcfTable(r), sensitivityTable(r), scenariosTable(r), raiseTable(r)].flatMap((t) => (t ? [...t.head, ...t.rows.flatMap((row) => [row.label, ...row.values])] : [])),
    ...[dcfSummaryRows(r), waccBuildRows(r), terminalRows(r), comparablesRows(r), taxRows(r), timingRows(r), profileRatios(r)].flat(2),
    ...checkItems(r).flatMap((x) => [x.label, x.message]),
    ...valueLevers(r).flatMap((l) => [l.title, l.detail]),
  ];
  for (const s of strings) {
    if (/NaN|undefined|Infinity|-0\.0\b|\(0\.0\)|-0%|-0\.0+%/.test(s)) out.push({ id: 'hygiene', detail: s.slice(0, 160) });
  }
  return out;
}

/** Throws outside production; logs in production. Returns the mismatches either way. */
export function assertReconciled(r: ValuationResult): Mismatch[] {
  const mismatches = reconcile(r);
  if (mismatches.length) {
    const text = mismatches.map((m) => `${m.id}: ${m.detail}`).join('\n');
    if (process.env.NODE_ENV === 'production') console.error(`[valuation report] reconciliation mismatches\n${text}`);
    else throw new Error(`Valuation report reconciliation failed:\n${text}`);
  }
  return mismatches;
}
