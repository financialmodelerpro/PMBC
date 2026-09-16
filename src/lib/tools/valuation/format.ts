/**
 * Presentation of a `ValuationResult`: number formats, the football field rows
 * and the wording that depends on the numbers.
 *
 * Shared by the results screen, the PDF report and the emails, so the three say
 * the same thing in the same format. The formats are the reference's.
 */

import type { Currency, EquityFloor, Range3, ValuationResult } from './engine';

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

export function currencyMillions(currency: Currency): string {
  return `${currency.code} millions`;
}

/** The headline figures, as shown at the top of the results and in the email. */
export function headline(r: ValuationResult) {
  const c = r.currency;
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
  };
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

export type FootballFieldRow = {
  key: 'dcf_growth' | 'dcf_exit' | 'comps_ebitda' | 'comps_revenue' | 'blended';
  label: string;
  sub: string;
  range: Range3 | null;
  blend: boolean;
};

export function footballFieldRows(r: ValuationResult): FootballFieldRow[] {
  const srcE = r.comps.peersE ? `Your ${r.comps.peersE} peers` : 'Preset';
  const srcR = r.comps.peersR ? `Your ${r.comps.peersR} peers` : 'Preset';
  return [
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
      sub: `${r.exitMultiple.toFixed(1)}x terminal EBITDA`,
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

export function bridgeTable(r: ValuationResult): Table {
  const m = (arr: number[]) => arr.map(fmtMillions);
  const nd = r.netDebt;
  return {
    head: [currencyMillions(r.currency), 'Low', 'Mid', 'High'],
    rows: [
      { label: 'DCF enterprise value', values: m(r.dcfRange) },
      { label: 'Comparables enterprise value', values: m(r.compRange) },
      { label: `Blended enterprise value (${r.dcfWeight}% DCF)`, values: m(r.ev) },
      { label: nd >= 0 ? 'Less net debt' : 'Add net cash', values: m([-nd, -nd, -nd]), tone: 'muted' },
      { label: 'Equity value', values: m(r.equity), tone: 'strong' },
    ],
  };
}

/** Shown under the free cash flow table. States the engine's simplification on tax. */
export const TAX_NOTE =
  'Tax is applied to positive EBIT only. A loss in one year is not carried forward to reduce tax in later years.';

export const INDICATIVE_NOTE =
  'Indicative only. A formal valuation would test the forecast, normalise earnings, review working capital and debt-like items, and select comparable companies and transactions in detail.';

export const TOOL_DISCLAIMER =
  'This tool gives an indicative range only and is not a valuation opinion, financial or investment advice. PaceMakers Business Consultants LLP.';
