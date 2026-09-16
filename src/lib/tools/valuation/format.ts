/**
 * Presentation of a `ValuationResult`: number formats, tables, notes, warnings
 * and the rule-based narrative.
 *
 * Shared by the results dashboard, the PDF report and the emails, so the three
 * say the same thing in the same format. Every sentence here is built from the
 * numbers by fixed rules, never generated, so every figure in it is exact.
 *
 * The version 1 formats are the reference's, and the verifier compares them.
 */

import { COUNTRIES, SOURCE_NOTES, WARNING_RULES } from './data';
import type { Currency, EquityFloor, Range3, ValuationResult, Warning } from './engine';

/** One decimal, thousands separators, negatives in brackets. */
export function fmtMillions(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return v < 0 ? `(${s})` : s;
}

/** A ratio as a percentage. */
export function fmtPct(v: number, digits = 2): string {
  return Number.isFinite(v) ? (v * 100).toFixed(digits) + '%' : 'n/a';
}

/** "SAR 12.5 million", "SAR 245 million", "SAR 1.25 billion". */
export function fmtBig(v: number, currency: Currency): string {
  if (!Number.isFinite(v)) return 'n/a';
  const a = Math.abs(v), s = v < 0 ? 'negative ' : '';
  return a >= 1000
    ? `${s}${currency.code} ${(a / 1000).toFixed(2)} billion`
    : `${s}${currency.code} ${a.toFixed(a >= 100 ? 0 : 1)} million`;
}

export function fmtMultiple(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) + 'x' : 'n/a';
}

