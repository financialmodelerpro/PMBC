/**
 * The Business Valuation engine. Pure functions, no UI, no I/O.
 *
 * The browser runs it to show results, and the lead API runs it again on the
 * submitted inputs, so what is stored and emailed never depends on numbers a
 * browser sent. The PDF is rendered from the server's run.
 *
 * The arithmetic is a line-for-line port of the reference implementation at
 * `reference/tools/business-valuation.html`, including its order of operations,
 * so the two agree to floating-point precision. `npm run verify-valuation-engine`
 * holds it to that by running the reference in headless Chrome. Two behaviours
 * were changed on purpose and are marked CHANGED below.
 *
 * Units: rates arrive as percent (5 means 5%), exactly as a person types them,
 * and are converted here. Money is in millions of the selected currency. A blank
 * field is `null` and behaves as the reference's NaN.
 *
 * Relative imports only, so the verifier can load this file outside Next.
 */

import { ASSUMPTIONS, COUNTRIES, DEAL_BANDS_SAR, INDUSTRIES, type IndustryData } from './data';

export const HISTORY_YEARS = 3;
export const FORECAST_YEARS = 5;
export const TOTAL_YEARS = HISTORY_YEARS + FORECAST_YEARS;

export type LineKey = 'rev' | 'ebitda' | 'da' | 'capex' | 'nwc';
export const LINE_KEYS: LineKey[] = ['rev', 'ebitda', 'da', 'capex', 'nwc'];

/** Eight values per line: three actuals then five forecast years. */
export type Financials = Record<LineKey, (number | null)[]>;

export type WaccInputs = {
  rf: number | null;
  erp: number | null;
  crp: number | null;
  /** Unlevered beta, a plain number. */
  bu: number | null;
  de: number | null;
  sp: number | null;
  ds: number | null;
  cs: number | null;
  tax: number | null;
  inflationLocal: number | null;
  inflationUs: number | null;
};

export type Peer = { name: string; evEbitda: number | null; evRevenue: number | null };

export type ValuationInputs = {
  industry: string;
  country: string;
  financialYear: number | null;
  netDebt: number | null;
  financials: Financials;
  wacc: WaccInputs;
  growth: number | null;
  exitMultiple: number | null;
  midYear: boolean;
  peers: Peer[];
  privateDiscount: number | null;
  dcfWeight: number | null;
};

export type Currency = { code: string; pegged: boolean; sarPerUnit: number };

const n = (v: number | null | undefined): number => (v === null || v === undefined ? NaN : v);

/* ------------------------------------------------------------------------ */
/* Lookups                                                                   */
/* ------------------------------------------------------------------------ */

export function currencyFor(country: string): Currency {
  const c = (COUNTRIES as Record<string, (typeof COUNTRIES)[keyof typeof COUNTRIES]>)[country];
  return c
    ? { code: c.code, pegged: c.pegged, sarPerUnit: c.sarPerUnit }
    : { code: 'SAR', pegged: true, sarPerUnit: 1 };
}

export function industryFor(industry: string): IndustryData | null {
  return (INDUSTRIES as Record<string, IndustryData>)[industry] ?? null;
}

export function financialYears(fy: number | null): { history: number[]; forecast: number[] } {
  const y = fy && Number.isFinite(fy) ? Math.trunc(fy) : ASSUMPTIONS.defaultFinancialYear;
  return { history: [y - 2, y - 1, y], forecast: [1, 2, 3, 4, 5].map((i) => y + i) };
}

/* ------------------------------------------------------------------------ */
/* Cost of capital                                                           */
/* ------------------------------------------------------------------------ */

export type WaccBreakdown = {
  rf: number; erp: number; crp: number; bu: number; de: number; sp: number;
  ds: number; cs: number; t: number;
  bl: number; ke: number; kd: number; kdt: number; we: number; wd: number;
  waccUsd: number; wacc: number;
};

