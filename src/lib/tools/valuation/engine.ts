/**
 * The Business Valuation engine. Pure functions, no UI, no I/O.
 *
 * The browser runs it to show results, and the lead API runs it again on the
 * submitted inputs, so what is stored, emailed and put in the PDF never depends
 * on numbers a browser sent.
 *
 * The version 1 arithmetic is a line-for-line port of the reference
 * implementation at `reference/tools/business-valuation.html`, including its
 * order of operations, so the two agree to floating-point precision.
 * `npm run verify-valuation-engine` holds it to that by running the reference in
 * headless Chrome. Deliberate departures from the reference are marked CHANGED.
 *
 * VERSION 2 (schema version 2) adds normalised EBITDA, bridge items below net
 * debt, stake value, scenarios, a WACC adjustment for the exploration sliders,
 * invested capital for ROIC, key ratios and warnings. Every version 2 input is
 * optional and resolves to a neutral default (`resolveExtras`), so a version 1
 * input set, or a version 2 set left at its defaults, produces exactly the
 * version 1 base result. Stored leads with version 1 inputs therefore still
 * compute, and the reference comparison still holds.
 *
 * Units: rates arrive as percent (5 means 5%), exactly as a person types them,
 * and are converted here. Money is in millions of the selected currency. A blank
 * field is `null` and behaves as the reference's NaN.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import type { CompanyProfile } from './profile';
import {
  ASSUMPTIONS,
  COUNTRIES,
  DEAL_BANDS_SAR,
  INDUSTRIES,
  MARKET,
  V2_DEFAULTS,
  WARNING_RULES,
  type IndustryData,
} from './data';

export const HISTORY_YEARS = 3;
export const FORECAST_YEARS = 5;
export const TOTAL_YEARS = HISTORY_YEARS + FORECAST_YEARS;

/** The inputs schema version written by this code. Stored on every lead's inputs. */
export const INPUT_SCHEMA_VERSION = 2;

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

export type StakeAdjustment = 'none' | 'control_premium' | 'minority_discount';

/** EBITDA add-backs, millions. */
export type NormalisationInputs = {
  /** One-off costs in the last actual year. Never carried forward: they do not recur. */
  oneOff: number | null;
  /** Owner or related-party costs above a market rate, last actual year. */
  ownerCosts: number | null;
  /** Add the owner cost adjustment to every forecast year as well. */
  carryOwnerCosts: boolean;
};

/** Claims on enterprise value besides net debt, and assets outside it, millions. */
export type BridgeInputs = {
  /** End of service benefits provision. Deducted. */
  eosb: number | null;
  /** Lease liabilities not already in net debt. Deducted. */
  leases: number | null;
  /** Minority interest in subsidiaries. Deducted. */
  minorityInterest: number | null;
  /** Surplus assets or investments outside the operating business. Added. */
  surplusAssets: number | null;
};

export type StakeInputs = {
  /** Percent of equity being valued. */
  percent: number | null;
  adjustment: StakeAdjustment;
  controlPremium: number | null;
  minorityDiscount: number | null;
};

/** Percentage point adjustments to forecast growth and margin, and probability weights in percent. */
export type ScenarioInputs = {
  upsideGrowth: number | null;
  upsideMargin: number | null;
  downsideGrowth: number | null;
  downsideMargin: number | null;
  weightDownside: number | null;
  weightBase: number | null;
  weightUpside: number | null;
};

export type ValuationInputs = {
  /** Absent on leads stored before version 2. */
  schemaVersion?: number;
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
  normalisation?: NormalisationInputs;
  bridge?: BridgeInputs;
  stake?: StakeInputs;
  scenarios?: ScenarioInputs;
  /** Invested capital at the end of the last actual year, millions. Enables the ROIC checks. */
  investedCapital?: number | null;
  /** Percentage points added to the computed WACC. Set by the exploration slider. */
  waccAdjustment?: number | null;
  /** Company name and a description for the report. Never read by the engine. See `profile.ts`. */
  profile?: CompanyProfile;
};