/** Percentage points, signed: "+3.0 pts", "-2.0 pts". */
export function fmtPoints(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(1)} pts`;
}

export function currencyMillions(currency: Currency): string {
  return `${currency.code} millions`;
}

/** Version 2 fields read defensively, for results stored by version 1. */
function exitApplied(r: ValuationResult): number {
  return Number.isFinite(r.exitMultipleApplied) ? r.exitMultipleApplied : r.exitMultiple;
}

/** The headline figures, as shown at the top of the results and in the email. */
export function headline(r: ValuationResult) {
  const c = r.currency;
  const stake = r.stake;
  return {
    equityRange: `${fmtBig(r.equityDisplay[0], c)} to ${fmtBig(r.equityDisplay[2], c)}`,
    midpoint: fmtBig(r.equityDisplay[1], c),
    evRange: `${fmtBig(r.ev[0], c)} to ${fmtBig(r.ev[2], c)}`,
    valuationDate: `FY${r.years.history[2]}`,
    wacc: fmtPct(r.wacc.wacc) + (c.pegged ? '' : ` ${c.code}`),
    tvShare: Number.isFinite(r.tvShare) ? fmtPct(r.tvShare, 0) : 'n/a',
    impliedExitMultiple: fmtMultiple(r.impliedExitMultiple),
    ltmMultiple: fmtMultiple(r.ltmMultiple),
    floorNote: equityFloorNote(r.equityFloor),
    weighted: Number.isFinite(r.weightedEquity) && r.scenarios?.length ? fmtBig(r.weightedEquity, c) : null,
    stakeRange: stake?.used ? `${fmtBig(stake.value[0], c)} to ${fmtBig(stake.value[2], c)}` : null,
    stakeLabel: stake?.used ? stakeLabel(r) : null,
  };
}

export function stakeLabel(r: ValuationResult): string {
  const s = r.stake;
  const pct = `${+s.percent.toFixed(2)}% stake`;
  if (s.adjustment === 'control_premium') return `${pct} with a ${fmtPct(s.adjustmentRate, 0)} control premium`;
  if (s.adjustment === 'minority_discount') return `${pct} with a ${fmtPct(-s.adjustmentRate, 0)} minority discount`;
  return pct;
}

/**
 * The note shown when net debt exceeds enterprise value somewhere in the range,
 * so a zero in the headline is never mistaken for a calculation error.
 */
export function equityFloorNote(floor: EquityFloor): string | null {
  switch (floor) {
    case 'all':
      return 'Net debt exceeds enterprise value across the whole range, so equity value is shown as zero. The bridge below shows the negative figures.';
    case 'low_and_mid':
      return 'Net debt exceeds enterprise value at the low end and the midpoint, so both are shown as zero. The bridge below shows the negative figures.';
    case 'low':
      return 'Net debt exceeds enterprise value at the low end of the range, so the low end is shown as zero. The bridge below shows the negative figure.';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Football field                                                            */
/* ------------------------------------------------------------------------ */

export type FootballFieldRow = {
  key: 'dcf_growth' | 'dcf_exit' | 'comps_ebitda' | 'comps_revenue' | 'blended' | 'scenarios';
  label: string;
  sub: string;
  range: Range3 | null;
  blend: boolean;
};

/** The five version 1 rows, in the reference's order. The verifier compares exactly these. */
export const REFERENCE_FOOTBALL_KEYS: FootballFieldRow['key'][] = ['dcf_growth', 'dcf_exit', 'comps_ebitda', 'comps_revenue', 'blended'];

export function footballFieldRows(r: ValuationResult): FootballFieldRow[] {
  const srcE = r.comps.peersE ? `Your ${r.comps.peersE} peers` : 'Preset';
  const srcR = r.comps.peersR ? `Your ${r.comps.peersR} peers` : 'Preset';
  const rows: FootballFieldRow[] = [
    {
      key: 'dcf_growth',
      label: 'DCF, perpetuity growth',
      sub: `WACC ${fmtPct(r.wacc.wacc, 1)}, g ${fmtPct(r.growth, 1)}`,
      range: [r.loG, r.base.evG, r.hiG],
      blend: false,
    },
    {
      key: 'dcf_exit',
      label: 'DCF, exit multiple',
      sub: `${exitApplied(r).toFixed(1)}x terminal EBITDA`,
      range: Number.isFinite(r.base.evX) ? [r.loX, r.base.evX, r.hiX] : null,
      blend: false,
    },
    { key: 'comps_ebitda', label: 'Comps, EV / EBITDA', sub: `${srcE}, LTM`, range: r.compsEbitda, blend: false },
    { key: 'comps_revenue', label: 'Comps, EV / Revenue', sub: `${srcR}, LTM`, range: r.compsRevenue, blend: false },
    {
      key: 'blended',
      label: 'Blended',
      sub: `${r.dcfWeight}% DCF, ${100 - r.dcfWeight}% comps`,
      range: r.ev,
      blend: true,
    },
  ];
  // Scenarios, as enterprise value like every other row: downside, the
  // probability-weighted midpoint, upside.
  if (r.scenarios?.length === 3) {
    const [down, , up] = r.scenarios;
    const weightedEv = r.scenarios.reduce((a, s) => a + s.weight * s.ev[1], 0);
    rows.push({
      key: 'scenarios',
      label: 'Scenarios',
      sub: `Downside, weighted, upside`,
      range: [down.ev[1], weightedEv, up.ev[1]],
      blend: false,
    });
  }
  return rows;
}

/** Axis bounds and a position function for the football field, as the reference draws it. */
export function footballFieldScale(rows: FootballFieldRow[]) {
  const all = rows.flatMap((row) => (row.range ? [row.range[0], row.range[2]] : [])).filter(Number.isFinite);
  const maxV = Math.max(...all) * 1.08, minV = Math.min(0, Math.min(...all));
  const span = maxV - minV;
  return {
    minV,
    maxV,
    pos: (v: number) => ((v - minV) / span) * 100,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(minV + span * p).toLocaleString('en-US')),
  };
}

/** Methods that actually contributed to the blended value, for the email summary. */
export function methodsUsed(r: ValuationResult): string[] {
  const out: string[] = [];
  if (r.dcfWeight > 0) {
    out.push(Number.isFinite(r.base.evX) ? 'DCF (perpetuity growth and exit multiple)' : 'DCF (perpetuity growth)');
  }
  if (r.dcfWeight < 100) {
    out.push(r.compsEbitda ? 'Comparables (EV / EBITDA)' : 'Comparables (EV / Revenue)');
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Tables                                                                    */
/* ------------------------------------------------------------------------ */

export type TableRow = { label: string; values: string[]; tone?: 'strong' | 'muted' };
export type Table = { head: string[]; rows: TableRow[] };

export function fcfTable(r: ValuationResult): Table {
  const m = (arr: number[]) => arr.map(fmtMillions);
  return {
    head: [currencyMillions(r.currency), ...r.years.forecast.map((y) => `FY${y} F`)],
    rows: [
      { label: 'Revenue', values: m(r.rows.map((x) => x.rev)) },
      { label: 'EBITDA', values: m(r.rows.map((x) => x.ebitda)) },
      { label: 'Less depreciation and amortisation', values: m(r.rows.map((x) => -x.da)), tone: 'muted' },
      { label: 'EBIT', values: m(r.rows.map((x) => x.ebit)) },
      { label: `Less tax at ${fmtPct(r.wacc.t, 1)}`, values: m(r.rows.map((x) => -x.tax)), tone: 'muted' },
      { label: 'Add back depreciation and amortisation', values: m(r.rows.map((x) => x.da)), tone: 'muted' },
      { label: 'Less capital expenditure', values: m(r.rows.map((x) => -x.capex)), tone: 'muted' },
      { label: 'Less increase in working capital', values: m(r.rows.map((x) => -x.dnwc)), tone: 'muted' },
      { label: 'Free cash flow to firm', values: m(r.rows.map((x) => x.fcf)), tone: 'strong' },
      { label: 'Discount factor', values: r.base.dfs.map((v) => v.toFixed(3)), tone: 'muted' },
      { label: 'Present value', values: m(r.rows.map((x, i) => x.fcf * r.base.dfs[i])) },
    ],
  };
}

/** Rows are WACC, columns are growth. The centre cell is the base case. */
export function sensitivityTable(r: ValuationResult): Table {
  return {
    head: ['WACC \\ growth', ...r.sensitivity.growths.map((g) => fmtPct(g, 1))],
    rows: r.sensitivity.grid.map((row, i) => ({
      label: fmtPct(r.sensitivity.waccs[i], 1),
      values: row.map(fmtMillions),
    })),
  };
}

/**
 * Enterprise to equity. Version 2 bridge items appear only when entered, so a
 * valuation without them has exactly the version 1 table.
 */
export function bridgeTable(r: ValuationResult): Table {
  const m = (arr: number[]) => arr.map(fmtMillions);
  const nd = r.netDebt;
  const b = r.bridge;
  const three = (v: number) => m([v, v, v]);
  const rows: TableRow[] = [
    { label: 'DCF enterprise value', values: m(r.dcfRange) },
    { label: 'Comparables enterprise value', values: m(r.compRange) },
    { label: `Blended enterprise value (${r.dcfWeight}% DCF)`, values: m(r.ev) },
    { label: nd >= 0 ? 'Less net debt' : 'Add net cash', values: m([-nd, -nd, -nd]), tone: 'muted' },
  ];
  if (b?.eosb) rows.push({ label: 'Less end of service benefits', values: three(-b.eosb), tone: 'muted' });
  if (b?.leases) rows.push({ label: 'Less lease liabilities', values: three(-b.leases), tone: 'muted' });
  if (b?.minorityInterest) rows.push({ label: 'Less minority interest', values: three(-b.minorityInterest), tone: 'muted' });
  if (b?.surplusAssets) rows.push({ label: 'Add surplus assets and investments', values: three(b.surplusAssets), tone: 'muted' });
  rows.push({ label: 'Equity value', values: m(r.equity), tone: 'strong' });
  return { head: [currencyMillions(r.currency), 'Low', 'Mid', 'High'], rows };
}

/** The steps of the value bridge at the midpoint, for the waterfall chart. */
export type BridgeStep = { label: string; value: number; kind: 'total' | 'add' | 'less' };

export function bridgeSteps(r: ValuationResult): BridgeStep[] {
  const b = r.bridge;
  const steps: BridgeStep[] = [{ label: 'Enterprise value', value: r.ev[1], kind: 'total' }];
  steps.push({ label: r.netDebt >= 0 ? 'Net debt' : 'Net cash', value: -r.netDebt, kind: r.netDebt >= 0 ? 'less' : 'add' });
  if (b?.eosb) steps.push({ label: 'End of service benefits', value: -b.eosb, kind: 'less' });
  if (b?.leases) steps.push({ label: 'Lease liabilities', value: -b.leases, kind: 'less' });
  if (b?.minorityInterest) steps.push({ label: 'Minority interest', value: -b.minorityInterest, kind: 'less' });
  if (b?.surplusAssets) steps.push({ label: 'Surplus assets', value: b.surplusAssets, kind: 'add' });
  steps.push({ label: 'Equity value', value: r.equity[1], kind: 'total' });
  return steps;
}

export function keyRatiosTable(r: ValuationResult): Table {
  const q = r.ratios;
  const rows: TableRow[] = [
    { label: 'Revenue growth, actual years (CAGR)', values: [fmtPct(q.revenueCagrHistory, 1)] },
    { label: 'Revenue growth, forecast (CAGR)', values: [fmtPct(q.revenueCagrForecast, 1)] },
    { label: r.normalisation?.used ? 'EBITDA margin, last actual year (normalised)' : 'EBITDA margin, last actual year', values: [fmtPct(q.ebitdaMarginLtm, 1)] },
    { label: 'EBITDA margin, final forecast year', values: [fmtPct(q.ebitdaMarginTerminal, 1)] },
    { label: 'Capex intensity, forecast average', values: [fmtPct(q.capexIntensity, 1)] },
    { label: 'Working capital intensity, final year', values: [fmtPct(q.nwcIntensity, 1)] },
    { label: 'Free cash flow conversion of EBITDA', values: [fmtPct(q.fcfConversion, 0)] },
    { label: 'Return on invested capital, last actual year', values: [Number.isFinite(q.roic) ? fmtPct(q.roic, 1) : 'Not provided'] },
  ];
  return { head: ['Ratio', 'Value'], rows };
}

export function scenariosTable(r: ValuationResult): Table {
  const c = r.currency;
  const names = { downside: 'Downside', base: 'Base', upside: 'Upside' } as const;
  const rows: TableRow[] = (r.scenarios ?? []).map((s) => ({
    label: names[s.key],
    values: [
      s.key === 'base' ? 'As entered' : `${fmtPoints(s.growthPoints)} growth, ${fmtPoints(s.marginPoints)} margin`,
      fmtPct(s.weight, 0),
      fmtMillions(s.terminalRevenue),
      fmtMillions(s.ev[1]),
      fmtMillions(s.equityDisplay[1]),
    ],
  }));
  if (Number.isFinite(r.weightedEquity)) {
    rows.push({ label: 'Probability-weighted', values: ['', '100%', '', '', fmtMillions(r.weightedEquity)], tone: 'strong' });
  }
  return {
    head: ['Scenario', 'Adjustment', 'Weight', `Final year revenue, ${c.code} m`, `EV mid, ${c.code} m`, `Equity mid, ${c.code} m`],
    rows,
  };
}

/** The cost of capital build, as label and value pairs. */
export function waccBuildRows(r: ValuationResult): [string, string][] {
  const w = r.wacc;
  const rows: [string, string][] = [
    ['Risk-free rate', fmtPct(w.rf)],
    ['Mature market equity risk premium', fmtPct(w.erp)],
    ['Country risk premium', fmtPct(w.crp)],
    ['Unlevered beta', Number.isFinite(w.bu) ? w.bu.toFixed(2) : 'n/a'],
    ['Target debt to equity', fmtPct(w.de, 1)],
    ['Levered beta', Number.isFinite(w.bl) ? w.bl.toFixed(2) : 'n/a'],
    ['Size and company premium', fmtPct(w.sp, 1)],
    ['Cost of equity', fmtPct(w.ke)],
    ['Country default spread', fmtPct(w.ds)],
    ['Company credit spread', fmtPct(w.cs, 1)],
    ['Pre-tax cost of debt', fmtPct(w.kd)],
    ['Tax rate', fmtPct(w.t, 1)],
    ['After-tax cost of debt', fmtPct(w.kdt)],
    ['Equity weight', fmtPct(w.we, 1)],
    ['Debt weight', fmtPct(w.wd, 1)],
  ];
  if (!r.currency.pegged) rows.push(['WACC in US dollars', fmtPct(w.waccUsd)]);
  if (w.adjustment) rows.push(['Adjustment (exploration)', fmtPoints(w.adjustment * 100)]);
  return rows;
}

/** Terminal value and comparables assumptions, as label and value pairs. */
export function terminalRows(r: ValuationResult): [string, string][] {
  const rows: [string, string][] = [
    ['Long-term growth', fmtPct(r.growth, 1)],
    ['Exit EV / EBITDA multiple', fmtMultiple(r.exitMultiple)],
  ];
  if (r.privateDiscount) {
    rows.push(['Private company discount', fmtPct(r.privateDiscount, 0)]);
    rows.push(['Exit multiple after discount', fmtMultiple(exitApplied(r))]);
  }
  rows.push(['Discounting', r.midYear ? 'Mid-year convention' : 'End of year']);
  rows.push(['EV / EBITDA used', `${r.comps.ebitda.map((v) => fmtMultiple(v)).join(', ')} (${r.comps.peersE ? `${r.comps.peersE} peers` : 'preset'})`]);
  rows.push(['EV / Revenue used', `${r.comps.revenue.map((v) => fmtMultiple(v)).join(', ')} (${r.comps.peersR ? `${r.comps.peersR} peers` : 'preset'})`]);
  rows.push(['Weight on DCF', `${r.dcfWeight}%`]);
  return rows;
}

export function normalisationRows(r: ValuationResult): [string, string][] {
  const nrm = r.normalisation;
  if (!nrm?.used) return [];
  return [
    ['Reported EBITDA, last actual year', fmtMillions(r.ltmEbitdaReported)],
    ['Add back one-off costs', fmtMillions(nrm.oneOff)],
    ['Add back owner costs above market', fmtMillions(nrm.ownerCosts)],
    ['Normalised EBITDA', fmtMillions(r.ltmEbitda)],
    ['Owner cost add-back in forecast years', nrm.carryOwnerCosts ? 'Yes' : 'No'],
  ];
}

/* ------------------------------------------------------------------------ */
/* Warnings                                                                  */
/* ------------------------------------------------------------------------ */

export type WarningText = { code: Warning['code']; title: string; detail: string };

export function warningText(w: Warning, r: ValuationResult): WarningText {
  const v = w.values;
  switch (w.code) {
    case 'terminal_value_share':
      return {
        code: w.code,
        title: 'Most of the value sits beyond the forecast',
        detail: `The terminal value is ${fmtPct(v.share, 0)} of the DCF, above ${fmtPct(v.threshold, 0)}. The result depends heavily on long-term growth and WACC, so test those first.`,
      };
    case 'growth_ceiling':
      return {
        code: w.code,
        title: 'Long-term growth is high for the currency',
        detail: `Growth of ${fmtPct(v.growth, 1)} forever is above ${fmtPct(v.ceiling, 1)}, which is roughly long-run inflation plus real growth in ${r.currency.code}. No business outgrows its economy indefinitely.`,
      };
    case 'exit_multiple_mismatch':
      return {
        code: w.code,
        title: 'The two terminal value methods disagree',
        detail: `The exit multiple used is ${fmtMultiple(v.applied)}, but perpetuity growth implies ${fmtMultiple(v.implied)}, a gap of more than ${fmtPct(v.threshold, 0)}. One of the growth rate or the multiple is likely out of line.`,
      };
    case 'terminal_fcf_negative':
      return {
        code: w.code,
        title: 'Free cash flow is negative in the final year',
        detail: `The final forecast year's free cash flow is ${fmtMillions(v.fcf)} ${currencyMillions(r.currency)}. A perpetuity built on a negative cash flow has no meaning, so rely on the exit multiple and comparables.`,
      };
    case 'margin_jump':
      return {
        code: w.code,
        title: 'The forecast margin jumps from the last actual year',
        detail: `EBITDA margin moves from ${fmtPct(v.from, 1)} to ${fmtPct(v.to, 1)} in the first forecast year, more than ${(v.threshold * 100).toFixed(0)} points. A buyer will ask what changes.`,
      };
    case 'roic_below_wacc':
      return {
        code: w.code,
        title: 'Returns are below the cost of capital',
        detail: `Return on invested capital of ${fmtPct(v.roic, 1)} is below the WACC of ${fmtPct(v.wacc, 1)}. On these figures growth destroys value rather than creating it.`,
      };
    case 'reinvestment_inconsistent':
      return {
        code: w.code,
        title: 'Growth and reinvestment do not line up',
        detail: `Reinvesting ${Number.isFinite(v.reinvestmentRate) ? fmtPct(v.reinvestmentRate, 0) : 'n/a'} of profit at a ${fmtPct(v.roic, 1)} return supports growth of about ${fmtPct(v.implied, 1)}, not the ${fmtPct(v.growth, 1)} assumed. Either the reinvestment or the growth rate needs revisiting.`,
      };
  }
}