export function computeWacc(w: WaccInputs, currency: Currency): WaccBreakdown {
  const rf = n(w.rf) / 100, erp = n(w.erp) / 100, crp = n(w.crp) / 100, bu = n(w.bu),
    de = n(w.de) / 100, sp = n(w.sp) / 100, ds = n(w.ds) / 100, cs = n(w.cs) / 100,
    t = n(w.tax) / 100;
  const bl = bu * (1 + (1 - t) * de);
  const ke = rf + bl * erp + crp + sp;
  const kd = rf + ds + cs, kdt = kd * (1 - t);
  const wd = de / (1 + de), we = 1 - wd;
  const waccUsd = we * ke + wd * kdt;
  const conv = currency.pegged ? 1 : (1 + n(w.inflationLocal) / 100) / (1 + n(w.inflationUs) / 100);
  return { rf, erp, crp, bu, de, sp, ds, cs, t, bl, ke, kd, kdt, we, wd, waccUsd, wacc: (1 + waccUsd) * conv - 1 };
}

/** Size and company premium from last actual revenue, thresholds in SAR millions. */
export function defaultSizePremium(ltmRevenue: number | null, currency: Currency): number {
  const r = n(ltmRevenue);
  if (!(r > 0)) return ASSUMPTIONS.sizePremiumNoRevenue;
  const rs = r * currency.sarPerUnit;
  const b = ASSUMPTIONS.sizePremium;
  return rs < b.smallBelow ? b.small : rs < b.midBelow ? b.mid : b.large;
}

/* ------------------------------------------------------------------------ */
/* Comparables                                                               */
/* ------------------------------------------------------------------------ */

/** Lowest, median and highest of the finite values, or null with fewer than two. */
export function peerStats(values: (number | null)[]): [number, number, number] | null {
  const a = values.map(n).filter(Number.isFinite).sort((x, y) => x - y);
  if (a.length < 2) return null;
  const m = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
  return [a[0], m, a[a.length - 1]];
}

export type CompsMultiples = {
  ebitda: [number, number, number];
  revenue: [number, number, number];
  /** Number of peers behind each set, or 0 when the preset was used. */
  peersE: number;
  peersR: number;
};

export function compsMultiples(industry: string, peers: Peer[]): CompsMultiples {
  const s = industryFor(industry);
  const se = peerStats(peers.map((p) => p.evEbitda));
  const sr = peerStats(peers.map((p) => p.evRevenue));
  const presetE = s ? ([...s.ebitdaMultiples] as [number, number, number]) : ([NaN, NaN, NaN] as [number, number, number]);
  const presetR = s ? ([...s.revenueMultiples] as [number, number, number]) : ([NaN, NaN, NaN] as [number, number, number]);
  return {
    ebitda: se || presetE,
    revenue: sr || presetR,
    peersE: se ? peers.filter((p) => Number.isFinite(n(p.evEbitda))).length : 0,
    peersR: sr ? peers.filter((p) => Number.isFinite(n(p.evRevenue))).length : 0,
  };
}

/**
 * CHANGED from the reference: the exit multiple defaults to the median of the
 * visitor's own peers when at least two are entered. The reference always used
 * the preset median, which contradicted its own hint ("Defaults to the
 * comparables median") once peers replaced the preset.
 */
export function defaultExitMultiple(industry: string, peers: Peer[]): number | null {
  const se = peerStats(peers.map((p) => p.evEbitda));
  if (se) return se[1];
  const s = industryFor(industry);
  return s ? s.ebitdaMultiples[1] : null;
}

/* ------------------------------------------------------------------------ */
/* Forecast fill                                                             */
/* ------------------------------------------------------------------------ */

export type FillAssumptions = {
  growth: number | null;
  ebitdaMargin: number | null;
  daOfRevenue: number | null;
  capexOfRevenue: number | null;
  nwcOfRevenue: number | null;
};

/**
 * Overwrites the forecast columns from simple assumptions. Rounds to one
 * decimal exactly as the reference does, which matters: the valuation then
 * runs on the rounded figures, so rounding differently would move the answer.
 */