export type Currency = { code: string; pegged: boolean; sarPerUnit: number };

const n = (v: number | null | undefined): number => (v === null || v === undefined ? NaN : v);
const z = (v: number | null | undefined): number => (Number.isFinite(n(v)) ? (v as number) : 0);

/* ------------------------------------------------------------------------ */
/* Lookups                                                                   */
/* ------------------------------------------------------------------------ */

type CountryRecord = (typeof COUNTRIES)[keyof typeof COUNTRIES];

export function countryFor(country: string): CountryRecord | null {
  return (COUNTRIES as Record<string, CountryRecord>)[country] ?? null;
}

export function currencyFor(country: string): Currency {
  const c = countryFor(country);
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
/* Version 2 defaults                                                        */
/* ------------------------------------------------------------------------ */

export function defaultExtras(): Required<Pick<ValuationInputs, 'normalisation' | 'bridge' | 'stake' | 'scenarios'>> & {
  investedCapital: null;
  waccAdjustment: number;
} {
  const d = V2_DEFAULTS;
  return {
    normalisation: { oneOff: null, ownerCosts: null, carryOwnerCosts: false },
    bridge: { eosb: null, leases: null, minorityInterest: null, surplusAssets: null },
    stake: {
      percent: d.stake.percent,
      adjustment: 'none',
      controlPremium: d.stake.controlPremium,
      minorityDiscount: d.stake.minorityDiscount,
    },
    scenarios: {
      upsideGrowth: d.scenarios.upsideGrowth,
      upsideMargin: d.scenarios.upsideMargin,
      downsideGrowth: d.scenarios.downsideGrowth,
      downsideMargin: d.scenarios.downsideMargin,
      weightDownside: d.scenarioWeights.downside,
      weightBase: d.scenarioWeights.base,
      weightUpside: d.scenarioWeights.upside,
    },
    investedCapital: null,
    waccAdjustment: 0,
  };
}

/** Fills every absent version 2 block with its neutral default. */
export function resolveExtras(i: ValuationInputs) {
  const d = defaultExtras();
  return {
    normalisation: i.normalisation ?? d.normalisation,
    bridge: i.bridge ?? d.bridge,
    stake: i.stake ?? d.stake,
    scenarios: i.scenarios ?? d.scenarios,
    investedCapital: i.investedCapital ?? null,
    waccAdjustment: z(i.waccAdjustment),
  };
}

/* ------------------------------------------------------------------------ */
/* Cost of capital                                                           */
/* ------------------------------------------------------------------------ */

export type WaccBreakdown = {
  rf: number; erp: number; crp: number; bu: number; de: number; sp: number;
  ds: number; cs: number; t: number;
  bl: number; ke: number; kd: number; kdt: number; we: number; wd: number;
  waccUsd: number; wacc: number;
  /** Percentage points added by the exploration slider, as a ratio. 0 unless adjusted. */
  adjustment: number;
};

export function computeWacc(w: WaccInputs, currency: Currency, adjustmentPoints = 0): WaccBreakdown {
  const rf = n(w.rf) / 100, erp = n(w.erp) / 100, crp = n(w.crp) / 100, bu = n(w.bu),
    de = n(w.de) / 100, sp = n(w.sp) / 100, ds = n(w.ds) / 100, cs = n(w.cs) / 100,
    t = n(w.tax) / 100;
  const bl = bu * (1 + (1 - t) * de);
  const ke = rf + bl * erp + crp + sp;
  const kd = rf + ds + cs, kdt = kd * (1 - t);
  const wd = de / (1 + de), we = 1 - wd;
  const waccUsd = we * ke + wd * kdt;
  const conv = currency.pegged ? 1 : (1 + n(w.inflationLocal) / 100) / (1 + n(w.inflationUs) / 100);
  const base = (1 + waccUsd) * conv - 1;
  const adjustment = adjustmentPoints / 100;
  return {
    rf, erp, crp, bu, de, sp, ds, cs, t, bl, ke, kd, kdt, we, wd, waccUsd,
    // Adding a literal 0 would still be exact, but the branch keeps the
    // unadjusted value bit-for-bit identical to the reference's.
    wacc: adjustment ? base + adjustment : base,
    adjustment,
  };
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

/** True once the visitor's own peers replace a preset multiple. */
export function peersInUse(peers: Peer[]): boolean {
  return peerStats(peers.map((p) => p.evEbitda)) !== null || peerStats(peers.map((p) => p.evRevenue)) !== null;
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
 * the preset median, which contradicted its own hint once peers replaced it.
 */
export function defaultExitMultiple(industry: string, peers: Peer[]): number | null {
  const se = peerStats(peers.map((p) => p.evEbitda));
  if (se) return se[1];
  const s = industryFor(industry);
  return s ? s.ebitdaMultiples[1] : null;
}

/**
 * CHANGED from the reference: the private company discount set automatically.
 * Preset multiples already describe private deals, so none is applied to them.
 * Listed peers trade at a liquidity premium a private business does not have,
 * so once peers are in use the default becomes `privateDiscountWithPeers`.
 */
export function defaultPrivateDiscount(peers: Peer[]): number {
  return peersInUse(peers) ? ASSUMPTIONS.privateDiscountWithPeers : ASSUMPTIONS.privateDiscount;
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

function finiteOrNull(v: number | null | undefined): boolean {
  return v === null || v === undefined || Number.isFinite(v);
}

export function validateCompany(
  i: Pick<ValuationInputs, 'industry' | 'country' | 'financialYear' | 'netDebt' | 'bridge'>,
): FieldErrors {
  const e: FieldErrors = {};
  if (!industryFor(i.industry)) e.industry = 'Select an industry.';
  if (!(i.country in COUNTRIES)) e.country = 'Select a country.';
  const fy = n(i.financialYear);
  if (!(fy >= ASSUMPTIONS.minFinancialYear && fy <= ASSUMPTIONS.maxFinancialYear)) {
    e.financialYear = `Enter a year between ${ASSUMPTIONS.minFinancialYear} and ${ASSUMPTIONS.maxFinancialYear}.`;
  }
  if (!Number.isFinite(n(i.netDebt))) e.netDebt = 'Enter net debt. Use 0 if none.';
  const b = i.bridge;
  if (b) {
    for (const k of ['eosb', 'leases', 'minorityInterest', 'surplusAssets'] as const) {
      if (!finiteOrNull(b[k]) || z(b[k]) < 0) e[k] = 'Enter a positive amount, or leave blank.';
    }
  }
  return e;
}

export function validateFinancials(fin: Financials, extras?: Pick<ValuationInputs, 'normalisation' | 'investedCapital'>): string | null {
  for (let i = 0; i < TOTAL_YEARS; i++) {
    if (!(n(fin.rev[i]) > 0)) return 'Enter revenue above zero for every year.';
    if (!Number.isFinite(n(fin.ebitda[i]))) return 'Enter EBITDA for every year. Use a negative figure for a loss.';
  }
  if (!Number.isFinite(n(fin.nwc[HISTORY_YEARS - 1]))) {
    return 'Enter net working capital for the last actual year, even if zero.';
  }
  const norm = extras?.normalisation;
  if (norm && (!finiteOrNull(norm.oneOff) || !finiteOrNull(norm.ownerCosts))) {
    return 'Enter add-backs as numbers, or leave them blank.';
  }
  const ic = extras?.investedCapital;
  if (ic !== null && ic !== undefined && !(ic > 0)) return 'Enter invested capital above zero, or leave it blank.';
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
  const disc = n(i.privateDiscount);
  if (Number.isFinite(disc) && (disc < 0 || disc >= 100)) return 'Enter a private company discount between 0% and 99%.';
  const x = resolveExtras(i);
  const sc = x.scenarios;
  for (const k of ['upsideGrowth', 'upsideMargin', 'downsideGrowth', 'downsideMargin'] as const) {
    if (!Number.isFinite(n(sc[k]))) return 'Enter every scenario adjustment. Use 0 for no change.';
  }
  const weights = [sc.weightDownside, sc.weightBase, sc.weightUpside].map(n);
  if (weights.some((v) => !Number.isFinite(v) || v < 0)) return 'Enter scenario weights of 0% or more.';
  if (Math.abs(weights.reduce((a, b) => a + b, 0) - 100) > 1e-9) return 'Scenario weights must total 100%.';
  const st = x.stake;
  const p = n(st.percent);
  if (!(p > 0 && p <= 100)) return 'Enter a stake between 0% and 100%.';
  if (st.adjustment === 'control_premium' && !(n(st.controlPremium) >= 0 && n(st.controlPremium) <= 100)) {
    return 'Enter a control premium between 0% and 100%.';
  }
  if (st.adjustment === 'minority_discount' && !(n(st.minorityDiscount) >= 0 && n(st.minorityDiscount) < 100)) {
    return 'Enter a minority discount between 0% and 99%.';
  }
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
  const zz = (v: number | null) => (Number.isFinite(n(v)) ? (v as number) : 0);
  const rows: ProjectionRow[] = [];
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    const ebitda = n(fin.ebitda[i]), da = zz(fin.da[i]), capex = zz(fin.capex[i]);
    const nwcPrev = i === HISTORY_YEARS ? zz(fin.nwc[HISTORY_YEARS - 1]) : zz(fin.nwc[i - 1]);
    const dnwc = zz(fin.nwc[i]) - nwcPrev;
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
/* Version 2 building blocks                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Financials with the owner cost add-back carried into the forecast when asked.
 * One-off costs are never carried: a cost that recurs is not one-off.
 * With no add-back the same object is returned, untouched.
 */
export function normalisedFinancials(fin: Financials, norm: NormalisationInputs): Financials {
  const owner = z(norm.ownerCosts);
  if (!norm.carryOwnerCosts || owner === 0) return fin;
  const out = cloneFinancials(fin);
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    const e = n(fin.ebitda[i]);
    out.ebitda[i] = Number.isFinite(e) ? e + owner : fin.ebitda[i];
  }
  return out;
}

/**
 * The forecast rebuilt for a scenario: each year's revenue growth moved by
 * `growthPoints` and its EBITDA margin by `marginPoints`, compounding from the
 * last actual year. D&A, capex and working capital keep their share of revenue.
 */
export function scenarioFinancials(fin: Financials, growthPoints: number, marginPoints: number): Financials {
  const out = cloneFinancials(fin);
  const dg = growthPoints / 100, dm = marginPoints / 100;
  let prevBase = n(fin.rev[HISTORY_YEARS - 1]);
  let prevNew = prevBase;
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    const rev = n(fin.rev[i]);
    const growth = rev / prevBase - 1;
    const newRev = prevNew * (1 + growth + dg);
    const scale = newRev / rev;
    const margin = n(fin.ebitda[i]) / rev + dm;
    out.rev[i] = newRev;
    out.ebitda[i] = newRev * margin;
    for (const k of ['da', 'capex'] as const) {
      const v = n(fin[k][i]);
      out[k][i] = Number.isFinite(v) ? v * scale : fin[k][i];
    }
    const w = n(fin.nwc[i]);
    out.nwc[i] = Number.isFinite(w) ? w * scale : fin.nwc[i];
    prevBase = rev;
    prevNew = newRev;
  }
  return out;
}

export type Range3 = [number, number, number];

/** How much of the headline equity range was floored at zero. */
export type EquityFloor = 'none' | 'low' | 'low_and_mid' | 'all';

export type WarningCode =
  | 'terminal_value_share'
  | 'growth_ceiling'
  | 'exit_multiple_mismatch'
  | 'terminal_fcf_negative'
  | 'margin_jump'
  | 'roic_below_wacc'
  | 'reinvestment_inconsistent'
  | 'growth_vs_inflation'
  | 'premium_on_minority_stake';

export type Warning = { code: WarningCode; values: Record<string, number> };

export type KeyRatios = {
  /** Compound annual revenue growth over the two historical years. */
  revenueCagrHistory: number;
  /** Compound annual revenue growth over the five forecast years. */
  revenueCagrForecast: number;
  /** EBITDA margin in the last actual year, normalised. */
  ebitdaMarginLtm: number;
  /** EBITDA margin in the final forecast year. */
  ebitdaMarginTerminal: number;
  /** Average capex as a share of revenue over the forecast. */
  capexIntensity: number;
  /** Net working capital as a share of revenue in the final forecast year. */
  nwcIntensity: number;
  /** Total free cash flow over total EBITDA across the forecast. */
  fcfConversion: number;
  /** Last actual year after-tax EBIT over invested capital. NaN without invested capital. */
  roic: number;
  /** Growth implied by terminal year reinvestment and ROIC. NaN without invested capital. */
  impliedGrowthFromReinvestment: number;
  /** Terminal year net reinvestment over NOPAT. */
  reinvestmentRate: number;
};

export type ScenarioResult = {
  key: 'downside' | 'base' | 'upside';
  weight: number;
  growthPoints: number;
  marginPoints: number;
  ev: Range3;
  equity: Range3;
  equityDisplay: Range3;
  /** Final forecast year revenue and EBITDA, to show what the scenario assumes. */
  terminalRevenue: number;
  terminalEbitda: number;
};

export type BridgeResult = {
  eosb: number;
  leases: number;
  minorityInterest: number;
  surplusAssets: number;
  /** Deductions less additions, beyond net debt. */
  otherClaims: number;
};

export type StakeResult = {
  percent: number;
  adjustment: StakeAdjustment;
  /** Premium or discount applied, as a ratio, signed: +0.25 or -0.20. */
  adjustmentRate: number;
  /** Equity display range times stake times the adjustment. */
  value: Range3;
  /** False at 100% with no adjustment, when there is nothing extra to show. */
  used: boolean;
};

/* ------------------------------------------------------------------------ */
/* Full run                                                                  */
/* ------------------------------------------------------------------------ */

export type ValuationResult = {
  schemaVersion: number;
  currency: Currency;
  years: { history: number[]; forecast: number[] };
  wacc: WaccBreakdown;
  growth: number;
  /** The exit multiple as entered. */
  exitMultiple: number;
  /** CHANGED: the exit multiple after the private company discount, which is what the DCF uses. */
  exitMultipleApplied: number;
  midYear: boolean;
  netDebt: number;
  privateDiscount: number;
  dcfWeight: number;
  /** All eight years, for the charts. Forecast EBITDA includes carried add-backs. */
  revenue: number[];
  ebitda: number[];
  ltmRevenue: number;
  /** Normalised last actual year EBITDA, used for comparables and the LTM multiple. */
  ltmEbitda: number;
  ltmEbitdaReported: number;
  normalisation: { oneOff: number; ownerCosts: number; carryOwnerCosts: boolean; used: boolean };
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
  bridge: BridgeResult;
  /** Blended EV less net debt and the other bridge items, unfloored. */
  equity: Range3;
  /**
   * CHANGED from the reference: all three floored at zero. The reference
   * floored the low and high but not the midpoint.
   */
  equityDisplay: Range3;
  equityFloor: EquityFloor;
  tvShare: number;
  impliedExitMultiple: number;
  ltmMultiple: number;
  sensitivity: { waccs: number[]; growths: number[]; grid: number[][] };
  /** Empty when computed inside a scenario run. */
  scenarios: ScenarioResult[];
  /** Probability-weighted equity midpoint, floored at zero. NaN inside a scenario run. */
  weightedEquity: number;
  stake: StakeResult;
  ratios: KeyRatios;
  warnings: Warning[];
};

export type RunOutcome =
  | { ok: true; result: ValuationResult }
  | { ok: false; step: 0 | 1 | 2 | 3; errors: FieldErrors | string };

export const SENSITIVITY_WACC_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];
export const SENSITIVITY_GROWTH_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];

export function runValuation(i: ValuationInputs): RunOutcome {
  const companyErrors = validateCompany(i);
  if (Object.keys(companyErrors).length) return { ok: false, step: 0, errors: companyErrors };
  const finError = validateFinancials(i.financials, i);
  if (finError) return { ok: false, step: 1, errors: finError };

  const currency = currencyFor(i.country);
  const x = resolveExtras(i);
  const w = computeWacc(i.wacc, currency, x.waccAdjustment);
  if (!Number.isFinite(w.wacc)) return { ok: false, step: 2, errors: 'Complete every cost of capital input.' };
  const termError = validateTerminal(i, w.wacc);
  if (termError) return { ok: false, step: 3, errors: termError };

  return { ok: true, result: compute(i, true) };
}

/** The valuation itself, on inputs already validated. `withScenarios` is false inside a scenario run. */
function compute(i: ValuationInputs, withScenarios: boolean): ValuationResult {
  const currency = currencyFor(i.country);
  const x = resolveExtras(i);
  const w = computeWacc(i.wacc, currency, x.waccAdjustment);
  const g = n(i.growth) / 100, xm = n(i.exitMultiple), wD = n(i.dcfWeight);
  const mid = i.midYear, nd = n(i.netDebt);
  const disc = (n(i.privateDiscount) || 0) / 100;
  // CHANGED: the discount applies to the exit multiple too. With no discount
  // this is the entered multiple exactly.
  const xmApplied = disc ? xm * (1 - disc) : xm;

  const reported = i.financials;
  const fin = normalisedFinancials(reported, x.normalisation);
  const rows = projections(fin, w.t);

  const base = dcf(rows, w.wacc, g, xmApplied, mid);
  const loG = dcf(rows, w.wacc + 0.01, g - 0.005, xmApplied, mid).evG;
  const hiG = dcf(rows, w.wacc - 0.01, g + 0.005, xmApplied, mid).evG;
  const loX = dcf(rows, w.wacc + 0.01, g, xmApplied - 1, mid).evX;
  const hiX = dcf(rows, w.wacc - 0.01, g, xmApplied + 1, mid).evX;

  const cm = compsMultiples(i.industry, i.peers);
  const ltmReported = n(reported.ebitda[HISTORY_YEARS - 1]);
  const oneOff = z(x.normalisation.oneOff), owner = z(x.normalisation.ownerCosts);
  const normUsed = oneOff !== 0 || owner !== 0;
  const ltmE = normUsed ? ltmReported + oneOff + owner : ltmReported;
  const ltmR = n(reported.rev[HISTORY_YEARS - 1]);
  const cE = ltmE > 0 ? (cm.ebitda.map((m) => ltmE * m * (1 - disc)) as Range3) : null;
  const cR = cm.revenue.map((m) => ltmR * m * (1 - disc)) as Range3;

  const dcfRange = [0, 1, 2].map((k) => {
    const G = [loG, base.evG, hiG][k], X = [loX, base.evX, hiX][k];
    return Number.isFinite(X) ? (G + X) / 2 : G;
  }) as Range3;
  const compRange = cE || cR;
  const ev = [0, 1, 2].map((k) => (wD / 100) * dcfRange[k] + (1 - wD / 100) * compRange[k]) as Range3;

  const b = x.bridge;
  const bridge: BridgeResult = {
    eosb: z(b.eosb),
    leases: z(b.leases),
    minorityInterest: z(b.minorityInterest),
    surplusAssets: z(b.surplusAssets),
    otherClaims: z(b.eosb) + z(b.leases) + z(b.minorityInterest) - z(b.surplusAssets),
  };
  const claims = bridge.otherClaims;
  // With no other claims the reference's `ev - netDebt` is kept exactly.
  const equity = ev.map((v) => (claims ? v - nd - claims : v - nd)) as Range3;
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
      if (!(W2 > G2 + 0.005)) return NaN;
      const evG = dcf(rows, W2, G2, xmApplied, mid).evG;
      return claims ? evG - nd - claims : evG - nd;
    }),
  );

  /* Stake ---------------------------------------------------------------- */
  const st = x.stake;
  const stakePct = n(st.percent);
  const adjustmentRate =
    st.adjustment === 'control_premium'
      ? n(st.controlPremium) / 100
      : st.adjustment === 'minority_discount'
        ? -n(st.minorityDiscount) / 100
        : 0;
  const stakeFactor = (stakePct / 100) * (1 + adjustmentRate);
  const stake: StakeResult = {
    percent: stakePct,
    adjustment: st.adjustment,
    adjustmentRate,
    value: equityDisplay.map((v) => v * stakeFactor) as Range3,
    used: stakePct !== 100 || adjustmentRate !== 0,
  };

  /* Ratios --------------------------------------------------------------- */
  const revs = fin.rev.map(n), ebs = fin.ebitda.map(n);
  const sum = (arr: number[]) => arr.reduce((a, v) => a + v, 0);
  const ic = n(x.investedCapital);
  const ltmDa = z(reported.da[HISTORY_YEARS - 1]);
  const roic = ic > 0 ? ((ltmE - ltmDa) * (1 - w.t)) / ic : NaN;
  const nopatT = last.ebit - last.tax;
  const reinvestT = last.capex - last.da + last.dnwc;
  const reinvestmentRate = nopatT > 0 ? reinvestT / nopatT : NaN;
  const ratios: KeyRatios = {
    revenueCagrHistory: Math.pow(revs[HISTORY_YEARS - 1] / revs[0], 1 / (HISTORY_YEARS - 1)) - 1,
    revenueCagrForecast: Math.pow(revs[TOTAL_YEARS - 1] / revs[HISTORY_YEARS - 1], 1 / FORECAST_YEARS) - 1,
    ebitdaMarginLtm: ltmE / ltmR,
    ebitdaMarginTerminal: last.ebitda / last.rev,
    capexIntensity: sum(rows.map((r) => r.capex)) / sum(rows.map((r) => r.rev)),
    nwcIntensity: z(fin.nwc[TOTAL_YEARS - 1]) / last.rev,
    fcfConversion: sum(rows.map((r) => r.ebitda)) > 0 ? sum(rows.map((r) => r.fcf)) / sum(rows.map((r) => r.ebitda)) : NaN,
    roic,
    impliedGrowthFromReinvestment: Number.isFinite(roic) && Number.isFinite(reinvestmentRate) ? reinvestmentRate * roic : NaN,
    reinvestmentRate,
  };

  /* Warnings ------------------------------------------------------------- */
  const warnings: Warning[] = [];
  const rule = WARNING_RULES;
  if (Number.isFinite(tvShare) && tvShare > rule.terminalValueShare) {
    warnings.push({ code: 'terminal_value_share', values: { share: tvShare, threshold: rule.terminalValueShare } });
  }
  const ceiling = countryFor(i.country)?.growthCeiling;
  if (ceiling !== undefined && g * 100 > ceiling) {
    warnings.push({ code: 'growth_ceiling', values: { growth: g, ceiling: ceiling / 100 } });
  }
  if (Number.isFinite(impliedExitMultiple) && xmApplied > 0 && Math.abs(impliedExitMultiple - xmApplied) / xmApplied > rule.exitMultipleMismatch) {
    warnings.push({ code: 'exit_multiple_mismatch', values: { applied: xmApplied, implied: impliedExitMultiple, threshold: rule.exitMultipleMismatch } });
  }
  if (last.fcf < 0) warnings.push({ code: 'terminal_fcf_negative', values: { fcf: last.fcf } });
  const marginLtm = ltmE / ltmR, marginF1 = rows[0].ebitda / rows[0].rev;
  if (Number.isFinite(marginLtm) && Number.isFinite(marginF1) && Math.abs(marginF1 - marginLtm) * 100 > rule.marginJumpPoints) {
    warnings.push({ code: 'margin_jump', values: { from: marginLtm, to: marginF1, threshold: rule.marginJumpPoints / 100 } });
  }
  if (Number.isFinite(roic) && roic < w.wacc) warnings.push({ code: 'roic_below_wacc', values: { roic, wacc: w.wacc } });
  // Terminal growth against expected local inflation. Pegged currencies take
  // long-run US inflation; the others the inflation entered on step 3.
  const inflationPct = currency.pegged ? MARKET.usInflationLongRun : n(i.wacc.inflationLocal);
  if (Number.isFinite(inflationPct)) {
    const lowPct = inflationPct - rule.inflationBelowPoints, highPct = inflationPct + rule.inflationAbovePoints;
    const gPct = g * 100;
    if (gPct < lowPct - 1e-9 || gPct > highPct + 1e-9) {
      warnings.push({ code: 'growth_vs_inflation', values: { growth: g, inflation: inflationPct / 100, low: lowPct / 100, high: highPct / 100 } });
    }
  }
  if (st.adjustment === 'control_premium' && stakePct <= rule.controlStakeAbovePercent) {
    warnings.push({ code: 'premium_on_minority_stake', values: { percent: stakePct, threshold: rule.controlStakeAbovePercent, premium: adjustmentRate } });
  }
  if (
    Number.isFinite(ratios.impliedGrowthFromReinvestment) &&
    Math.abs(ratios.impliedGrowthFromReinvestment - g) * 100 > rule.reinvestmentGapPoints
  ) {
    warnings.push({
      code: 'reinvestment_inconsistent',
      values: { implied: ratios.impliedGrowthFromReinvestment, growth: g, reinvestmentRate, roic, threshold: rule.reinvestmentGapPoints / 100 },
    });
  }

  /* Scenarios ------------------------------------------------------------ */
  const sc = x.scenarios;
  let scenarios: ScenarioResult[] = [];
  let weightedEquity = NaN;
  const partial = {
    ev, equity, equityDisplay,
    terminalRevenue: last.rev, terminalEbitda: last.ebitda,
  };
  if (withScenarios) {
    const run = (key: 'downside' | 'upside', gp: number, mp: number, weight: number): ScenarioResult => {
      const r = compute({ ...i, financials: scenarioFinancials(reported, gp, mp) }, false);
      const lastRow = r.rows[r.rows.length - 1];
      return {
        key, weight, growthPoints: gp, marginPoints: mp,
        ev: r.ev, equity: r.equity, equityDisplay: r.equityDisplay,
        terminalRevenue: lastRow.rev, terminalEbitda: lastRow.ebitda,
      };
    };
    scenarios = [
      run('downside', n(sc.downsideGrowth), n(sc.downsideMargin), n(sc.weightDownside) / 100),
      { key: 'base', weight: n(sc.weightBase) / 100, growthPoints: 0, marginPoints: 0, ...partial },
      run('upside', n(sc.upsideGrowth), n(sc.upsideMargin), n(sc.weightUpside) / 100),
    ];
    weightedEquity = Math.max(0, scenarios.reduce((a, s) => a + s.weight * s.equity[1], 0));
  }

  return {
    schemaVersion: INPUT_SCHEMA_VERSION,
    currency,
    years: financialYears(i.financialYear),
    wacc: w,
    growth: g,
    exitMultiple: xm,
    exitMultipleApplied: xmApplied,
    midYear: mid,
    netDebt: nd,
    privateDiscount: disc,
    dcfWeight: wD,
    revenue: revs,
    ebitda: ebs,
    ltmRevenue: ltmR,
    ltmEbitda: ltmE,
    ltmEbitdaReported: ltmReported,
    normalisation: { oneOff, ownerCosts: owner, carryOwnerCosts: x.normalisation.carryOwnerCosts, used: normUsed },
    rows,
    base,
    loG, hiG, loX, hiX,
    comps: cm,
    compsEbitda: cE,
    compsRevenue: cR,
    dcfRange,
    compRange,
    ev,
    bridge,
    equity,
    equityDisplay,
    equityFloor,
    tvShare,
    impliedExitMultiple,
    ltmMultiple,
    sensitivity: { waccs, growths, grid },
    scenarios,
    weightedEquity,
    stake,
    ratios,
    warnings,
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