export function warningTexts(r: ValuationResult): WarningText[] {
  return (r.warnings ?? []).map((w) => warningText(w, r));
}

/* ------------------------------------------------------------------------ */
/* Narrative                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The executive summary: a few paragraphs, each built by a fixed rule from the
 * results. Deterministic, so the same inputs always read the same.
 */
export function executiveSummary(r: ValuationResult): string[] {
  const c = r.currency;
  const h = headline(r);
  const out: string[] = [];

  out.push(
    `On the figures entered, the business has an indicative equity value of ${h.equityRange}, with a midpoint of ${h.midpoint} as at the end of ${h.valuationDate}. That rests on an enterprise value of ${h.evRange} and a cost of capital of ${h.wacc}.`,
  );

  // Method agreement: how far apart the DCF and comparables midpoints are.
  const dcfMid = r.dcfRange[1], compMid = r.compRange[1];
  const gap = Math.abs(dcfMid - compMid) / Math.max(Math.abs(dcfMid), Math.abs(compMid));
  const higher = dcfMid > compMid ? 'the DCF' : 'the comparables';
  if (Number.isFinite(gap)) {
    out.push(
      gap <= 0.15
        ? `The two methods agree closely: the DCF midpoint of ${fmtBig(dcfMid, c)} and the comparables midpoint of ${fmtBig(compMid, c)} are within ${fmtPct(gap, 0)} of each other, which gives the range some support.`
        : `The two methods diverge: ${higher} gives the higher value, and the DCF midpoint of ${fmtBig(dcfMid, c)} and the comparables midpoint of ${fmtBig(compMid, c)} differ by ${fmtPct(gap, 0)}. The blend weights the DCF at ${r.dcfWeight}%, so the forecast carries most of the answer.`,
    );
  }

  // Main drivers: the largest swings in the sensitivity and flex ranges.
  const growthSwing = r.hiG - r.loG;
  const drivers: [string, number][] = [
    ['the discount rate and long-term growth', growthSwing],
    ['the exit multiple', Number.isFinite(r.hiX - r.loX) ? r.hiX - r.loX : 0],
  ];
  if (r.scenarios?.length === 3) drivers.push(['the forecast growth and margin scenarios', r.scenarios[2].ev[1] - r.scenarios[0].ev[1]]);
  drivers.sort((a, b) => b[1] - a[1]);
  if (drivers[0][1] > 0) {
    out.push(
      `The value is most sensitive to ${drivers[0][0]}, which moves enterprise value across a range of ${fmtBig(drivers[0][1], c)}. The terminal value accounts for ${h.tvShare} of the DCF.`,
    );
  }

  if (h.weighted) {
    out.push(`Weighting the downside, base and upside scenarios by their probabilities gives an equity value of ${h.weighted}.`);
  }
  if (h.stakeRange && h.stakeLabel) {
    out.push(`For a ${h.stakeLabel}, the indicative value is ${h.stakeRange}.`);
  }

  const warnings = warningTexts(r);
  if (warnings.length) {
    out.push(
      `${warnings.length === 1 ? 'One check needs attention' : `${warnings.length} checks need attention`}: ${warnings.map((w) => w.title.toLowerCase()).join('; ')}. Each is explained with the assumptions.`,
    );
  } else {
    out.push('None of the consistency checks raised a warning.');
  }
  if (h.floorNote) out.push(h.floorNote);
  return out;
}