export function fillForecast(
  fin: Financials,
  a: FillAssumptions,
): { ok: true; financials: Financials } | { ok: false; error: string } {
  const lastRev = n(fin.rev[HISTORY_YEARS - 1]);
  if (!(lastRev > 0)) {
    return { ok: false, error: 'Enter revenue for the last actual year before filling the forecast.' };
  }
  const g = n(a.growth) / 100, m = n(a.ebitdaMargin) / 100, da = n(a.daOfRevenue) / 100,
    cx = n(a.capexOfRevenue) / 100, w = n(a.nwcOfRevenue) / 100;
  const out = cloneFinancials(fin);
  const r1 = (v: number) => (Number.isFinite(v) ? +v.toFixed(1) : null);
  let r = lastRev;
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    r = r * (1 + g);
    out.rev[i] = r1(r);
    out.ebitda[i] = r1(r * m);
    out.da[i] = r1(r * da);
    out.capex[i] = r1(r * cx);
    out.nwc[i] = r1(r * w);
  }
  return { ok: true, financials: out };
}

export function cloneFinancials(fin: Financials): Financials {
  return {
    rev: [...fin.rev], ebitda: [...fin.ebitda], da: [...fin.da], capex: [...fin.capex], nwc: [...fin.nwc],
  };
}

export function emptyFinancials(): Financials {
  const blank = () => new Array<number | null>(TOTAL_YEARS).fill(null);
  return { rev: blank(), ebitda: blank(), da: blank(), capex: blank(), nwc: blank() };
}

/* ------------------------------------------------------------------------ */
/* Validation, one function per step, with the reference's wording           */
/* ------------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>;

export function validateCompany(i: Pick<ValuationInputs, 'industry' | 'country' | 'financialYear' | 'netDebt'>): FieldErrors {
  const e: FieldErrors = {};
  if (!industryFor(i.industry)) e.industry = 'Select an industry.';
  if (!(i.country in COUNTRIES)) e.country = 'Select a country.';
  const fy = n(i.financialYear);
  if (!(fy >= ASSUMPTIONS.minFinancialYear && fy <= ASSUMPTIONS.maxFinancialYear)) {
    e.financialYear = `Enter a year between ${ASSUMPTIONS.minFinancialYear} and ${ASSUMPTIONS.maxFinancialYear}.`;
  }
  if (!Number.isFinite(n(i.netDebt))) e.netDebt = 'Enter net debt. Use 0 if none.';
  return e;
}

export function validateFinancials(fin: Financials): string | null {
  for (let i = 0; i < TOTAL_YEARS; i++) {
    if (!(n(fin.rev[i]) > 0)) return 'Enter revenue above zero for every year.';
    if (!Number.isFinite(n(fin.ebitda[i]))) return 'Enter EBITDA for every year. Use a negative figure for a loss.';
  }
  if (!Number.isFinite(n(fin.nwc[HISTORY_YEARS - 1]))) {
    return 'Enter net working capital for the last actual year, even if zero.';
  }
  return null;
}

export function validateWacc(w: WaccInputs, currency: Currency): string | null {
  return Number.isFinite(computeWacc(w, currency).wacc) ? null : 'Complete every cost of capital input.';
}

export function validateTerminal(i: ValuationInputs, wacc: number): string | null {
  const g = n(i.growth) / 100, xm = n(i.exitMultiple), wD = n(i.dcfWeight);
  if (!Number.isFinite(g) || !Number.isFinite(xm) || !Number.isFinite(wD) || wD < 0 || wD > 100) {
    return 'Enter growth, exit multiple and a DCF weight between 0% and 100%.';
  }
  if (g >= wacc - 0.01) return `Long-term growth must be at least 1% below WACC (${pct(wacc)}).`;
  return null;
}

function pct(v: number, d = 2): string {
  return Number.isFinite(v) ? (v * 100).toFixed(d) + '%' : 'n/a';
}

/* ------------------------------------------------------------------------ */
/* DCF                                                                       */
/* ------------------------------------------------------------------------ */

export type ProjectionRow = {
  rev: number; ebitda: number; da: number; ebit: number; tax: number;
  capex: number; dnwc: number; fcf: number;
};

export function projections(fin: Financials, t: number): ProjectionRow[] {
  const z = (v: number | null) => (Number.isFinite(n(v)) ? (v as number) : 0);
  const rows: ProjectionRow[] = [];
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    const ebitda = n(fin.ebitda[i]), da = z(fin.da[i]), capex = z(fin.capex[i]);
    const nwcPrev = i === HISTORY_YEARS ? z(fin.nwc[HISTORY_YEARS - 1]) : z(fin.nwc[i - 1]);
    const dnwc = z(fin.nwc[i]) - nwcPrev;
    const ebit = ebitda - da;
    const tax = Math.max(0, ebit) * t;
    rows.push({ rev: n(fin.rev[i]), ebitda, da, ebit, tax, capex, dnwc, fcf: ebit - tax + da - capex - dnwc });
  }
  return rows;
}

