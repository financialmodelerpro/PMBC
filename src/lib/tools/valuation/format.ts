/**
 * Presentation of a `ValuationResult`: number formats, labels, tables, notes,
 * checks and the rule-based narrative.
 *
 * Shared by the results dashboard, the PDF report, the emails and the admin
 * view, so all of them say the same thing in the same format. Every sentence
 * here is built from the result by fixed rules, never generated, and nothing
 * here computes a value: it rounds and words what the engine produced. The one
 * exception is a sum or difference printed purely to lay a table out, and the
 * reconciliation assertions (`reconcile.ts`) check those against the engine.
 *
 * Results stored before version 3 lack the canonical blocks. The functions the
 * admin lead view calls on stored results (`headline`, the tables and
 * `warningTexts`) still format them, from the fields they did have.
 */

import { COUNTRIES, SOURCE_NOTES, TAX, WARNING_RULES, formatDataDate } from './data';
import type {
  Check,
  Currency,
  EquityFloor,
  Range3,
  Recommendation,
  ValuationResult,
  Warning,
} from './engine';

/* ------------------------------------------------------------------------ */
/* Numbers                                                                   */
/* ------------------------------------------------------------------------ */

/** One decimal, thousands separators, negatives in brackets. A value that rounds to zero is "0.0", never "(0.0)". */
export function fmtMillions(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  if (Math.abs(v) < 0.05) return '0.0';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return v < 0 ? `(${s})` : s;
}

/** A ratio as a percentage. A value that rounds to zero carries no sign. */
export function fmtPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return 'n/a';
  const s = (v * 100).toFixed(digits);
  return (/^-0\.?0*$/.test(s) ? s.slice(1) : s) + '%';
}

/**
 * Amounts in words, short: "SAR 450k", "SAR 12.5m", "SAR 245m", "SAR 1.25bn" (since 17 September 2026;
 * "million" in full made the report heavy). Shared by the results page, the emails and the report.
 */
export function fmtBig(v: number, currency: Currency): string {
  if (!Number.isFinite(v)) return 'n/a';
  const a = Math.abs(v), s = v < 0 && a >= 0.0005 ? 'negative ' : '';
  // Under one million, thousands; a figure that rounds to zero stays in millions, as "SAR 0.0m".
  if (a < 1 && a >= 0.0005) return `${s}${currency.code} ${Math.round(a * 1000).toLocaleString('en-US')}k`;
  return a >= 1000
    ? `${s}${currency.code} ${(a / 1000).toFixed(2)}bn`
    : `${s}${currency.code} ${a.toFixed(a >= 100 ? 0 : 1)}m`;
}

export function fmtMultiple(v: number): string {
  return Number.isFinite(v) ? v.toFixed(1) + 'x' : 'n/a';
}

/** Percentage points, signed: "+3.0 pts", "-2.0 pts". */
export function fmtPoints(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  const s = Math.abs(v).toFixed(1);
  return `${v > 0 && s !== '0.0' ? '+' : v < 0 && s !== '0.0' ? '-' : ''}${s} pts`;
}

/** WACC, everywhere: two decimals. */
export function fmtWacc(v: number): string {
  return fmtPct(v, 2);
}

/** A growth rate on an axis: two decimals, so a half point never rounds away. */
export function fmtRate(v: number): string {
  return fmtPct(v, 2);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09-16" as "16 September 2026". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function currencyMillions(currency: Currency): string {
  return `${currency.code} millions`;
}

/**
 * The unit amounts are printed in. Millions, as entered, unless the business is
 * small enough that one decimal of a million would hide the figures (enterprise
 * value and revenue both under 10 million), when tables switch to thousands
 * with no decimals. Chosen once per result, so every table and chart agrees.
 */
export type AmountUnit = { scale: number; digits: number; label: string; short: string };

export function amountUnit(r: ValuationResult): AmountUnit {
  const code = r.currency.code;
  const size = Math.max(Math.abs(r.ev?.[2] ?? 0), Math.abs(r.ltmRevenue ?? 0));
  return Number.isFinite(size) && size < 10
    ? { scale: 1000, digits: 0, label: `${code} thousands`, short: `${code} thousand` }
    : { scale: 1, digits: 1, label: `${code} millions`, short: `${code} m` };
}

/** An amount held in millions, printed in the result's unit. Negatives in brackets; a value that rounds to zero carries no sign. */
export function fmtAmount(v: number, u: AmountUnit): string {
  if (!Number.isFinite(v)) return 'n/a';
  const x = v * u.scale;
  if (Math.abs(x) < 0.5 * Math.pow(10, -u.digits)) return (0).toFixed(u.digits);
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: u.digits, maximumFractionDigits: u.digits });
  return x < 0 ? `(${s})` : s;
}

/**
 * An amount in a table cell: the full figure in the result's unit, "SAR 385.2 million" (or
 * "SAR 4,250 thousand" for a small business, as the report's other tables). Short amounts
 * ("SAR 385m") are for headlines and sentences only.
 */
export function fmtTableAmount(r: ValuationResult, v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  const u = amountUnit(r);
  return `${r.currency.code} ${fmtAmount(v, u)} ${u.scale === 1 ? 'million' : 'thousand'}`;
}

/** Shorthand for the functions below, which all hold a result. */
function amt(r: ValuationResult, v: number): string {
  return fmtAmount(v, amountUnit(r));
}
function unitLabel(r: ValuationResult): string {
  return amountUnit(r).label;
}
function unitShort(r: ValuationResult): string {
  return amountUnit(r).short;
}

/** True when a result carries the version 3 blocks. Mirrors `isCanonicalResult` without a runtime import of the engine. */
function canonical(r: ValuationResult): boolean {
  return (r.schemaVersion ?? 0) >= 3 && Array.isArray(r.checks) && Boolean(r.dcfBlock && r.terminal && r.meta);
}

/** Version 2 fields read defensively, for results stored by version 1. */
function exitApplied(r: ValuationResult): number {
  return Number.isFinite(r.exitMultipleApplied) ? r.exitMultipleApplied : r.exitMultiple;
}

/* ------------------------------------------------------------------------ */
/* Labels. One wording for each concept, used on every surface.              */
/* ------------------------------------------------------------------------ */