/**
 * "What would increase your value": points chosen by rule from the results and
 * the warnings, most material first. Always at least three.
 */
export function valueLevers(r: ValuationResult): { title: string; detail: string }[] {
  const c = r.currency;
  const out: { title: string; detail: string }[] = [];
  const q = r.ratios;
  const codes = new Set((r.warnings ?? []).map((w) => w.code));

  // Cost of capital: a one point lower WACC, from the flexed ranges.
  const waccUplift = r.hiG - r.base.evG;
  if (Number.isFinite(waccUplift) && waccUplift > 0) {
    out.push({
      title: 'Lower the risk a buyer prices in',
      detail: `A cost of capital about one point lower adds roughly ${fmtBig(waccUplift, c)} to the perpetuity growth value. Audited accounts, contracted revenue, customer diversification and a management team that does not depend on the owner are what bring it down.`,
    });
  }
  if (r.normalisation?.used) {
    out.push({
      title: 'Document the normalisation adjustments',
      detail: `Add-backs lift last year's EBITDA from ${fmtBig(r.ltmEbitdaReported, c)} to ${fmtBig(r.ltmEbitda, c)}. They only count if a buyer's diligence accepts them, so evidence each one.`,
    });
  } else {
    out.push({
      title: 'Review EBITDA for one-off and owner costs',
      detail: 'Costs that will not continue under a new owner, such as one-off legal fees or owner salaries above a market rate, can be added back to EBITDA. Every point of margin is multiplied into the comparables value.',
    });
  }
  if (Number.isFinite(q.fcfConversion) && q.fcfConversion < 0.5) {
    out.push({
      title: 'Convert more EBITDA into cash',
      detail: `Only ${fmtPct(q.fcfConversion, 0)} of forecast EBITDA becomes free cash flow. Tighter working capital and phased capital expenditure raise the DCF directly.`,
    });
  }
  if (codes.has('margin_jump') || codes.has('growth_ceiling') || codes.has('terminal_value_share')) {
    out.push({
      title: 'Make the forecast easier to believe',
      detail: 'Value that rests on a step change in margin, very high long-term growth or a large terminal value is the first thing a buyer discounts. Tie each forecast line to evidence: signed contracts, pipeline, pricing.',
    });
  }
  if (codes.has('roic_below_wacc')) {
    out.push({
      title: 'Improve returns before growing',
      detail: 'Returns are below the cost of capital, so growth on these terms reduces value. Pricing, mix and asset efficiency come before expansion.',
    });
  }
  if (Number.isFinite(q.ebitdaMarginTerminal) && q.ebitdaMarginTerminal < 0.15) {
    out.push({
      title: 'Build margin',
      detail: `A final year EBITDA margin of ${fmtPct(q.ebitdaMarginTerminal, 1)} leaves little room. Margin improvement raises both the DCF and the comparables value.`,
    });
  }
  out.push({
    title: 'Prepare for diligence early',
    detail: 'Clean monthly management accounts, a reconciled working capital history and a data room shorten a process and protect the price agreed at heads of terms.',
  });
  return out.slice(0, 6);
}

/** The sources, from the data module, for the methodology page. */
export function sourceNotes(): { label: string; source: string; asOf: string }[] {
  return SOURCE_NOTES;
}

export function growthCeilingFor(country: string): number | null {
  const c = (COUNTRIES as Record<string, { growthCeiling?: number }>)[country];
  return c?.growthCeiling ?? null;
}

export const WARNING_THRESHOLDS = WARNING_RULES;

/** Shown under the free cash flow table. States the engine's simplification on tax. */
export const TAX_NOTE =
  'Tax is applied to positive EBIT only. A loss in one year is not carried forward to reduce tax in later years.';

export const INDICATIVE_NOTE =
  'Indicative only. A formal valuation would test the forecast, normalise earnings, review working capital and debt-like items, and select comparable companies and transactions in detail.';

export const TOOL_DISCLAIMER =
  'This tool gives an indicative range only and is not a valuation opinion, financial or investment advice. PaceMakers Business Consultants LLP.';