export type DcfResult = {
  pv: number; dfs: number[]; dfN: number; tvG: number; tvX: number; evG: number; evX: number;
};

export function dcf(rows: ProjectionRow[], wacc: number, g: number, mult: number, mid: boolean): DcfResult {
  let pv = 0;
  const dfs: number[] = [];
  rows.forEach((r, k) => {
    const df = 1 / Math.pow(1 + wacc, k + 1 - (mid ? 0.5 : 0));
    dfs.push(df);
    pv += r.fcf * df;
  });
  const last = rows[rows.length - 1], dfN = 1 / Math.pow(1 + wacc, rows.length);
  const tvG = wacc > g ? (last.fcf * (1 + g)) / (wacc - g) : NaN;
  const tvX = last.ebitda > 0 ? last.ebitda * mult : NaN;
  return { pv, dfs, dfN, tvG, tvX, evG: pv + tvG * dfN, evX: pv + tvX * dfN };
}

/* ------------------------------------------------------------------------ */
/* Full run                                                                  */
/* ------------------------------------------------------------------------ */

export type Range3 = [number, number, number];

/** How much of the headline equity range was floored at zero. */
export type EquityFloor = 'none' | 'low' | 'low_and_mid' | 'all';

export type ValuationResult = {
  currency: Currency;
  years: { history: number[]; forecast: number[] };
  wacc: WaccBreakdown;
  growth: number;
  exitMultiple: number;
  midYear: boolean;
  netDebt: number;
  privateDiscount: number;
  dcfWeight: number;
  /** All eight years, for the chart. */
  revenue: number[];
  ebitda: number[];
  ltmRevenue: number;
  ltmEbitda: number;
  rows: ProjectionRow[];
  base: DcfResult;
  loG: number; hiG: number; loX: number; hiX: number;
  comps: CompsMultiples;
  /** Comparables EV from EV / EBITDA, null when LTM EBITDA is not positive. */
  compsEbitda: Range3 | null;
  compsRevenue: Range3;
  dcfRange: Range3;
  compRange: Range3;
  /** Blended enterprise value. */
  ev: Range3;
  /** Blended EV less net debt, unfloored. The bridge table shows this. */
  equity: Range3;
  /**
   * CHANGED from the reference: all three floored at zero. The reference
   * floored the low and high but not the midpoint, so a heavily indebted
   * company could read "SAR 0 to SAR 12 million, midpoint negative SAR 3".
   */
  equityDisplay: Range3;
  equityFloor: EquityFloor;
  tvShare: number;
  impliedExitMultiple: number;
  ltmMultiple: number;
  sensitivity: { waccs: number[]; growths: number[]; grid: number[][] };
};

export type RunOutcome =
  | { ok: true; result: ValuationResult }
  | { ok: false; step: 0 | 1 | 2 | 3; errors: FieldErrors | string };

export const SENSITIVITY_WACC_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];
export const SENSITIVITY_GROWTH_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];