export const LABELS = {
  baseCase: 'Base case',
  ltmMultiple: 'Implied EV / LTM EBITDA',
  impliedTerminalMultiple: 'Implied terminal multiple (perpetuity method)',
  tradingMultiples: 'Comparable trading multiples (before discount)',
  privateDiscount: 'Private company discount',
  multiplesAfterDiscount: 'Comparable multiples after discount',
  exitMultipleEntered: 'DCF exit multiple (before discount)',
  exitMultipleApplied: 'DCF exit multiple (after discount)',
  dcfPerpetuity: 'DCF, perpetuity growth',
  dcfExit: 'DCF, exit multiple',
  dcfCombined: 'DCF (average of perpetuity and exit multiple)',
  dcfPerpetuityOnly: 'DCF (perpetuity growth only)',
  factors: 'Factors that could support a higher valuation',
  tvShare: 'Terminal value share',
  weighted: 'Probability-weighted equity',
  wacc: 'WACC',
} as const;

export function dcfCombinedLabel(r: ValuationResult): string {
  return canonical(r) && r.dcfBlock.combination === 'perpetuity_only' ? LABELS.dcfPerpetuityOnly : LABELS.dcfCombined;
}

/** "Selected comparable companies (2)" or "Preset industry ranges". */
export function comparablesSource(r: ValuationResult, which: 'ebitda' | 'revenue' = 'ebitda'): string {
  const n = which === 'ebitda' ? r.comps.peersE : r.comps.peersR;
  return n ? `Selected comparable companies (${n})` : 'Preset industry ranges';
}

/* ------------------------------------------------------------------------ */
/* Headline                                                                  */
/* ------------------------------------------------------------------------ */

/** The headline figures, as shown at the top of the results, on the cover and in the email. */
export function headline(r: ValuationResult) {
  const c = r.currency;
  const stake = r.stake;
  const dated = canonical(r) && r.meta.valuationDate;
  return {
    equityRange: `${fmtBig(r.equityDisplay[0], c)} to ${fmtBig(r.equityDisplay[2], c)}`,
    /** The base case. Named midpoint for the email template variable it feeds. */
    midpoint: fmtBig(r.equityDisplay[1], c),
    evRange: `${fmtBig(r.ev[0], c)} to ${fmtBig(r.ev[2], c)}`,
    /** "16 September 2026", or "FY2025" for results stored before the valuation date existed. */
    valuationDate: dated ? fmtDate(r.meta.valuationDate as string) : `FY${r.years.history[2]}`,
    /** "Equity value as at 16 September 2026." */
    asAt: dated ? `as at ${fmtDate(r.meta.valuationDate as string)}` : `as at end of FY${r.years.history[2]}`,
    netDebtNote: canonical(r) ? netDebtSentence(r) : null,
    wacc: fmtWacc(r.wacc.wacc) + (c.pegged ? '' : ` ${c.code}`),
    tvShare: Number.isFinite(r.tvShare) ? fmtPct(r.tvShare, 0) : 'n/a',
    impliedExitMultiple: fmtMultiple(r.impliedExitMultiple),
    ltmMultiple: fmtMultiple(r.ltmMultiple),
    floorNote: equityFloorNote(r.equityFloor),
    weighted: Number.isFinite(r.weightedEquity) && r.scenarios?.length ? fmtBig(r.weightedEquity, c) : null,
    stakeRange: stake?.used ? `${fmtBig(stake.value[0], c)} to ${fmtBig(stake.value[2], c)}` : null,
    stakeLabel: stake?.used ? stakeLabel(r) : null,
    /** The same figures for table cells, in full: "SAR 385.2 million to SAR 412.0 million". */
    table: {
      equityRange: `${fmtTableAmount(r, r.equityDisplay[0])} to ${fmtTableAmount(r, r.equityDisplay[2])}`,
      midpoint: fmtTableAmount(r, r.equityDisplay[1]),
      evRange: `${fmtTableAmount(r, r.ev[0])} to ${fmtTableAmount(r, r.ev[2])}`,
      weighted: Number.isFinite(r.weightedEquity) && r.scenarios?.length ? fmtTableAmount(r, r.weightedEquity) : null,
      stakeRange: stake?.used ? `${fmtTableAmount(r, stake.value[0])} to ${fmtTableAmount(r, stake.value[2])}` : null,
    },
  };
}

/** How year end net debt was entered: as borrowings less cash from version 4, as a single figure before. */
export function enteredAs(r: ValuationResult): string {
  return r.debt !== null && r.debt !== undefined ? 'borrowings less cash' : 'as entered';
}

