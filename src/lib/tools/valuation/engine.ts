/**
 * The Business Valuation engine. Pure functions, no UI, no I/O.
 *
 * The browser runs it to show results, and the lead API runs it again on the
 * submitted inputs, so what is stored, emailed and put in the PDF never depends
 * on numbers a browser sent.
 *
 * ONE RESULT OBJECT. `runValuation` returns a `ValuationResult`, and that object
 * is the only source for the results page, the PDF report, the emails, the
 * admin view and the verifiers. Every figure any of them shows is a field on it,
 * held unrounded; rounding happens only where a figure is formatted
 * (`format.ts`). Nothing downstream computes a value.
 *
 * The version 1 arithmetic is a port of the reference implementation at
 * `reference/tools/business-valuation.html`, including its order of operations.
 * `npm run verify-valuation-engine` holds it to that by running the reference in
 * headless Chrome, with `REFERENCE_METHOD` and the version 3 inputs neutral.
 * Deliberate departures from the reference are marked CHANGED.
 *
 * VERSION 2 (schema version 2) added normalised EBITDA, bridge items below net
 * debt, stake value, scenarios, a WACC adjustment for the exploration sliders,
 * invested capital for ROIC and key ratios.
 *
 * VERSION 3 (schema version 3, 2026-09-17):
 *   - CHANGED: the perpetuity terminal value is built on a normalised terminal
 *     cash flow, with reinvestment sized for long-term growth rather than the
 *     final forecast year's growth (`terminalCashFlow`).
 *   - CHANGED: the valuation date is the date the valuation is run, and the
 *     first forecast year is cut to the part after it (`stubPeriod`).
 *   - Saudi / GCC ownership: zakat on the GCC-owned share, corporate tax on the
 *     rest (`taxProfile`).
 *   - CHANGED: tax losses are carried forward, capped per country.
 *   - Checks (`checks.ts`) and recommendations (`recommendations.ts`) are
 *     selected here, from the result, rather than by the report.
 *   - An optional equity raise, for pre-money and post-money values.
 * Stored version 2 inputs still run: `resolveExtras` treats an absent ownership
 * share on them as 0%, which is the corporate tax they were computed with.
 *
 * Units: rates arrive as percent (5 means 5%), exactly as a person types them,
 * and are converted here. Money is in millions of the selected currency. A blank
 * field is `null` and behaves as the reference's NaN.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import { buildChecks } from './checks';
import type { CompanyProfile } from './profile';
import { buildRecommendations } from './recommendations';
import {
  ASSUMPTIONS,
  COUNTRIES,
  DEAL_BANDS_SAR,
  INDUSTRIES,
  TAX,
  V2_DEFAULTS,
  VALUATION_DATA_VERSION,
  marketDataInUse,
  type DatedValue,
  type IndustryData,
} from './data';

export const HISTORY_YEARS = 3;
export const FORECAST_YEARS = 5;
export const TOTAL_YEARS = HISTORY_YEARS + FORECAST_YEARS;

/** The inputs schema version written by this code. Stored on every lead's inputs and result. */
export const INPUT_SCHEMA_VERSION = 4;

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
  /** Corporate income tax rate, percent. For Saudi Arabia, zakat is blended in by `taxProfile`. */
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
  /**
   * Net debt at the end of the last actual financial year. Entered directly
   * before version 4; from version 4 it is borrowings less cash, derived by
   * `withNetDebtFromBalances` on every run, so the two can never disagree.
   */
  netDebt: number | null;
  /** Version 4. Borrowings at the end of the last actual financial year: loans, overdrafts and other interest-bearing debt. */
  debt?: number | null;
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
  /** Company name and a description for the report. Never read by the engine's arithmetic. See `profile.ts`. */
  profile?: CompanyProfile;
  /* Version 3 ------------------------------------------------------------- */
  /** Saudi / GCC ownership, percent. Read for Saudi Arabia only. */
  gccOwnership?: number | null;
  /**
   * The valuation date, YYYY-MM-DD. The server stamps its own date on every
   * input it recomputes. Blank means no stub period (the reference's timing).
   */
  valuationDate?: string | null;
  /** What the valuation is for, one of `PURPOSES`. Only decides wording and the pre-money note. */
  purpose?: string | null;
  /** Equity the business plans to raise, millions. Optional, and only asked when raising equity. */
  raiseAmount?: number | null;
  /**
   * Cash at the last financial year end, millions. From version 4 it is
   * required in every country: it nets off borrowings to give net debt, and in
   * Saudi Arabia it also adds to the zakat base. Before version 4 it was
   * optional, Saudi Arabia only, and used for the zakat base alone.
   */
  cash?: number | null;
};

export type Currency = { code: string; pegged: boolean; sarPerUnit: number };

/**
 * How the engine values, as opposed to what it values. The site always uses
 * `CURRENT_METHOD`. `REFERENCE_METHOD` reproduces the reference implementation
 * and exists only so `verify-valuation-engine` can still prove the rest of the
 * arithmetic against it.
 */
export type EngineOptions = {
  terminalCashFlow: 'normalised' | 'final_year';
  lossCarryForward: boolean;
};
export const CURRENT_METHOD: EngineOptions = { terminalCashFlow: 'normalised', lossCarryForward: true };
export const REFERENCE_METHOD: EngineOptions = { terminalCashFlow: 'final_year', lossCarryForward: false };

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
/* Version 2 and 3 defaults                                                  */
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