export function runValuation(i: ValuationInputs): RunOutcome {
  const companyErrors = validateCompany(i);
  if (Object.keys(companyErrors).length) return { ok: false, step: 0, errors: companyErrors };
  const finError = validateFinancials(i.financials);
  if (finError) return { ok: false, step: 1, errors: finError };

  const currency = currencyFor(i.country);
  const w = computeWacc(i.wacc, currency);
  if (!Number.isFinite(w.wacc)) return { ok: false, step: 2, errors: 'Complete every cost of capital input.' };
  const termError = validateTerminal(i, w.wacc);
  if (termError) return { ok: false, step: 3, errors: termError };

  const g = n(i.growth) / 100, xm = n(i.exitMultiple), wD = n(i.dcfWeight);
  const mid = i.midYear, nd = n(i.netDebt);
  const disc = (n(i.privateDiscount) || 0) / 100;
  const fin = i.financials;
  const rows = projections(fin, w.t);

  const base = dcf(rows, w.wacc, g, xm, mid);
  const loG = dcf(rows, w.wacc + 0.01, g - 0.005, xm, mid).evG;
  const hiG = dcf(rows, w.wacc - 0.01, g + 0.005, xm, mid).evG;
  const loX = dcf(rows, w.wacc + 0.01, g, xm - 1, mid).evX;
  const hiX = dcf(rows, w.wacc - 0.01, g, xm + 1, mid).evX;

  const cm = compsMultiples(i.industry, i.peers);
  const ltmE = n(fin.ebitda[HISTORY_YEARS - 1]), ltmR = n(fin.rev[HISTORY_YEARS - 1]);
  const cE = ltmE > 0 ? (cm.ebitda.map((m) => ltmE * m * (1 - disc)) as Range3) : null;
  const cR = cm.revenue.map((m) => ltmR * m * (1 - disc)) as Range3;

  const dcfRange = [0, 1, 2].map((k) => {
    const G = [loG, base.evG, hiG][k], X = [loX, base.evX, hiX][k];
    return Number.isFinite(X) ? (G + X) / 2 : G;
  }) as Range3;
  const compRange = cE || cR;
  const ev = [0, 1, 2].map((k) => (wD / 100) * dcfRange[k] + (1 - wD / 100) * compRange[k]) as Range3;
  const equity = ev.map((v) => v - nd) as Range3;
  const equityDisplay = equity.map((v) => Math.max(0, v)) as Range3;
  const equityFloor: EquityFloor =
    equity[2] < 0 ? 'all' : equity[1] < 0 ? 'low_and_mid' : equity[0] < 0 ? 'low' : 'none';

  const last = rows[rows.length - 1];
  const tvShare = (base.tvG * base.dfN) / base.evG;
  const impliedExitMultiple = last.ebitda > 0 ? base.tvG / last.ebitda : NaN;
  const ltmMultiple = ltmE > 0 ? ev[1] / ltmE : NaN;

  const waccs = SENSITIVITY_WACC_STEPS.map((dw) => w.wacc + dw);
  const growths = SENSITIVITY_GROWTH_STEPS.map((dg) => g + dg);
  const grid = SENSITIVITY_WACC_STEPS.map((dw) =>
    SENSITIVITY_GROWTH_STEPS.map((dg) => {
      const W2 = w.wacc + dw, G2 = g + dg;
      return W2 > G2 + 0.005 ? dcf(rows, W2, G2, xm, mid).evG - nd : NaN;
    }),
  );

  return {
    ok: true,
    result: {
      currency,
      years: financialYears(i.financialYear),
      wacc: w,
      growth: g,
      exitMultiple: xm,
      midYear: mid,
      netDebt: nd,
      privateDiscount: disc,
      dcfWeight: wD,
      revenue: fin.rev.map(n),
      ebitda: fin.ebitda.map(n),
      ltmRevenue: ltmR,
      ltmEbitda: ltmE,
      rows,
      base,
      loG, hiG, loX, hiX,
      comps: cm,
      compsEbitda: cE,
      compsRevenue: cR,
      dcfRange,
      compRange,
      ev,
      equity,
      equityDisplay,
      equityFloor,
      tvShare,
      impliedExitMultiple,
      ltmMultiple,
      sensitivity: { waccs, growths, grid },
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Deal bands                                                                */
/* ------------------------------------------------------------------------ */

export function dealBandLabel(lo: number | null, hi: number | null, currency: Currency): string {
  const f = (v: number) => {
    const x = v / currency.sarPerUnit;
    return x >= 1000 ? `${+(x / 1000).toPrecision(3)} billion` : `${+x.toPrecision(3)} million`;
  };
  const c = currency.code;
  if (lo === null && hi !== null) return `Under ${c} ${f(hi)}`;
  if (hi === null && lo !== null) return `Over ${c} ${f(lo)}`;
  return `${c} ${f(lo as number)} to ${f(hi as number)}`;
}

export function dealBandOptions(currency: Currency): { value: string; label: string }[] {
  return DEAL_BANDS_SAR.map((b) => ({ value: b.value, label: dealBandLabel(b.lo, b.hi, currency) }));
}