/** Where net debt comes from and the date it is at. The same sentence on the results, in the email and in the report. */
export function netDebtSentence(r: ValuationResult): string {
  const m = r.meta;
  const entered = `Net debt at ${fmtDate(m.lastFyEnd)}, ${enteredAs(r)}`;
  if (!(m.stubFraction > 0) || !m.valuationDate) return `${entered}.`;
  const interest = r.bridge.elapsedInterest ? ', plus after-tax interest on it for that period,' : '';
  return `${entered}, less free cash flow earned from then to ${fmtDate(m.valuationDate)}${interest} gives net debt at the valuation date.`;
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
      return 'Net debt exceeds enterprise value across the whole range, so equity value is shown as zero. The bridge shows the negative figures.';
    case 'low_and_mid':
      return 'Net debt exceeds enterprise value at the low end and the base case, so both are shown as zero. The bridge shows the negative figures.';
    case 'low':
      return 'Net debt exceeds enterprise value at the low end of the range, so the low end is shown as zero. The bridge shows the negative figure.';
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ */
/* Football field                                                            */
/* ------------------------------------------------------------------------ */

export type FootballFieldRow = {
  key: 'dcf_growth' | 'dcf_exit' | 'dcf_combined' | 'comps_ebit' | 'comps_ebitda' | 'comps_revenue' | 'blended' | 'scenarios';
  label: string;
  sub: string;
  /** Low, base case, high. The marker is always drawn at the base case. */
  range: Range3 | null;
  blend: boolean;
};

/** The five version 1 rows, in the reference's order. The verifier compares exactly these. */
export const REFERENCE_FOOTBALL_KEYS: FootballFieldRow['key'][] = ['dcf_growth', 'dcf_exit', 'comps_ebitda', 'comps_revenue', 'blended'];

export function footballFieldRows(r: ValuationResult): FootballFieldRow[] {
  const discount = r.privateDiscount ? `, after ${fmtPct(r.privateDiscount, 0)} discount` : '';
  const rows: FootballFieldRow[] = [
    {
      key: 'dcf_growth',
      label: LABELS.dcfPerpetuity,
      sub: `WACC ${fmtWacc(r.wacc.wacc)}, g ${fmtRate(r.growth)}`,
      range: [r.loG, r.base.evG, r.hiG],
      blend: false,
    },
    {
      key: 'dcf_exit',
      label: LABELS.dcfExit,
      sub: `${fmtMultiple(exitApplied(r))} final year EBITDA`,
      range: Number.isFinite(r.base.evX) ? [r.loX, r.base.evX, r.hiX] : null,
      blend: false,
    },
  ];
  if (canonical(r)) {
    rows.push({ key: 'dcf_combined', label: dcfCombinedLabel(r), sub: 'Used in the blend', range: r.dcfRange, blend: false });
  }
  rows.push(
    ...(canonical(r) && r.comparables.ebitValue
      ? ([
          {
            key: 'comps_ebit',
            label: 'Comparables, EV / EBIT',
            sub: `Selected comparable companies (${r.comparables.ebitPeerCount}); for reference, not used in the blend`,
            range: r.comparables.ebitValue,
            blend: false,
          },
        ] as FootballFieldRow[])
      : []),
    { key: 'comps_ebitda', label: 'Comparables, EV / EBITDA', sub: `${comparablesSource(r, 'ebitda')}${discount}`, range: r.compsEbitda, blend: false },
    {
      key: 'comps_revenue',
      label: 'Comparables, EV / Revenue',
      sub: r.compsEbitda ? 'For reference; not used in the blend' : `${comparablesSource(r, 'revenue')}${discount}`,
      range: r.compsRevenue,
      blend: false,
    },
    {
      key: 'blended',
      label: 'Blended',
      sub: `${r.dcfWeight}% DCF, ${100 - r.dcfWeight}% comparables`,
      range: r.ev,
      blend: true,
    },
  );
  // Scenarios, in enterprise value like every other row: downside, the base
  // case (the marker, as on every row), upside.
  if (r.scenarios?.length === 3) {
    const [down, base, up] = r.scenarios;
    rows.push({ key: 'scenarios', label: 'Scenarios', sub: 'Downside, base case, upside', range: [down.ev[1], base.ev[1], up.ev[1]], blend: false });
  }
  return rows;
}

/** Axis bounds and a position function for the football field, as the reference draws it. */
/** `scale` turns millions into the printed unit for the tick labels; 1 keeps millions. */
export function footballFieldScale(rows: FootballFieldRow[], scale = 1) {
  const all = rows.flatMap((row) => (row.range ? [row.range[0], row.range[2]] : [])).filter(Number.isFinite);
  const maxV = Math.max(...all) * 1.08, minV = Math.min(0, Math.min(...all));
  const span = maxV - minV;
  return {
    minV,
    maxV,
    pos: (v: number) => ((v - minV) / span) * 100,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round((minV + span * p) * scale).toLocaleString('en-US')),
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

/** "Less tax and zakat at 2.5%" in Saudi Arabia with GCC ownership, "Less tax at 20.0%" otherwise. */
export function taxRowLabel(r: ValuationResult): string {
  const method = canonical(r) ? r.tax.zakatMethod ?? (r.tax.gccOwnership > 0 ? 'profit_proxy' : 'none') : 'none';
  if (method === 'base') return 'Less tax and zakat';
  return `Less ${method === 'profit_proxy' ? 'tax and zakat' : 'tax'} at ${fmtPct(r.wacc.t, 1)}`;
}

/**
 * Free cash flow to the firm, the five forecast years and a terminal column
 * holding the normalised cash flow the perpetuity is built on. Rows the
 * terminal cash flow does not have (EBITDA, D&A) are left blank in that column,
 * and its capex row is net of D&A, which the table's note says.
 */
export function fcfTable(r: ValuationResult): Table {
  const m = (arr: number[]) => arr.map((v) => amt(r, v));
  if (!canonical(r)) {
    return {
      head: [unitLabel(r), ...r.years.forecast.map((y) => `FY${y} F`)],
      rows: [
        { label: 'Revenue', values: m(r.rows.map((x) => x.rev)) },
        { label: 'EBITDA', values: m(r.rows.map((x) => x.ebitda)) },
        { label: 'Less depreciation and amortisation', values: m(r.rows.map((x) => -x.da)), tone: 'muted' },
        { label: 'EBIT', values: m(r.rows.map((x) => x.ebit)) },
        { label: taxRowLabel(r), values: m(r.rows.map((x) => -x.tax)), tone: 'muted' },
        { label: 'Add back depreciation and amortisation', values: m(r.rows.map((x) => x.da)), tone: 'muted' },
        { label: 'Less capital expenditure', values: m(r.rows.map((x) => -x.capex)), tone: 'muted' },
        { label: 'Less increase in working capital', values: m(r.rows.map((x) => -x.dnwc)), tone: 'muted' },
        { label: 'Free cash flow to firm', values: m(r.rows.map((x) => x.fcf)), tone: 'strong' },
        { label: 'Discount factor', values: r.base.dfs.map((v) => v.toFixed(3)), tone: 'muted' },
        { label: 'Present value', values: m(r.rows.map((x, i) => x.fcf * r.base.dfs[i])) },
      ],
    };
  }
  const f = r.forecast, t = r.terminal;
  const normalised = t.method === 'normalised';
  const tc = (v: number) => (normalised ? amt(r, v) : '');
  const rows: TableRow[] = [
    { label: 'Revenue', values: [...m(f.map((x) => x.rev)), tc(t.revenue)] },
    { label: 'EBITDA', values: [...m(f.map((x) => x.ebitda)), ''] },
    { label: 'Less depreciation and amortisation', values: [...m(f.map((x) => -x.da)), ''], tone: 'muted' },
    { label: 'EBIT', values: [...m(f.map((x) => x.ebit)), tc(t.ebit)] },
    { label: taxRowLabel(r), values: [...m(f.map((x) => -x.tax)), tc(-t.tax)], tone: 'muted' },
    { label: 'Add back depreciation and amortisation', values: [...m(f.map((x) => x.da)), ''], tone: 'muted' },
    { label: 'Less capital expenditure', values: [...m(f.map((x) => -x.capex)), tc(-t.netCapex)], tone: 'muted' },
    { label: 'Less increase in working capital', values: [...m(f.map((x) => -x.dnwc)), tc(-t.dWc)], tone: 'muted' },
    { label: 'Free cash flow to firm', values: [...m(f.map((x) => x.fcf)), amt(r, t.fcf)], tone: 'strong' },
  ];
  if (r.meta.stubFraction > 0) {
    rows.push({ label: 'Free cash flow after the valuation date', values: [...m(f.map((x) => x.fcfValued)), ''] });
  }
  rows.push(
    { label: 'Discount period, years', values: [...f.map((x) => x.period.toFixed(2)), t.period.toFixed(2)], tone: 'muted' },
    { label: 'Discount factor', values: [...f.map((x) => x.df.toFixed(3)), t.df.toFixed(3)], tone: 'muted' },
    { label: 'Present value', values: [...m(f.map((x) => x.pv)), amt(r, t.pvPerpetuity)] },
  );
  return { head: [unitLabel(r), ...r.years.forecast.map((y) => `FY${y} F`), 'Terminal'], rows };
}

/** Under the FCFF table: how the perpetuity DCF adds up, and the exit multiple alternative. */
export function dcfSummaryRows(r: ValuationResult): [string, string][] {
  const t = r.terminal, d = r.dcfBlock;
  const rows: [string, string][] = [
    ['Present value of forecast free cash flow', amt(r, d.pvForecast)],
    ['Terminal value, perpetuity growth', amt(r, t.tvPerpetuity)],
    ['Present value of terminal value', amt(r, t.pvPerpetuity)],
    ['DCF enterprise value, perpetuity growth', amt(r, d.perpetuity[1])],
    [LABELS.impliedTerminalMultiple, fmtMultiple(t.impliedMultiple)],
    [`${LABELS.tvShare}, perpetuity growth`, fmtPct(t.tvShare, 0)],
  ];
  if (d.exit) {
    rows.push(
      [`Terminal value, exit multiple of ${fmtMultiple(exitApplied(r))}`, amt(r, t.tvExit)],
      ['DCF enterprise value, exit multiple', amt(r, d.exit[1])],
    );
  }
  rows.push([dcfCombinedLabel(r), amt(r, d.combined[1])]);
  return rows;
}

export function sensitivityTitle(r: ValuationResult): string {
  return `Equity value, perpetuity growth DCF (${unitShort(r)})`;
}

/** Rows are WACC, columns are growth. The centre cell is the base case. */
export function sensitivityTable(r: ValuationResult): Table {
  return {
    head: ['WACC \\ growth', ...r.sensitivity.growths.map(fmtRate)],
    rows: r.sensitivity.grid.map((row, i) => ({
      label: fmtWacc(r.sensitivity.waccs[i]),
      values: row.map((v) => amt(r, v)),
    })),
  };
}

/**
 * Enterprise to equity, low, base case and high. Other bridge items appear only
 * when entered, so a valuation without them has only net debt between the two.
 */
export function bridgeTable(r: ValuationResult): Table {
  const m = (arr: number[]) => arr.map((v) => amt(r, v));
  const nd = r.netDebt;
  const b = r.bridge;
  const three = (v: number) => m([v, v, v]);
  const compsLabel = r.compsEbitda ? 'Comparables enterprise value, EV / EBITDA' : 'Comparables enterprise value, EV / Revenue';
  const rows: TableRow[] = [
    { label: canonical(r) ? `${dcfCombinedLabel(r)}, enterprise value` : 'DCF enterprise value', values: m(r.dcfRange) },
    { label: canonical(r) ? compsLabel : 'Comparables enterprise value', values: m(r.compRange) },
    { label: `Blended enterprise value (${r.dcfWeight}% DCF, ${100 - r.dcfWeight}% comparables)`, values: m(r.ev), tone: 'strong' },
    {
      label: canonical(r) ? `${nd >= 0 ? 'Less net debt' : 'Add net cash'} at ${fmtDate(r.meta.lastFyEnd)}, ${enteredAs(r)}` : nd >= 0 ? 'Less net debt' : 'Add net cash',
      values: m([-nd, -nd, -nd]),
      tone: 'muted',
    },
  ];
  const elapsed = b?.elapsedFcf ?? 0;
  if (canonical(r) && elapsed) {
    rows.push({ label: `${elapsed >= 0 ? 'Add' : 'Less'} free cash flow from ${fmtDate(r.meta.lastFyEnd)} to the valuation date`, values: three(elapsed), tone: 'muted' });
  }
  const interest = b?.elapsedInterest ?? 0;
  if (canonical(r) && interest) {
    rows.push({ label: 'Less after-tax interest on net debt for that period', values: three(-interest), tone: 'muted' });
  }
  if (b?.eosb) rows.push({ label: 'Less end of service benefits', values: three(-b.eosb), tone: 'muted' });
  if (b?.leases) rows.push({ label: 'Less lease liabilities', values: three(-b.leases), tone: 'muted' });
  if (b?.minorityInterest) rows.push({ label: 'Less minority interest', values: three(-b.minorityInterest), tone: 'muted' });
  if (b?.surplusAssets) rows.push({ label: 'Add surplus assets and investments', values: three(b.surplusAssets), tone: 'muted' });
  rows.push({ label: 'Equity value', values: m(r.equity), tone: 'strong' });
  return { head: [unitLabel(r), 'Low', LABELS.baseCase, 'High'], rows };
}

/** Pre-money and post-money, when a raise amount was entered. */
export function raiseTable(r: ValuationResult): Table | null {
  if (!canonical(r) || !r.raise) return null;
  const x = r.raise;
  return {
    head: [unitLabel(r), 'Low', LABELS.baseCase, 'High'],
    rows: [
      { label: 'Pre-money equity value', values: x.preMoney.map((v) => amt(r, v)) },
      { label: 'Add amount raised', values: [x.amount, x.amount, x.amount].map((v) => amt(r, v)), tone: 'muted' },
      { label: 'Post-money equity value', values: x.postMoney.map((v) => amt(r, v)), tone: 'strong' },
      { label: 'Investor stake after the raise', values: x.investorStake.map((v) => fmtPct(v, 1)) },
    ],
  };
}

export const PRE_MONEY_NOTE = 'Values shown are pre-money.';

/** The steps of the value bridge at the base case, for the waterfall chart. */
export type BridgeStep = { label: string; value: number; kind: 'total' | 'add' | 'less' };

export function bridgeSteps(r: ValuationResult): BridgeStep[] {
  const b = r.bridge;
  const steps: BridgeStep[] = [{ label: 'Enterprise value', value: r.ev[1], kind: 'total' }];
  steps.push({ label: r.netDebt >= 0 ? 'Net debt' : 'Net cash', value: -r.netDebt, kind: r.netDebt >= 0 ? 'less' : 'add' });
  const elapsed = b?.elapsedFcf ?? 0;
  if (elapsed) steps.push({ label: 'Cash flow since year end', value: elapsed, kind: elapsed >= 0 ? 'add' : 'less' });
  const interest = b?.elapsedInterest ?? 0;
  if (interest) steps.push({ label: 'Interest since year end', value: -interest, kind: 'less' });
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
  const ic = r.investedCapital;
  if (ic) {
    rows.push({
      label: 'Invested capital, last actual year',
      values: [ic.fixedAssets !== null ? `${amt(r, ic.total)} ${unitShort(r)} (working capital ${amt(r, ic.workingCapital ?? 0)} plus fixed assets ${amt(r, ic.fixedAssets)})` : `${amt(r, ic.total)} ${unitShort(r)}`],
    });
  }
  return { head: ['Ratio', 'Value'], rows };
}

/** The six ratios beside the financial profile chart in the report. */
export function profileRatios(r: ValuationResult): [string, string][] {
  const q = r.ratios;
  return [
    ['Revenue CAGR, actual years', fmtPct(q.revenueCagrHistory, 1)],
    ['Revenue CAGR, forecast', fmtPct(q.revenueCagrForecast, 1)],
    [r.normalisation?.used ? 'EBITDA margin, last actual (normalised)' : 'EBITDA margin, last actual', fmtPct(q.ebitdaMarginLtm, 1)],
    ['EBITDA margin, final forecast year', fmtPct(q.ebitdaMarginTerminal, 1)],
    ['Capex intensity, forecast average', fmtPct(q.capexIntensity, 1)],
    ['Free cash flow conversion of EBITDA', fmtPct(q.fcfConversion, 0)],
  ];
}

/**
 * Downside, base and upside with their adjustments, probabilities and base case
 * values, then the probability-weighted total. Equity is shown before the floor
 * at zero, so each column adds up to the weighted row.
 */
export function scenariosTable(r: ValuationResult): Table {
  const c = r.currency;
  const names = { downside: 'Downside', base: 'Base', upside: 'Upside' } as const;
  const rows: TableRow[] = (r.scenarios ?? []).map((s) => ({
    label: names[s.key],
    values: [
      s.key === 'base' ? 'As entered' : fmtPoints(s.growthPoints),
      s.key === 'base' ? 'As entered' : fmtPoints(s.marginPoints),
      fmtPct(s.weight, 0),
      amt(r, s.terminalRevenue),
      amt(r, s.ev[1]),
      amt(r, s.equity[1]),
    ],
  }));
  if (Number.isFinite(r.weightedEquity) && r.scenarios?.length) {
    const raw = Number.isFinite(r.weightedEquityRaw) ? r.weightedEquityRaw : r.weightedEquity;
    const weightedEv = r.scenarios.reduce((a, s) => a + s.weight * s.ev[1], 0);
    const total = Number.isFinite(r.weightsTotal) ? r.weightsTotal : r.scenarios.reduce((a, s) => a + s.weight, 0);
    rows.push({ label: 'Probability-weighted', values: ['', '', fmtPct(total, 0), '', amt(r, weightedEv), amt(r, raw)], tone: 'strong' });
  }
  return {
    head: ['Scenario', 'Growth', 'Margin', 'Probability', `Final year revenue, ${unitShort(r)}`, `EV, ${unitShort(r)}`, `Equity, ${unitShort(r)}`],
    rows,
  };
}

/** The cost of capital build, as label and value pairs. */
export function waccBuildRows(r: ValuationResult): [string, string][] {
  const w = r.wacc;
  const zakat = canonical(r) && r.tax.zakatApplies && r.tax.gccOwnership > 0;
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
    [zakat ? 'Income tax rate, non-GCC share' : 'Tax rate', fmtPct(w.t, 1)],
    ['After-tax cost of debt', fmtPct(w.kdt)],
    ['Equity weight', fmtPct(w.we, 1)],
    ['Debt weight', fmtPct(w.wd, 1)],
  ];
  if (!r.currency.pegged) rows.push(['WACC in US dollars', fmtWacc(w.waccUsd)]);
  if (w.adjustment) rows.push(['Adjustment (exploration)', fmtPoints(w.adjustment * 100)]);
  return rows;
}

/** Terminal value assumptions, as label and value pairs. */
export function terminalRows(r: ValuationResult): [string, string][] {
  const rows: [string, string][] = [
    ['Long-term growth', fmtRate(r.growth)],
    [LABELS.exitMultipleEntered, fmtMultiple(r.exitMultiple)],
  ];
  if (r.privateDiscount) rows.push([LABELS.exitMultipleApplied, fmtMultiple(exitApplied(r))]);
  if (canonical(r)) {
    rows.push([LABELS.impliedTerminalMultiple, fmtMultiple(r.terminal.impliedMultiple)]);
    if (r.terminal.method === 'normalised') {
      rows.push(['Terminal free cash flow (normalised)', `${amt(r, r.terminal.fcf)} ${unitShort(r)}`]);
      rows.push(['Terminal reinvestment rate', Number.isFinite(r.terminal.reinvestmentRate) ? fmtPct(r.terminal.reinvestmentRate, 0) : 'Not meaningful']);
      rows.push(['Implied terminal ROIC', Number.isFinite(r.terminal.impliedRoic) ? fmtPct(r.terminal.impliedRoic, 1) : 'Not meaningful (no reinvestment)']);
    }
  }
  rows.push(['Discounting', r.midYear ? 'Mid-year convention' : 'End of year']);
  rows.push(['Weight on DCF', `${r.dcfWeight}%`]);
  return rows;
}

/** Comparables: the five concepts kept apart, and the companies by name. */
export function comparablesRows(r: ValuationResult): [string, string][] {
  const list = (v: Range3) => v.map(fmtMultiple).join(', ');
  const rows: [string, string][] = [
    ['Source', comparablesSource(r, r.compsEbitda ? 'ebitda' : 'revenue')],
  ];
  if (canonical(r)) {
    const cp = r.comparables;
    rows.push(
      ['Trading multiples, EV / EBITDA', list(cp.ebitdaMultiplesPre)],
      [LABELS.privateDiscount, fmtPct(cp.discount, 0)],
      ['After discount, EV / EBITDA', list(cp.ebitdaMultiplesPost)],
      ['After discount, EV / Revenue', list(cp.revenueMultiplesPost)],
    );
    if (cp.ebitMultiplesPost) rows.push(['After discount, EV / EBIT (reference)', list(cp.ebitMultiplesPost)]);
    if (cp.peerNames.length) rows.push([`Companies (${cp.peerNames.length})`, cp.peerNames.join(', ')]);
  } else {
    rows.push(['EV / EBITDA used', list(r.comps.ebitda)], ['EV / Revenue used', list(r.comps.revenue)]);
  }
  return rows;
}

export function normalisationRows(r: ValuationResult): [string, string][] {
  const nrm = r.normalisation;
  if (!nrm?.used) return [];
  return [
    ['Reported EBITDA, last actual year', amt(r, r.ltmEbitdaReported)],
    ['Add back one-off costs', amt(r, nrm.oneOff)],
    ['Add back owner costs above market', amt(r, nrm.ownerCosts)],
    ['Normalised EBITDA', amt(r, r.ltmEbitda)],
    ['Owner cost add-back in forecast years', nrm.carryOwnerCosts ? 'Yes' : 'No'],
  ];
}

/** Tax, zakat and losses. */
export function taxRows(r: ValuationResult): [string, string][] {
  const t = r.tax;
  const rows: [string, string][] = [['Corporate income tax rate', fmtPct(t.cit, 1)]];
  if (t.zakatApplies) rows.push(['Saudi / GCC ownership', fmtPct(t.gccOwnership, 0)]);
  if (t.zakatMethod === 'base' && t.zakatBaseLtm) {
    const u = unitShort(r);
    rows.push(
      ['Zakat', `${fmtPct(t.zakatRate, 1)} of zakat base`],
      ['Working capital, year end', `${amt(r, t.zakatBaseLtm.workingCapital)} ${u}`],
      ['Add cash, year end', t.zakatBaseLtm.cash === null ? 'Not entered' : `${amt(r, t.zakatBaseLtm.cash)} ${u}`],
      ['Zakat base (approximate)', `${amt(r, t.zakatBaseLtm.base)} ${u}`],
      [`Zakat, FY${r.years.forecast[0]} to FY${r.years.forecast[4]}`, `${amt(r, t.zakatByYear[0])} to ${amt(r, t.zakatByYear[4])} ${u}`],
      ['Income tax rate, non-GCC share', fmtPct(t.rate, 2)],
    );
  } else if (t.zakatMethod === 'profit_proxy') {
    rows.push(['Zakat', `${fmtPct(t.zakatRate, 1)} of profit (fallback)`], ['Effective rate on positive EBIT', fmtPct(t.rate, 2)]);
  } else {
    rows.push(['Effective rate on positive EBIT', fmtPct(t.rate, 2)]);
  }
  rows.push(['Losses carried forward', t.lossCarryForward ? `Capped at ${fmtPct(t.lossOffsetCap, 0)} of profit` : 'No']);
  if (t.lossesUsed > 0) rows.push(['Losses used in the forecast', `${amt(r, t.lossesUsed)} ${unitShort(r)}`]);
  return rows;
}

/** Valuation date and stub period. */
export function timingRows(r: ValuationResult): [string, string][] {
  const m = r.meta;
  return [
    ['Valuation date', m.valuationDate ? fmtDate(m.valuationDate) : 'End of the last actual year'],
    ['Last actual year end (assumed)', fmtDate(m.lastFyEnd)],
    ['Stub period', m.stubFraction > 0 ? `${m.stubMonths.toFixed(1)} months elapsed` : 'None'],
    ...(r.debt !== null && r.debt !== undefined
      ? ([
          ['Borrowings, year end', `${amt(r, r.debt)} ${unitShort(r)}`],
          ['Cash, year end', `${amt(r, r.cash ?? 0)} ${unitShort(r)}`],
          ['Net debt at year end (borrowings less cash)', `${amt(r, r.netDebt)} ${unitShort(r)}`],
        ] as [string, string][])
      : ([['Net debt at year end (entered)', `${amt(r, r.netDebt)} ${unitShort(r)}`]] as [string, string][])),
    ...(m.stubFraction > 0
      ? ([
          ['Cash flow since year end', `${amt(r, r.bridge.elapsedFcf ?? 0)} ${unitShort(r)}`],
          ...(r.bridge.elapsedInterest ? ([['After-tax interest since year end', `${amt(r, r.bridge.elapsedInterest)} ${unitShort(r)}`]] as [string, string][]) : []),
          ['Net debt at valuation date', `${amt(r, r.bridge.netDebtAtValuationDate ?? r.netDebt)} ${unitShort(r)}`],
        ] as [string, string][])
      : []),
  ];
}

/* ------------------------------------------------------------------------ */
/* Notes and disclosures                                                     */
/* ------------------------------------------------------------------------ */

export const TERMINAL_NOTE = 'Terminal cash flow reflects reinvestment at long-term growth.';

/** The terminal value note for a result, including one valued under the method used before 17 September 2026. */
export function terminalNote(r: ValuationResult): string {
  return canonical(r) && r.terminal.method === 'normalised'
    ? `${TERMINAL_NOTE} ${TERMINAL_COLUMN_NOTE}`
    : 'Terminal value grows the final forecast year’s free cash flow at long-term growth, the method used for valuations before 17 September 2026.';
}
export const TERMINAL_COLUMN_NOTE = 'In the terminal column, capital expenditure is shown net of depreciation and amortisation.';
/** A zakat rate for prose: "2.5%", or "3%" for a whole number. */
const zakatPct = (ratio: number) => `${Number((ratio * 100).toFixed(2))}%`;

/** The zakat base note at the rate used. */
export function zakatBaseNote(r: ValuationResult): string {
  return ZAKAT_BASE_NOTE.replace(`${TAX.zakatRate}%`, zakatPct(r.tax.zakatRate));
}

/** The zakat fallback note at the rate used. */
export function zakatFallbackNote(r: ValuationResult): string {
  return ZAKAT_FALLBACK_NOTE.replace(`${TAX.zakatRate}%`, zakatPct(r.tax.zakatRate));
}

export const ZAKAT_BASE_NOTE = `Zakat is ${TAX.zakatRate}% of an approximate zakat base on the Saudi / GCC owned share: working capital plus cash, floored at zero, with cash held at its year end level through the forecast.`;
export const ZAKAT_NO_CASH_NOTE = 'Cash was not entered, so the base is working capital alone and may be understated.';
export const ZAKAT_FALLBACK_NOTE = `Invested capital was not entered, so the zakat base cannot be estimated; zakat is instead approximated as ${TAX.zakatRate}% of profit on the Saudi / GCC owned share.`;
export const FINANCIAL_YEAR_END_NOTE = 'Financial years are assumed to end on 31 December.';
export const VALUATION_DATE_NOTE = 'Cash flow is valued from the valuation date. The elapsed part of the first forecast year uses forecast free cash flow, not actual results, and is assumed kept in the business (no distributions). Net debt at the valuation date is the year end figure, less that cash flow, plus after-tax interest on it at the cost of debt.';

/** Shown under the free cash flow table. */
export function taxNote(r: ValuationResult): string {
  if (!canonical(r) || !r.tax.lossCarryForward) return 'Tax is applied to positive EBIT only. A loss in one year is not carried forward to reduce tax in later years.';
  const t = r.tax;
  const losses = `Income tax is applied to positive EBIT. Losses are carried forward and offset up to ${fmtPct(t.lossOffsetCap, 0)} of each later year’s taxable profit.`;
  if (t.zakatMethod === 'base') return `${losses} Zakat is charged on an approximate zakat base; see the assumptions.`;
  if (t.zakatMethod === 'profit_proxy') return `${losses} ${zakatFallbackNote(r)}`;
  return losses;
}

/** The disclosure lines, each only when it applies. */
export function disclosures(r: ValuationResult): {
  evRevenue: string | null;
  scenarios: string;
  exitMultiple: string;
  premiumAndDiscount: string | null;
  financialYearEnd: string;
  zakat: string | null;
  valuationDate: string | null;
} {
  const method = canonical(r) ? r.tax.zakatMethod : 'none';
  return {
    financialYearEnd: FINANCIAL_YEAR_END_NOTE,
    zakat: method === 'base' ? (r.tax.zakatBaseLtm?.cash === null ? `${zakatBaseNote(r)} ${ZAKAT_NO_CASH_NOTE}` : zakatBaseNote(r)) : method === 'profit_proxy' ? zakatFallbackNote(r) : null,
    valuationDate: canonical(r) && r.meta.stubFraction > 0 ? VALUATION_DATE_NOTE : null,
    evRevenue: r.ltmEbitda > 0 ? 'EV / Revenue shown for reference; not used in the blend.' : null,
    scenarios: 'Scenarios flex the DCF; comparables use the last actual year.',
    exitMultiple: 'Exit multiple applies current comparable multiples to the final forecast year.',
    premiumAndDiscount: r.wacc.sp > 0 && r.privateDiscount > 0 ? 'A size premium and a private company discount are both applied.' : null,
  };
}

/* ------------------------------------------------------------------------ */
/* Checks                                                                    */
/* ------------------------------------------------------------------------ */

export type WarningText = { code: string; title: string; detail: string };

/** Every check, Pass and Warning. Results stored before version 3 list their warnings only. */
export function checkItems(r: ValuationResult): Check[] {
  if (canonical(r)) return r.checks;
  return (r.warnings ?? []).map((w) => {
    const t = warningText(w, r);
    return { id: 'growth_ceiling', label: t.title, status: 'warning', message: t.detail, values: w.values } as Check;
  });
}

/** The checks that raised a warning, as title and detail. */
export function warningTexts(r: ValuationResult): WarningText[] {
  if (canonical(r)) return r.checks.filter((c) => c.status === 'warning').map((c) => ({ code: c.id, title: c.label, detail: c.message }));
  return (r.warnings ?? []).map((w) => warningText(w, r));
}

/** The wording of a version 2 warning, for leads stored before version 3. */
export function warningText(w: Warning, r: ValuationResult): WarningText {
  const v = w.values;
  switch (w.code) {
    case 'terminal_value_share':
      return { code: w.code, title: 'Most of the value sits beyond the forecast', detail: `The terminal value is ${fmtPct(v.share, 0)} of the DCF, above ${fmtPct(v.threshold, 0)}.` };
    case 'growth_ceiling':
      return { code: w.code, title: 'Long-term growth is high for the currency', detail: `Growth of ${fmtPct(v.growth, 1)} for ever is above ${fmtPct(v.ceiling, 1)} in ${r.currency.code}.` };
    case 'exit_multiple_mismatch':
      return { code: w.code, title: 'The two terminal value methods disagree', detail: `The exit multiple used is ${fmtMultiple(v.applied)}, but perpetuity growth implies ${fmtMultiple(v.implied)}.` };
    case 'terminal_fcf_negative':
      return { code: w.code, title: 'Free cash flow is negative in the final year', detail: `The final forecast year's free cash flow is ${amt(r, v.fcf)} ${unitLabel(r)}.` };
    case 'margin_jump':
      return { code: w.code, title: 'The forecast margin jumps from the last actual year', detail: `EBITDA margin moves from ${fmtPct(v.from, 1)} to ${fmtPct(v.to, 1)} in the first forecast year.` };
    case 'roic_below_wacc':
      return { code: w.code, title: 'Returns are below the cost of capital', detail: `Return on invested capital of ${fmtPct(v.roic, 1)} is below the WACC of ${fmtWacc(v.wacc)}.` };
    case 'growth_vs_inflation':
      return {
        code: w.code,
        title: v.growth < v.low ? 'Long-term growth is below inflation' : 'Long-term growth is well above inflation',
        detail: `Growth of ${fmtPct(v.growth, 1)} against expected inflation of ${fmtPct(v.inflation, 1)} in ${r.currency.code}.`,
      };
    case 'premium_on_minority_stake':
      return { code: w.code, title: 'A control premium on a stake without control', detail: `A ${+v.percent.toFixed(2)}% stake does not carry control.` };
    case 'reinvestment_inconsistent':
      return { code: w.code, title: 'Growth and reinvestment do not line up', detail: `Reinvestment supports growth of about ${fmtPct(v.implied, 1)}, not the ${fmtPct(v.growth, 1)} assumed.` };
  }
}

/* ------------------------------------------------------------------------ */
/* Narrative                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The executive summary: short paragraphs, each built by a fixed rule from the
 * result. Deterministic, so the same inputs always read the same. Covers the
 * two methods, the weighting, the key sensitivity, the terminal value share,
 * the scenarios and the number of warnings.
 */
export function executiveSummary(r: ValuationResult): string[] {
  const c = r.currency;
  const h = headline(r);
  const out: string[] = [];

  out.push(
    `On the figures entered, the business has an indicative equity value of ${h.equityRange}, with a base case of ${h.midpoint} ${h.asAt}. That rests on an enterprise value of ${h.evRange} and a WACC of ${h.wacc}.`,
  );

  const dcfBase = r.dcfRange[1], compBase = r.compRange[1];
  const gap = compBase > 0 ? Math.abs(dcfBase / compBase - 1) : NaN;
  const higher = dcfBase > compBase ? 'the DCF' : 'the comparables method';
  const weighting = `The blend weights the DCF at ${r.dcfWeight}%${r.dcfWeight > 50 ? ', so the forecast carries most of the answer' : ''}.`;
  if (Number.isFinite(gap)) {
    out.push(
      gap <= WARNING_RULES.methodDivergence
        ? `The two methods agree: the DCF base case of ${fmtBig(dcfBase, c)} and the comparables base case of ${fmtBig(compBase, c)} are within ${fmtPct(gap, 0)} of each other. ${weighting}`
        : `The two methods diverge: ${higher} gives the higher value, and the DCF base case of ${fmtBig(dcfBase, c)} and the comparables base case of ${fmtBig(compBase, c)} differ by ${fmtPct(gap, 0)}. ${weighting}`,
    );
  }

  const lever = waccLeverFromSensitivity(r);
  const tv = Number.isFinite(r.tvShare) ? ` The terminal value is ${h.tvShare} of the perpetuity DCF.` : '';
  if (lever) {
    out.push(
      `In the sensitivity table, a WACC one point lower at the same growth moves perpetuity DCF equity from ${fmtBig(lever.from, c)} to ${fmtBig(lever.to, c)}.${tv}`,
    );
  } else if (tv) {
    out.push(tv.trim());
  }

  if (h.weighted && r.scenarios?.length === 3) {
    const [down, , up] = r.scenarios;
    out.push(
      `The downside and upside scenarios give equity of ${fmtBig(down.equityDisplay[1], c)} and ${fmtBig(up.equityDisplay[1], c)}; weighted by probability, ${h.weighted}.`,
    );
  }
  if (h.stakeRange && h.stakeLabel) out.push(`For a ${h.stakeLabel}, the indicative value is ${h.stakeRange}.`);

  const items = checkItems(r);
  const warnings = items.filter((x) => x.status === 'warning');
  out.push(
    warnings.length === 0
      ? `All ${items.length} checks passed.`
      : `${warnings.length} of ${items.length} checks ${warnings.length === 1 ? 'raises a warning' : 'raise warnings'}: ${warnings.map((w) => w.label).join('; ')}. Each is set out with the assumptions.`,
  );
  if (h.floorNote) out.push(h.floorNote);
  return out;
}

/**
 * The cells of the sensitivity table behind the cost of capital point: the
 * centre (WACC and growth as used) and one point lower WACC at the same growth.
 * Null when either cell is not finite or the lower WACC does not add value.
 */
export function waccLeverFromSensitivity(r: ValuationResult): { from: number; to: number; uplift: number } | null {
  const s = r.sensitivity;
  if (!s) return null;
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const gi = s.growths.findIndex((g) => close(g, r.growth));
  const wi = s.waccs.findIndex((w) => close(w, r.wacc.wacc));
  const wl = s.waccs.findIndex((w) => close(w, r.wacc.wacc - 0.01));
  if (gi < 0 || wi < 0 || wl < 0) return null;
  const from = s.grid[wi][gi], to = s.grid[wl][gi];
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
  return { from, to, uplift: to - from };
}

/** The wording of one factor that could support a higher valuation. Never promises an increase. */
export function recommendationText(rec: Recommendation, r: ValuationResult): { title: string; detail: string } {
  const c = r.currency;
  const v = rec.values;
  switch (rec.id) {
    case 'reduce_risk':
      return {
        title: 'Reduce the risk a buyer prices in',
        detail: `In the sensitivity table, a WACC one point lower at the same growth corresponds to perpetuity DCF equity of ${amt(r, v.to)} rather than ${amt(r, v.from)} ${unitLabel(r)}. Audited accounts, contracted revenue, a diversified customer base and a management team that does not depend on the owner can reduce perceived risk.`,
      };
    case 'review_normalisation':
      return {
        title: 'Review EBITDA for one-off and owner costs',
        detail: 'Costs that will not continue under a new owner, such as one-off legal fees or owner salaries above a market rate, could support a higher EBITDA if they are evidenced. The comparables value moves with it.',
      };
    case 'evidence_normalisation':
      return {
        title: 'Evidence the normalisation adjustments',
        detail: `Add-backs take last year’s EBITDA from ${fmtBig(v.reported, c)} to ${fmtBig(v.normalised, c)}. They count only if a buyer’s diligence accepts them, so documenting each one may improve how much of them is recognised.`,
      };
    case 'cash_conversion':
      return {
        title: 'Convert more EBITDA into cash',
        detail: `${fmtPct(v.conversion, 0)} of forecast EBITDA becomes free cash flow. Tighter working capital and phased capital expenditure could support a higher DCF value.`,
      };
    case 'forecast_credibility':
      return {
        title: 'Make the forecast easier to rely on',
        detail: 'A step up in margin, high long-term growth or a large terminal value is the first thing a buyer tests. Tying each forecast line to evidence, such as signed contracts, pipeline and pricing, may improve how much of the forecast is credited.',
      };
    case 'returns':
      return {
        title: 'Improve returns before growing',
        detail: `${v.terminal ? 'The return on new capital the terminal value implies' : 'Return on invested capital'}, ${fmtPct(v.roic, 1)}, is below the WACC of ${fmtWacc(v.wacc)}. Pricing, mix and asset efficiency could support value more than expansion on these terms.`,
      };
    case 'margin':
      return {
        title: 'Build margin',
        detail: `A final year EBITDA margin of ${fmtPct(v.margin, 1)} leaves little room. Margin improvement could support both the DCF and the comparables value.`,
      };
    case 'diligence':
      return {
        title: 'Prepare for diligence early',
        detail: 'Clean monthly management accounts, a reconciled working capital history and an organised data room can shorten a process and may help protect the price agreed at heads of terms.',
      };
  }
}

/**
 * Factors that could support a higher valuation, as selected by the engine.
 * Results stored before version 3 have no selection and list none.
 */
export function valueLevers(r: ValuationResult): { title: string; detail: string }[] {
  return (r.recommendations ?? []).map((rec) => recommendationText(rec, r));
}

/** The sources, from the data module, for the methodology page. */
export function sourceNotes(): { label: string; source: string; asOf: string }[] {
  return SOURCE_NOTES;
}

/** Market data dates as the report states them. */
export function marketDataLine(r: ValuationResult): string {
  const m = r.meta;
  const rf = `US 10-year Treasury ${fmtPct(m.treasury.value / 100)} (${formatDataDate(m.treasury.asOf)})`;
  const erp = `implied equity risk premium ${fmtPct(m.erp.value / 100)} (${formatDataDate(m.erp.asOf)}${m.erpAligned ? '' : ', latest available'})`;
  return `${rf}; ${erp}.`;
}

export function growthCeilingFor(country: string): number | null {
  const c = (COUNTRIES as Record<string, { growthCeiling?: number }>)[country];
  return c?.growthCeiling ?? null;
}

export const WARNING_THRESHOLDS = WARNING_RULES;

export const INDICATIVE_NOTE =
  'Indicative only. A formal valuation would test the forecast, normalise earnings, review working capital and debt-like items, and select comparable companies and transactions in detail.';

export const TOOL_DISCLAIMER =
  'This tool gives an indicative range only and is not a valuation opinion, financial or investment advice. PaceMakers Business Consultants LLP.';

export const RELIANCE_STATEMENT =
  'The figures in this report were calculated from the inputs entered and published market data. They have not been reviewed by PaceMakers and should not be relied on for a transaction, a financing, or a tax or accounting purpose.';