/** Fills every absent version 2 and 3 field with its default for the inputs' schema version. */
export function resolveExtras(i: ValuationInputs) {
  const d = defaultExtras();
  const schema = i.schemaVersion ?? 1;
  const gcc = i.gccOwnership;
  return {
    normalisation: i.normalisation ?? d.normalisation,
    bridge: i.bridge ?? d.bridge,
    stake: i.stake ?? d.stake,
    scenarios: i.scenarios ?? d.scenarios,
    investedCapital: i.investedCapital ?? null,
    waccAdjustment: z(i.waccAdjustment),
    // Inputs stored before version 3 were computed on corporate tax alone, which
    // is 0% GCC ownership. From version 3 the field is required for Saudi
    // Arabia (`validateCompany`), so it has no default: blank stays null.
    gccOwnership: gcc === null || gcc === undefined ? (schema >= 3 ? null : 0) : gcc,
    valuationDate: isIsoDate(i.valuationDate) ? (i.valuationDate as string) : null,
    raiseAmount: i.raiseAmount === null || i.raiseAmount === undefined ? null : i.raiseAmount,
    purpose: i.purpose ?? null,
    cash: i.cash === null || i.cash === undefined ? null : i.cash,
  };
}

/* ------------------------------------------------------------------------ */
/* Tax, zakat and losses                                                     */
/* ------------------------------------------------------------------------ */

export type TaxProfile = {
  /** Corporate income tax rate as entered, ratio. */
  cit: number;
  /** True for Saudi Arabia, where zakat applies to the GCC-owned share. */
  zakatApplies: boolean;
  /** Saudi / GCC ownership, ratio. 0 outside Saudi Arabia. */
  gccOwnership: number;
  zakatRate: number;
  /**
   * How zakat is estimated on the GCC-owned share.
   *   'base'  2.5% of an approximate zakat base (see `zakatBase`).
   *   'none'  no GCC share, or not Saudi Arabia.
   * 'profit_proxy' (2.5% of positive EBIT) was used between 2026-09-17 commits
   * when the base needed invested capital; no result carries it now.
   */
  zakatMethod: 'base' | 'profit_proxy' | 'none';
  /**
   * The rate on positive EBIT, used for FCFF income tax, terminal NOPAT, the
   * after-tax cost of debt and beta relevering: corporate tax on the non-GCC
   * share only, (1 - GCC) x CIT, since zakat is a charge on the base, not on
   * profit. Equal to CIT outside Saudi Arabia.
   */
  rate: number;
  lossCarryForward: boolean;
  /** Share of a year's taxable profit that brought-forward losses can offset, ratio. */
  lossOffsetCap: number;
};

export function taxProfile(
  country: string,
  taxPercent: number | null,
  gccOwnershipPercent: number | null,
  opts: EngineOptions = CURRENT_METHOD,
): TaxProfile {
  const cit = n(taxPercent) / 100;
  const c = countryFor(country);
  const zakatApplies = country === TAX.zakatCountry;
  const zakatRate = TAX.zakatRate / 100;
  const share = zakatApplies ? Math.min(1, Math.max(0, z(gccOwnershipPercent) / 100)) : 0;
  const zakatMethod = share ? 'base' : 'none';
  return {
    cit,
    zakatApplies,
    gccOwnership: share,
    zakatRate,
    zakatMethod,
    // With no GCC share the entered rate is kept exactly, as the reference used it.
    rate: zakatMethod === 'none' ? cit : (1 - share) * cit,
    lossCarryForward: opts.lossCarryForward,
    lossOffsetCap: (c?.lossOffsetCap ?? 100) / 100,
  };
}

/**
 * The approximate zakat base at a year end: net working capital plus cash,
 * floored at zero. Cash is optional; without it the base is working capital
 * alone and the report says it may be understated. Cash is held at its
 * entered year end level through the forecast.
 */
export function zakatBase(nwc: number, cash: number | null): number {
  return Math.max(0, nwc + (cash ?? 0));
}

/* ------------------------------------------------------------------------ */
/* Valuation date and stub period                                            */
/* ------------------------------------------------------------------------ */

function isIsoDate(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A date as YYYY-MM-DD in UTC. What the server stamps on inputs it recomputes. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Financial years are taken to end on 31 December: the form asks for a year, not a month. */
export function financialYearEnd(fy: number | null): string {
  const y = fy && Number.isFinite(fy) ? Math.trunc(fy) : ASSUMPTIONS.defaultFinancialYear;
  return `${y}-12-31`;
}

/** Months from one date to another, with the part month as days over that month's length. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const pos = (iso: string) => {
    const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y * 12 + (m - 1) + d / dim;
  };
  return pos(toIso) - pos(fromIso);
}

export type StubPeriod = {
  lastFyEnd: string;
  valuationDate: string | null;
  /** Months from the last financial year end to the valuation date. 0 without a valuation date. */
  months: number;
  /** The share of the first forecast year already elapsed at the valuation date, 0 to below 1. */
  fraction: number;
  /** The last actual year ended twelve months or more before the valuation date. The run is refused. */
  tooOld: boolean;
};

export function stubPeriod(financialYear: number | null, valuationDate: string | null): StubPeriod {
  const lastFyEnd = financialYearEnd(financialYear);
  if (!valuationDate) return { lastFyEnd, valuationDate: null, months: 0, fraction: 0, tooOld: false };
  const months = monthsBetween(lastFyEnd, valuationDate);
  // A year still in progress (the date before its end) takes no stub.
  const fraction = Math.min(1, Math.max(0, months / 12));
  return { lastFyEnd, valuationDate, months, fraction, tooOld: months / 12 >= 1 };
}

export const DEBT_REQUIRED_MESSAGE = 'Enter borrowings. Use 0 if none.';
export const CASH_REQUIRED_MESSAGE = 'Enter cash. Use 0 if none.';
export const GCC_REQUIRED_MESSAGE = 'Enter the Saudi / GCC ownership share, from 0% to 100%.';

export const STUB_TOO_OLD_MESSAGE =
  'Your latest actual year is more than 12 months old. Please enter the latest full year as actuals.';

/* ------------------------------------------------------------------------ */
/* Cost of capital                                                           */
/* ------------------------------------------------------------------------ */

export type WaccBreakdown = {
  rf: number; erp: number; crp: number; bu: number; de: number; sp: number;
  ds: number; cs: number;
  /** The tax rate used throughout: relevering, cost of debt, FCFF and terminal NOPAT. Effective rate for Saudi Arabia. */
  t: number;
  /** Corporate income tax as entered. Equal to `t` unless zakat is blended in. Absent on results stored before version 3. */
  cit?: number;
  bl: number; ke: number; kd: number; kdt: number; we: number; wd: number;
  waccUsd: number; wacc: number;
  /** Percentage points added by the exploration slider, as a ratio. 0 unless adjusted. */
  adjustment: number;
};

/**
 * `taxRate` overrides the entered tax rate with an effective one (zakat blended
 * in). The one tax rate is used for relevering beta as well as the cost of
 * debt, so a business's interest shield is valued the same way in both.
 */
export function computeWacc(w: WaccInputs, currency: Currency, adjustmentPoints = 0, taxRate?: number): WaccBreakdown {
  const rf = n(w.rf) / 100, erp = n(w.erp) / 100, crp = n(w.crp) / 100, bu = n(w.bu),
    de = n(w.de) / 100, sp = n(w.sp) / 100, ds = n(w.ds) / 100, cs = n(w.cs) / 100,
    cit = n(w.tax) / 100;
  const t = taxRate === undefined ? cit : taxRate;
  const bl = bu * (1 + (1 - t) * de);
  const ke = rf + bl * erp + crp + sp;
  const kd = rf + ds + cs, kdt = kd * (1 - t);
  const wd = de / (1 + de), we = 1 - wd;
  const waccUsd = we * ke + wd * kdt;
  const conv = currency.pegged ? 1 : (1 + n(w.inflationLocal) / 100) / (1 + n(w.inflationUs) / 100);
  const base = (1 + waccUsd) * conv - 1;
  const adjustment = adjustmentPoints / 100;
  return {
    rf, erp, crp, bu, de, sp, ds, cs, t, cit, bl, ke, kd, kdt, we, wd, waccUsd,
    // Adding a literal 0 would still be exact, but the branch keeps the
    // unadjusted value bit-for-bit identical to the reference's.
    wacc: adjustment ? base + adjustment : base,
    adjustment,
  };
}

/** The WACC for a set of inputs, with the effective tax rate. What the form and the engine both use. */
export function waccFor(i: ValuationInputs, adjustmentPoints = 0): WaccBreakdown {
  const x = resolveExtras(i);
  return computeWacc(i.wacc, currencyFor(i.country), adjustmentPoints, taxProfile(i.country, i.wacc.tax, x.gccOwnership, CURRENT_METHOD).rate);
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

/** Whether these inputs enter borrowings and cash separately (version 4 on). */
export function entersDebtAndCash(i: Pick<ValuationInputs, 'schemaVersion' | 'debt'>): boolean {
  return (i.schemaVersion ?? 1) >= 4 || (i.debt !== null && i.debt !== undefined);
}

/**
 * Net debt from borrowings and cash, for inputs that enter them separately.
 * Earlier inputs keep the net debt they were entered with.
 */
export function withNetDebtFromBalances<T extends ValuationInputs>(i: T): T {
  if (!entersDebtAndCash(i)) return i;
  const debt = i.debt, cash = i.cash;
  const complete = typeof debt === 'number' && Number.isFinite(debt) && typeof cash === 'number' && Number.isFinite(cash);
  return { ...i, netDebt: complete ? debt - cash : null };
}

export function validateCompany(
  i: Pick<ValuationInputs, 'industry' | 'country' | 'financialYear' | 'netDebt' | 'bridge' | 'gccOwnership' | 'valuationDate' | 'raiseAmount' | 'schemaVersion' | 'cash' | 'debt'>,
): FieldErrors {
  const e: FieldErrors = {};
  if (!industryFor(i.industry)) e.industry = 'Select an industry.';
  if (!(i.country in COUNTRIES)) e.country = 'Select a country.';
  const fy = n(i.financialYear);
  if (!(fy >= ASSUMPTIONS.minFinancialYear && fy <= ASSUMPTIONS.maxFinancialYear)) {
    e.financialYear = `Enter a year between ${ASSUMPTIONS.minFinancialYear} and ${ASSUMPTIONS.maxFinancialYear}.`;
  } else if (stubPeriod(fy, isIsoDate(i.valuationDate) ? (i.valuationDate as string) : null).tooOld) {
    e.financialYear = STUB_TOO_OLD_MESSAGE;
  }
  if (entersDebtAndCash(i)) {
    if (!(typeof i.debt === 'number' && i.debt >= 0)) e.debt = DEBT_REQUIRED_MESSAGE;
    if (!(typeof i.cash === 'number' && i.cash >= 0)) e.cash = CASH_REQUIRED_MESSAGE;
  } else if (!Number.isFinite(n(i.netDebt))) e.netDebt = 'Enter net debt. Use 0 if none.';
  const b = i.bridge;
  if (b) {
    for (const k of ['eosb', 'leases', 'minorityInterest', 'surplusAssets'] as const) {
      if (!finiteOrNull(b[k]) || z(b[k]) < 0) e[k] = 'Enter a positive amount, or leave blank.';
    }
  }
  if (i.country === TAX.zakatCountry) {
    const g = i.gccOwnership;
    // Required from version 3; inputs stored earlier were valued without it.
    if ((g === null || g === undefined) && (i.schemaVersion ?? 1) >= 3) e.gccOwnership = GCC_REQUIRED_MESSAGE;
    else if (g !== null && g !== undefined && !(g >= 0 && g <= 100)) e.gccOwnership = GCC_REQUIRED_MESSAGE;
  }
  if (!entersDebtAndCash(i) && i.cash !== null && i.cash !== undefined && !(i.cash >= 0)) e.cash = 'Enter cash as a positive amount, or leave it blank.';
  if (i.raiseAmount !== null && i.raiseAmount !== undefined && !(i.raiseAmount >= 0)) {
    e.raiseAmount = 'Enter the amount to raise as a positive number, or leave it blank.';
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
  /** Net working capital at the year end. Absent on results stored before version 3. */
  nwc?: number;
  /** Brought-forward losses used against this year's profit. */
  lossUsed?: number;
  /** Losses still available after this year. */
  lossPool?: number;
  /** Corporate income tax, after losses. `tax` is this plus `zakat`. */
  incomeTax?: number;
  /** Zakat on the approximate base, when the zakat base method is used. */
  zakat?: number;
  /** The approximate zakat base at the year end (see `zakatBase`). */
  zakatBase?: number;
};

export type LossRule = { carryForward: boolean; cap: number };

/** Zakat on the base: GCC share times the zakat rate, and the cash held in the base. */
export type ZakatRule = { shareRate: number; cash: number | null };

/**
 * Forecast free cash flow to the firm. Tax is charged on positive EBIT only.
 * CHANGED from the reference: losses are carried forward. The pool opens with
 * the losses in the three actual years (net of what their own later profits
 * used) and each profitable year may offset up to `cap` of its profit.
 */
export function projections(fin: Financials, t: number, loss: LossRule = { carryForward: false, cap: 1 }, zakat: ZakatRule | null = null): ProjectionRow[] {
  const zz = (v: number | null) => (Number.isFinite(n(v)) ? (v as number) : 0);
  let pool = 0;
  const useLosses = (ebit: number): number => {
    if (!loss.carryForward) return 0;
    if (ebit < 0) {
      pool += -ebit;
      return 0;
    }
    const used = Math.min(pool, loss.cap * ebit);
    pool -= used;
    return used;
  };
  for (let i = 0; i < HISTORY_YEARS; i++) useLosses(n(fin.ebitda[i]) - zz(fin.da[i]));

  const rows: ProjectionRow[] = [];
  for (let i = HISTORY_YEARS; i < TOTAL_YEARS; i++) {
    const ebitda = n(fin.ebitda[i]), da = zz(fin.da[i]), capex = zz(fin.capex[i]);
    const nwcPrev = i === HISTORY_YEARS ? zz(fin.nwc[HISTORY_YEARS - 1]) : zz(fin.nwc[i - 1]);
    const nwc = zz(fin.nwc[i]);
    const dnwc = nwc - nwcPrev;
    const ebit = ebitda - da;
    const lossUsed = useLosses(ebit);
    const incomeTax = lossUsed ? (Math.max(0, ebit) - lossUsed) * t : Math.max(0, ebit) * t;
    if (!zakat) {
      rows.push({ rev: n(fin.rev[i]), ebitda, da, ebit, tax: incomeTax, capex, dnwc, fcf: ebit - incomeTax + da - capex - dnwc, nwc, lossUsed, lossPool: pool, incomeTax });
      continue;
    }
    // Zakat is due on the base whether or not the year makes a profit.
    const base = zakatBase(nwc, zakat.cash);
    const zakatAmount = base * zakat.shareRate;
    const tax = incomeTax + zakatAmount;
    rows.push({ rev: n(fin.rev[i]), ebitda, da, ebit, tax, capex, dnwc, fcf: ebit - tax + da - capex - dnwc, nwc, lossUsed, lossPool: pool, incomeTax, zakat: zakatAmount, zakatBase: base });
  }
  return rows;
}

export type TerminalCashFlow = {
  /** Final forecast year EBIT, floored at zero, grown one year and taxed at the effective rate. */
  nopat: number;
  /** Revenue growth in the final forecast year. */
  growthFinalYear: number;
  /** Capex less D&A in the final forecast year. */
  netCapexFinalYear: number;
  /** Net capex scaled to long-term growth. */
  netCapex: number;
  /** Working capital over revenue in the final forecast year. */
  wcIntensity: number;
  /** Working capital investment at long-term growth. */
  dWc: number;
  fcf: number;
  /** Revenue in the first year after the forecast, for display. */
  revenue: number;
  /** EBIT in the first year after the forecast, floored at zero, for display. */
  ebit: number;
  /** Income tax on that EBIT plus, with the zakat base method, zakat on the base grown one year. */
  tax: number;
  zakat: number;
  /** Net capex plus working capital investment at long-term growth. */
  reinvestment: number;
  /** Reinvestment over NOPAT. NaN when NOPAT is not positive. */
  reinvestmentRate: number;
  /**
   * The return on new capital the terminal value implies: g over the
   * reinvestment rate. NaN when reinvestment is not positive, when the
   * perpetuity assumes growth without investment and the implied return is not
   * meaningful.
   */
  impliedRoic: number;
};

/**
 * CHANGED from the reference, which grew the final forecast year's free cash
 * flow at `g` for ever. That year's reinvestment is sized for the forecast's
 * growth, not for `g`, so the perpetuity understated value whenever the
 * forecast grew faster than `g`. Reinvestment is rescaled to `g` here:
 *
 *   NOPAT       = max(EBIT_T, 0) x (1 + g) x (1 - t)
 *   Net capex   = (Capex_T - D&A_T) x g / growth_T   when growth_T > g (and positive)
 *               = (Capex_T - D&A_T) x (1 + g)        otherwise
 *   Working cap = (NWC_T / Rev_T) x Rev_T x g
 *   FCF         = NOPAT - Net capex - Working cap
 */
export function terminalCashFlow(rows: ProjectionRow[], g: number, t: number, zakatShareRate = 0): TerminalCashFlow {
  const last = rows[rows.length - 1], prev = rows[rows.length - 2];
  const ebit = Math.max(last.ebit, 0) * (1 + g);
  const zakat = zakatShareRate ? (last.zakatBase ?? 0) * (1 + g) * zakatShareRate : 0;
  const tax = zakat ? ebit * t + zakat : ebit * t;
  const nopat = ebit - tax;
  const growthFinalYear = last.rev / prev.rev - 1;
  const netCapexFinalYear = last.capex - last.da;
  const netCapex = growthFinalYear > g && growthFinalYear > 0 ? netCapexFinalYear * (g / growthFinalYear) : netCapexFinalYear * (1 + g);
  const nwc = last.nwc ?? 0;
  const wcIntensity = nwc / last.rev;
  const dWc = wcIntensity * last.rev * g;
  const reinvestment = netCapex + dWc;
  const reinvestmentRate = nopat > 0 ? reinvestment / nopat : NaN;
  return {
    nopat, growthFinalYear, netCapexFinalYear, netCapex, wcIntensity, dWc,
    fcf: nopat - netCapex - dWc,
    revenue: last.rev * (1 + g),
    ebit,
    tax,
    zakat,
    reinvestment,
    reinvestmentRate,
    impliedRoic: reinvestmentRate > 0 ? g / reinvestmentRate : NaN,
  };
}

export type TerminalBasis = { mode: EngineOptions['terminalCashFlow']; taxRate: number; zakatShareRate?: number };

export type DcfResult = {
  pv: number; dfs: number[]; dfN: number; tvG: number; tvX: number; evG: number; evX: number;
  /** Discount period of each forecast year, and of the terminal value. Absent on results stored before version 3. */
  periods?: number[];
  periodN?: number;
  /** Each year's free cash flow after the stub cut. */
  fcfValued?: number[];
  /** The cash flow the perpetuity was built on. */
  tvFcf?: number;
};

/**
 * `stub` is the share of the first forecast year already gone at the valuation
 * date. Year 1 keeps (1 - stub) of its cash flow, discounted at (1 - stub) / 2
 * mid-year; later years at (i - 0.5) - stub; the terminal value at N - stub.
 * With a stub of 0 every period is the reference's exactly.
 */
export function dcf(
  rows: ProjectionRow[],
  wacc: number,
  g: number,
  mult: number,
  mid: boolean,
  stub = 0,
  basis: TerminalBasis = { mode: 'final_year', taxRate: 0 },
): DcfResult {
  let pv = 0;
  const dfs: number[] = [], periods: number[] = [], fcfValued: number[] = [];
  rows.forEach((r, k) => {
    const period = k === 0 ? (mid ? (1 - stub) / 2 : 1 - stub) : k + 1 - (mid ? 0.5 : 0) - stub;
    const df = 1 / Math.pow(1 + wacc, period);
    const cf = k === 0 && stub ? r.fcf * (1 - stub) : r.fcf;
    periods.push(period);
    dfs.push(df);
    fcfValued.push(cf);
    pv += cf * df;
  });
  const last = rows[rows.length - 1];
  const periodN = rows.length - stub;
  const dfN = 1 / Math.pow(1 + wacc, periodN);
  const tvFcf = basis.mode === 'normalised' ? terminalCashFlow(rows, g, basis.taxRate, basis.zakatShareRate ?? 0).fcf : last.fcf * (1 + g);
  const tvG = wacc > g ? tvFcf / (wacc - g) : NaN;
  const tvX = last.ebitda > 0 ? last.ebitda * mult : NaN;
  return { pv, dfs, dfN, tvG, tvX, evG: pv + tvG * dfN, evX: pv + tvX * dfN, periods, periodN, fcfValued, tvFcf };
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

/** Version 2 warning codes. Results from version 3 carry `checks` instead; these format stored leads. */
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

export type CheckId =
  | 'method_divergence'
  | 'terminal_gap'
  | 'tv_share'
  | 'peer_count'
  | 'capital_structure'
  | 'margin_step'
  | 'no_normalisation'
  | 'negative_ebitda'
  | 'growth_ceiling'
  | 'growth_vs_inflation'
  | 'terminal_fcf'
  | 'roic_below_wacc'
  | 'terminal_roic'
  | 'reinvestment'
  | 'stake_premium';

export type Check = {
  id: CheckId;
  label: string;
  status: 'pass' | 'warning';
  message: string;
  /** Set on the terminal value share check above its strong threshold. */
  strong?: boolean;
  values: Record<string, number>;
};

export type RecommendationId =
  | 'reduce_risk'
  | 'review_normalisation'
  | 'evidence_normalisation'
  | 'cash_conversion'
  | 'forecast_credibility'
  | 'returns'
  | 'margin'
  | 'diligence';

/** Chosen by rule. The wording is `format.ts`'s. */
export type Recommendation = { id: RecommendationId; values: Record<string, number> };

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
  /** Free cash flow in the part of year one before the valuation date. Absent before version 3. */
  elapsedFcf?: number;
  /** After-tax interest on positive net debt for the elapsed period. */
  elapsedInterest?: number;
  /** Net debt at the valuation date: as entered, less `elapsedFcf`, plus `elapsedInterest`. Absent before version 3. */
  netDebtAtValuationDate?: number;
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

/** One forecast year of the DCF, everything the FCFF table prints. */
export type ForecastLine = ProjectionRow & {
  year: number;
  fcfValued: number;
  period: number;
  df: number;
  pv: number;
};

export type TerminalResult = TerminalCashFlow & {
  method: EngineOptions['terminalCashFlow'];
  tvPerpetuity: number;
  tvExit: number;
  period: number;
  df: number;
  pvPerpetuity: number;
  pvExit: number;
  /** Perpetuity terminal value over final year EBITDA, undiscounted. */
  impliedMultiple: number;
  /** Present value of the perpetuity terminal value over the perpetuity DCF. */
  tvShare: number;
};

export type DcfBlock = {
  pvForecast: number;
  perpetuity: Range3;
  /** Null when final year EBITDA is not positive. */
  exit: Range3 | null;
  /** The DCF used in the blend. */
  combined: Range3;
  /** How `combined` is formed: the simple average of the two, or perpetuity alone. */
  combination: 'average' | 'perpetuity_only';
  /** Combined DCF enterprise value to equity. */
  equity: Range3;
  /** Perpetuity DCF base case to equity. The sensitivity table's centre cell. */
  perpetuityEquityBase: number;
};

export type ComparablesBlock = {
  ebitdaMultiplesPre: Range3;
  ebitdaMultiplesPost: Range3;
  revenueMultiplesPre: Range3;
  revenueMultiplesPost: Range3;
  /** Null when last actual EBITDA is not positive. */
  ebitdaValue: Range3 | null;
  revenueValue: Range3;
  /** The one used in the blend. */
  basis: 'ebitda' | 'revenue';
  value: Range3;
  discount: number;
  source: 'peers' | 'preset';
  /** Peers entered with at least one multiple. */
  peerCount: number;
  peerNames: string[];
};

export type RaiseResult = {
  amount: number;
  preMoney: Range3;
  postMoney: Range3;
  /** The investor's share of post-money equity, ratio. */
  investorStake: Range3;
};

export type ResultMeta = {
  valuationDate: string | null;
  lastFyEnd: string;
  stubMonths: number;
  stubFraction: number;
  treasury: DatedValue;
  erp: DatedValue;
  erpAligned: boolean;
  dataVersion: string;
  currency: string;
  company: string | null;
  sector: string;
  country: string;
  purpose: string | null;
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
  /** Borrowings and cash as entered, from version 4; null for inputs that entered net debt directly. */
  debt: number | null;
  cash: number | null;
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
  /** Combined DCF: the average of perpetuity and exit multiple, or perpetuity alone. */
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
  /** Implied terminal multiple (perpetuity method). */
  impliedExitMultiple: number;
  /** Implied EV / LTM EBITDA: blended base EV over last actual EBITDA. */
  ltmMultiple: number;
  sensitivity: {
    waccs: number[];
    growths: number[];
    grid: number[][];
    /** Absent on results stored before version 3, which were equity from the perpetuity DCF too. */
    basis?: 'equity';
    method?: 'perpetuity';
  };
  /** Empty when computed inside a scenario run. */
  scenarios: ScenarioResult[];
  /** Probability-weighted equity base case, floored at zero. NaN inside a scenario run. */
  weightedEquity: number;
  stake: StakeResult;
  ratios: KeyRatios;
  /** Version 2 results only. */
  warnings?: Warning[];

  /* Version 3: the canonical blocks. Absent on stored results before it. */
  tax: TaxProfile & {
    lossesUsed: number;
    /** Zakat base method only: working capital, cash (null when not entered) and base at the last actual year end, and zakat in each forecast year. */
    zakatBaseLtm: { workingCapital: number; cash: number | null; base: number } | null;
    zakatByYear: number[];
  };
  forecast: ForecastLine[];
  terminal: TerminalResult;
  dcfBlock: DcfBlock;
  comparables: ComparablesBlock;
  blend: { dcfWeight: number; compsWeight: number; ev: Range3; equity: Range3 };
  /** Unfloored probability-weighted equity, which the scenario table reconciles to. */
  weightedEquityRaw: number;
  weightsTotal: number;
  raise: RaiseResult | null;
  checks: Check[];
  recommendations: Recommendation[];
  meta: ResultMeta;
};

export type RunOutcome =
  | { ok: true; result: ValuationResult }
  | { ok: false; step: 0 | 1 | 2 | 3; errors: FieldErrors | string };

export const SENSITIVITY_WACC_STEPS = [-0.02, -0.01, 0, 0.01, 0.02];
export const SENSITIVITY_GROWTH_STEPS = [-0.01, -0.005, 0, 0.005, 0.01];

export function runValuation(entered: ValuationInputs, opts: EngineOptions = CURRENT_METHOD): RunOutcome {
  const i = withNetDebtFromBalances(entered);
  const companyErrors = validateCompany(i);
  if (Object.keys(companyErrors).length) return { ok: false, step: 0, errors: companyErrors };
  const finError = validateFinancials(i.financials, i);
  if (finError) return { ok: false, step: 1, errors: finError };

  const w = waccFor(i, resolveExtras(i).waccAdjustment);
  if (!Number.isFinite(w.wacc)) return { ok: false, step: 2, errors: 'Complete every cost of capital input.' };
  const termError = validateTerminal(i, w.wacc);
  if (termError) return { ok: false, step: 3, errors: termError };

  return { ok: true, result: compute(i, true, opts) };
}

/** The valuation itself, on inputs already validated. `withScenarios` is false inside a scenario run. */
/**
 * `netDebtAtDate` is passed into scenario runs: net debt at the valuation date
 * is one estimate, from the base forecast, whichever scenario is being valued.
 */
function compute(i: ValuationInputs, withScenarios: boolean, opts: EngineOptions, netDebtAtDate?: number): ValuationResult {
  const currency = currencyFor(i.country);
  const x = resolveExtras(i);
  const tax = taxProfile(i.country, i.wacc.tax, x.gccOwnership, opts);
  const w = computeWacc(i.wacc, currency, x.waccAdjustment, tax.rate);
  const g = n(i.growth) / 100, xm = n(i.exitMultiple), wD = n(i.dcfWeight);
  const mid = i.midYear, nd = n(i.netDebt);
  const disc = (n(i.privateDiscount) || 0) / 100;
  // CHANGED: the discount applies to the exit multiple too. With no discount
  // this is the entered multiple exactly.
  const xmApplied = disc ? xm * (1 - disc) : xm;
  const stub = stubPeriod(i.financialYear, x.valuationDate);
  const f = stub.fraction;
  const zakatShareRate = tax.zakatMethod === 'base' ? tax.gccOwnership * tax.zakatRate : 0;
  const basis: TerminalBasis = { mode: opts.terminalCashFlow, taxRate: w.t, zakatShareRate };

  const reported = i.financials;
  const fin = normalisedFinancials(reported, x.normalisation);
  const zakatRule: ZakatRule | null = zakatShareRate ? { shareRate: zakatShareRate, cash: x.cash } : null;
  const rows = projections(fin, w.t, { carryForward: tax.lossCarryForward, cap: tax.lossOffsetCap }, zakatRule);

  const base = dcf(rows, w.wacc, g, xmApplied, mid, f, basis);
  const loG = dcf(rows, w.wacc + 0.01, g - 0.005, xmApplied, mid, f, basis).evG;
  const hiG = dcf(rows, w.wacc - 0.01, g + 0.005, xmApplied, mid, f, basis).evG;
  const loX = dcf(rows, w.wacc + 0.01, g, xmApplied - 1, mid, f, basis).evX;
  const hiX = dcf(rows, w.wacc - 0.01, g, xmApplied + 1, mid, f, basis).evX;

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
  // THE VALUATION DATE AND NET DEBT, made consistent. Net debt is entered at the
  // last financial year end. The DCF values cash flow from the valuation date,
  // so the part of the first forecast year already gone is not in enterprise
  // value; that cash is taken to have stayed in the business (no distributions)
  // and so reduces net debt. Net debt at the valuation date is therefore net
  // debt at the year end less the elapsed share of year one free cash flow.
  // With no stub it is the entered figure exactly, as the reference used it.
  //
  // The elapsed cash flow is unlevered, so after-tax interest on net debt for
  // the same period is deducted from it: interest at the pre-tax cost of debt
  // from the WACC build, after the tax rate used for the cost of debt. Only
  // positive net debt accrues interest; net cash is not credited with any.
  const elapsedInterest = f && nd > 0 ? nd * w.kd * (1 - w.t) * f : 0;
  const ndAtDate = netDebtAtDate !== undefined ? netDebtAtDate : f ? nd - rows[0].fcf * f + elapsedInterest : nd;
  bridge.elapsedFcf = f ? nd + elapsedInterest - ndAtDate : 0;
  bridge.elapsedInterest = elapsedInterest;
  bridge.netDebtAtValuationDate = ndAtDate;
  // With no other claims the reference's `ev - netDebt` is kept exactly.
  const toEquity = (v: number) => (claims ? v - ndAtDate - claims : v - ndAtDate);
  const equity = ev.map(toEquity) as Range3;
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
      return toEquity(dcf(rows, W2, G2, xmApplied, mid, f, basis).evG);
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

  /* Scenarios ------------------------------------------------------------ */
  const sc = x.scenarios;
  let scenarios: ScenarioResult[] = [];
  let weightedEquity = NaN, weightedEquityRaw = NaN, weightsTotal = NaN;
  if (withScenarios) {
    const run = (key: 'downside' | 'upside', gp: number, mp: number, weight: number): ScenarioResult => {
      const r = compute({ ...i, financials: scenarioFinancials(reported, gp, mp) }, false, opts, ndAtDate);
      const lastRow = r.rows[r.rows.length - 1];
      return {
        key, weight, growthPoints: gp, marginPoints: mp,
        ev: r.ev, equity: r.equity, equityDisplay: r.equityDisplay,
        terminalRevenue: lastRow.rev, terminalEbitda: lastRow.ebitda,
      };
    };
    scenarios = [
      run('downside', n(sc.downsideGrowth), n(sc.downsideMargin), n(sc.weightDownside) / 100),
      {
        key: 'base', weight: n(sc.weightBase) / 100, growthPoints: 0, marginPoints: 0,
        ev, equity, equityDisplay, terminalRevenue: last.rev, terminalEbitda: last.ebitda,
      },
      run('upside', n(sc.upsideGrowth), n(sc.upsideMargin), n(sc.weightUpside) / 100),
    ];
    weightedEquityRaw = scenarios.reduce((a, s) => a + s.weight * s.equity[1], 0);
    weightedEquity = Math.max(0, weightedEquityRaw);
    weightsTotal = scenarios.reduce((a, s) => a + s.weight, 0);
  }

  /* Canonical blocks ----------------------------------------------------- */
  const years = financialYears(i.financialYear);
  const forecast: ForecastLine[] = rows.map((r, k) => {
    const cf = (base.fcfValued as number[])[k];
    return { ...r, year: years.forecast[k], fcfValued: cf, period: (base.periods as number[])[k], df: base.dfs[k], pv: cf * base.dfs[k] };
  });
  const tcf = terminalCashFlow(rows, g, w.t, zakatShareRate);
  const terminal: TerminalResult = {
    ...tcf,
    // In the reference's method the perpetuity rests on the final year's cash flow instead.
    fcf: base.tvFcf as number,
    method: opts.terminalCashFlow,
    tvPerpetuity: base.tvG,
    tvExit: base.tvX,
    period: base.periodN as number,
    df: base.dfN,
    pvPerpetuity: base.tvG * base.dfN,
    pvExit: base.tvX * base.dfN,
    impliedMultiple: impliedExitMultiple,
    tvShare,
  };
  const exitAvailable = Number.isFinite(base.evX);
  const dcfBlock: DcfBlock = {
    pvForecast: base.pv,
    perpetuity: [loG, base.evG, hiG],
    exit: exitAvailable ? [loX, base.evX, hiX] : null,
    combined: dcfRange,
    combination: exitAvailable ? 'average' : 'perpetuity_only',
    equity: dcfRange.map(toEquity) as Range3,
    perpetuityEquityBase: toEquity(base.evG),
  };
  const entered = i.peers.filter((p) => Number.isFinite(n(p.evEbitda)) || Number.isFinite(n(p.evRevenue)));
  const comparables: ComparablesBlock = {
    ebitdaMultiplesPre: cm.ebitda,
    ebitdaMultiplesPost: cm.ebitda.map((m) => m * (1 - disc)) as Range3,
    revenueMultiplesPre: cm.revenue,
    revenueMultiplesPost: cm.revenue.map((m) => m * (1 - disc)) as Range3,
    ebitdaValue: cE,
    revenueValue: cR,
    basis: cE ? 'ebitda' : 'revenue',
    value: compRange,
    discount: disc,
    source: cm.peersE || cm.peersR ? 'peers' : 'preset',
    peerCount: entered.length,
    peerNames: entered.map((p, k) => p.name || `Comparable ${k + 1}`),
  };
  const raiseAmount = x.raiseAmount;
  const raise: RaiseResult | null =
    raiseAmount !== null && raiseAmount > 0
      ? {
          amount: raiseAmount,
          preMoney: equityDisplay,
          postMoney: equityDisplay.map((v) => v + raiseAmount) as Range3,
          investorStake: equityDisplay.map((v) => raiseAmount / (v + raiseAmount)) as Range3,
        }
      : null;
  const market = marketDataInUse();
  const meta: ResultMeta = {
    valuationDate: stub.valuationDate,
    lastFyEnd: stub.lastFyEnd,
    stubMonths: stub.months,
    stubFraction: f,
    treasury: market.treasury,
    erp: market.erp,
    erpAligned: market.aligned,
    dataVersion: VALUATION_DATA_VERSION,
    currency: currency.code,
    company: i.profile?.companyName ?? null,
    sector: i.industry,
    country: i.country,
    purpose: x.purpose,
  };

  const result: ValuationResult = {
    schemaVersion: INPUT_SCHEMA_VERSION,
    currency,
    years,
    wacc: w,
    growth: g,
    exitMultiple: xm,
    exitMultipleApplied: xmApplied,
    midYear: mid,
    netDebt: nd,
    debt: entersDebtAndCash(i) ? n(i.debt) : null,
    cash: entersDebtAndCash(i) ? n(i.cash) : null,
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
    sensitivity: { waccs, growths, grid, basis: 'equity', method: 'perpetuity' },
    scenarios,
    weightedEquity,
    stake,
    ratios,
    tax: {
      ...tax,
      lossesUsed: sum(rows.map((r) => r.lossUsed ?? 0)),
      zakatBaseLtm: zakatRule
        ? { workingCapital: z(reported.nwc[HISTORY_YEARS - 1]), cash: zakatRule.cash, base: zakatBase(z(reported.nwc[HISTORY_YEARS - 1]), zakatRule.cash) }
        : null,
      zakatByYear: rows.map((r) => r.zakat ?? 0),
    },
    forecast,
    terminal,
    dcfBlock,
    comparables,
    blend: { dcfWeight: wD / 100, compsWeight: 1 - wD / 100, ev, equity },
    weightedEquityRaw,
    weightsTotal,
    raise,
    checks: [],
    recommendations: [],
    meta,
  };
  if (withScenarios) {
    result.checks = buildChecks(result, { inflationLocal: n(i.wacc.inflationLocal) });
    result.recommendations = buildRecommendations(result);
  }
  return result;
}

/** True when a result carries the version 3 blocks. Leads stored before 2026-09-17 do not. */
export function isCanonicalResult(r: ValuationResult): boolean {
  return (r.schemaVersion ?? 0) >= 3 && Array.isArray(r.checks) && Boolean(r.dcfBlock && r.terminal && r.meta);
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
