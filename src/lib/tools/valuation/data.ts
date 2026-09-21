/**
 * Every tunable value the Business Valuation tool uses, and nothing else.
 *
 * The engine, the UI and the PDF read from here and hold no numbers of their
 * own, so a January refresh is an edit to this one file plus a bump of
 * `VALUATION_DATA_VERSION`. Each block carries a dated source note, because a
 * figure without a date is a figure nobody can tell is stale.
 *
 * Values were carried across unchanged from the reference implementation at
 * `reference/tools/business-valuation.html` and confirmed by the firm on
 * 2026-09-16. They have not been independently re-derived here.
 *
 * HOW TO REFRESH (each January, after Damodaran publishes)
 *   1. Country risk premiums, default spreads and tax rates: "Country Default
 *      Spreads and Risk Premiums" and "Corporate Marginal Tax Rates by country",
 *      for every country in `COUNTRIES` (all Damodaran covers since 2026-09-22;
 *      regenerate the block after the first seven rather than editing 166 lines).
 *   2. Unlevered beta (corrected for cash) and market D/E: the global
 *      "Betas by Sector" and "Debt Fundamentals by Sector" datasets.
 *   3. Mature market implied ERP (add the month to `IMPLIED_ERP_BY_MONTH`,
 *      ideally the same month as the Treasury yield) and the US default spread.
 *   4. The US 10-year Treasury yield, on the date of the refresh, and its date
 *      in `usTreasury10yAsOf`.
 *   5. FX to SAR (and `FX_AS_OF`), the inflation expectations for non-pegged
 *      currencies, and the benchmark rates in `LENDING_RATES`.
 *   6. Update every `asOf` below, bump `VALUATION_DATA_VERSION`, run
 *      `npm run verify-valuation-engine`. The verifier passes these values into
 *      the reference HTML itself; do not edit the reference file.
 * Leads store the version they were computed under, so older leads keep
 * showing the numbers their owner was actually given.
 */

/** Stamped on every lead. Bump on any change to a value in this file. */
export const VALUATION_DATA_VERSION = '2026-09-23';

/**
 * How each data version is described to a reader: the PDF report's cover and
 * footer, and the admin lead view. Add a line with every bump of
 * `VALUATION_DATA_VERSION`, so leads computed under an older version keep the
 * description of the data they were actually given.
 */
export const DATA_VERSION_LABELS: Record<string, string> = {
  '2026-09-16': 'Damodaran January 2026, risk-free September 2026',
  '2026-09-17': 'Market data: Damodaran 2026, risk-free 15 September 2026',
  // Local lending rates for the cost of debt and the terminal reinvestment floor.
  '2026-09-21': 'Market data: Damodaran 2026, risk-free 15 September 2026, local lending rates 2026',
  // Every country Damodaran covers, with central bank policy rates from the BIS where no local benchmark was set.
  '2026-09-22': 'Market data: Damodaran 2026, risk-free 15 September 2026, local lending rates 2026',
  // PKR to SAR updated; benchmark rates far above the inflation default no longer used.
  '2026-09-23': 'Market data: Damodaran 2026, risk-free 15 September 2026, local lending rates 2026',
};

export function dataVersionLabel(version: string): string {
  return DATA_VERSION_LABELS[version] ?? `Market data ${version}`;
}

export type SourceNote = { label: string; source: string; asOf: string };

/* ------------------------------------------------------------------------ */
/* Market inputs                                                             */
/* ------------------------------------------------------------------------ */

export const MARKET = {
  /** US 10-year Treasury yield, percent. */
  usTreasury10y: 5.0,
  /**
   * When the Treasury yield above was taken, YYYY-MM-DD (YYYY-MM also accepted).
   * 5.00% is the US Treasury daily par yield curve 10-year close on
   * 15 September 2026 (home.treasury.gov, checked 2026-09-17).
   */
  usTreasury10yAsOf: '2026-09-15',
  /** Damodaran's US sovereign default spread, percent, subtracted to get a risk-free rate. */
  usDefaultSpread: 0.23,
  /**
   * Damodaran implied mature market equity risk premium, percent. Always the
   * figure `marketDataInUse` selects from `IMPLIED_ERP_BY_MONTH`; kept here
   * because the form prefills from it.
   */
  matureErp: 4.14,
  /**
   * Long-run expected US inflation, percent. The expected local inflation for
   * the currencies pegged to the dollar, used by the terminal growth check.
   * Kept equal to `inflationUs` on the non-pegged countries.
   */
  usInflationLongRun: 2.5,
} as const;

/**
 * Damodaran's implied equity risk premium by the date it is as at, YYYY-MM-DD
 * to percent (trailing 12 month cash yield with adjusted payout, the figure he
 * leads with). Add a month whenever a newer figure is taken. The value
 * used is the month of the risk-free rate where there is one; otherwise the
 * latest month here, and the report then prints both dates so the gap shows.
 */
export const IMPLIED_ERP_BY_MONTH: Record<string, number> = {
  '2026-01-01': 4.23,
  // pages.stern.nyu.edu/~adamodar, "Implied ERP on September 1, 2026 = 4.14%
  // (Trailing 12 month, with adjusted payout)", checked 2026-09-17.
  '2026-09-01': 4.14,
};

export type DatedValue = { value: number; asOf: string };

/** The risk-free yield and the implied ERP chosen for it, each with its date. */
export function marketDataInUse(): { treasury: DatedValue; erp: DatedValue; aligned: boolean } {
  const treasury = { value: MARKET.usTreasury10y, asOf: MARKET.usTreasury10yAsOf };
  const month = treasury.asOf.slice(0, 7);
  const sameMonth = Object.keys(IMPLIED_ERP_BY_MONTH).filter((d) => d.startsWith(month)).sort().at(-1);
  if (sameMonth) return { treasury, erp: { value: IMPLIED_ERP_BY_MONTH[sameMonth], asOf: sameMonth }, aligned: true };
  const latest = Object.keys(IMPLIED_ERP_BY_MONTH).sort().at(-1) as string;
  return { treasury, erp: { value: IMPLIED_ERP_BY_MONTH[latest], asOf: latest }, aligned: false };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09" as "September 2026"; "2026-09-15" as "15 September 2026". */
export function formatDataDate(asOf: string): string {
  const [y, m, d] = asOf.split('-').map((x) => parseInt(x, 10));
  const month = MONTH_NAMES[(m || 1) - 1];
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}

/* ------------------------------------------------------------------------ */
/* Tax and zakat                                                             */
/* ------------------------------------------------------------------------ */

export const TAX = {
  /**
   * Zakat rate, percent, applied to an approximate zakat base on the Saudi / GCC
   * owned share, or to profit when invested capital was not entered (see
   * `taxProfile` and `zakatBase` in engine.ts).
   */
  /** The default zakat rate, percent. Editable for Saudi Arabia, from 0 to `maxZakatRate`. */
  zakatRate: 2.5,
  maxZakatRate: 10,
  /** The one country where the Saudi / GCC ownership input is asked and zakat applies. */
  zakatCountry: 'Saudi Arabia',
} as const;

/* ------------------------------------------------------------------------ */
/* PaceMakers assumptions                                                    */
/* ------------------------------------------------------------------------ */

export const ASSUMPTIONS = {
  /** Default company credit spread over the base rate, percent. */
  companyCreditSpread: 2.0,
  /**
   * A benchmark lending rate more than this many points above the country's expected long-term
   * inflation (`inflationLocal`, or US long-run inflation for the pegged currencies) is not used as
   * the default cost of debt (since 2026-09-23). A policy rate set against today's inflation, well
   * above the long-term figure the conversion uses, gives an unrealistic US dollar cost of debt
   * (Turkey: 37% against 15%). Those countries build it from the spreads instead. Pakistan, at 4.75
   * points, is inside it.
   */
  maxBenchmarkAboveInflationPoints: 5,
  /** Expected local inflation at or above this, percent, marks the results as highly uncertain. */
  highInflationPercent: 15,
  /**
   * Size and company-specific premium by last actual revenue, in SAR millions.
   * Below `smallBelow`: `small`. Below `midBelow`: `mid`. Otherwise `large`.
   */
  sizePremium: { smallBelow: 100, midBelow: 500, small: 3.0, mid: 2.0, large: 1.0 },
  /** Default when there is no revenue yet to size the company on. */
  sizePremiumNoRevenue: 3.0,
  /** Forecast fill defaults, percent of revenue except growth. */
  forecastFill: { growth: 10, ebitdaMargin: 18, daOfRevenue: 3, capexOfRevenue: 4, nwcOfRevenue: 15 },
  /** Private company discount applied to comparables, percent. */
  privateDiscount: 0,
  /** Weight on the DCF in the blended value, percent. */
  dcfWeight: 60,
  midYear: true,
  defaultFinancialYear: 2025,
  minFinancialYear: 2015,
  maxFinancialYear: 2035,
  /** Private company discount set automatically once the visitor enters their own peers, percent. */
  privateDiscountWithPeers: 20,
} as const;

/**
 * The financial year a new form and the example company start on: last
 * calendar year, and never earlier than `defaultFinancialYear`. A fixed year
 * would be refused by the stub period check once it is more than twelve months
 * old, which would break "Load an example company" every January.
 */
export function defaultFinancialYearFor(today: Date = new Date(), fyEndMonth = 12): number {
  // The latest financial year that has ended: this calendar year's, when its year end month is past.
  const m = Number.isInteger(fyEndMonth) && fyEndMonth >= 1 && fyEndMonth <= 12 ? fyEndMonth : 12;
  const y = today.getUTCFullYear();
  const endThisYear = Date.UTC(y, m, 0);
  return Math.max(ASSUMPTIONS.defaultFinancialYear, today.getTime() > endThisYear ? y : y - 1);
}

/* ------------------------------------------------------------------------ */
/* Version 2 features. Every default here is neutral: it leaves the base     */
/* valuation exactly as version 1 computed it.                               */
/* ------------------------------------------------------------------------ */

export const V2_DEFAULTS = {
  /** Scenario adjustments to every forecast year, percentage points. */
  scenarios: { upsideGrowth: 3, upsideMargin: 2, downsideGrowth: -3, downsideMargin: -2 },
  /** Probability weights, percent: downside, base, upside. Must total 100. */
  scenarioWeights: { downside: 25, base: 50, upside: 25 },
  /** Stake defaults, percent. 100% with no adjustment is neutral. */
  stake: { percent: 100, controlPremium: 25, minorityDiscount: 20 },
} as const;

/**
 * Long-term reinvestment in the terminal value (since 2026-09-21). Growth after the forecast must
 * be paid for: terminal reinvestment is at least NOPAT x g / RONIC, the value driver formula, where
 * RONIC (return on new invested capital) is the WACC plus `ronicPremiumPoints`. At zero, new
 * capital earns its cost, so growth beyond the forecast adds no value of its own: the neutral,
 * conservative convention for a business without a proven lasting advantage. Before this, the
 * final year's capex scaled to g could imply returns of 50% or more on new capital, which
 * overstated the perpetuity value. A business whose own figures imply more reinvestment keeps them.
 */
export const TERMINAL = {
  ronicPremiumPoints: 0,
} as const;

/**
 * Thresholds for the checks run on every result (`checks.ts`). Every check is
 * run every time and reported as Pass or Warning.
 */
export const WARNING_RULES = {
  /** DCF and comparables base values differ by more than this, relative. */
  methodDivergence: 0.2,
  /** Implied terminal multiple (perpetuity method) and the exit multiple after discount differ by more than this, relative. */
  terminalGap: 0.25,
  /** Terminal value share of the perpetuity DCF above this is a warning. */
  terminalValueShare: 0.75,
  /** Above this the terminal value warning is marked strong. */
  terminalValueShareStrong: 0.85,
  /** Fewer peers than this, when the visitor entered peers, is a warning. */
  minPeers: 3,
  /** Target debt to equity and actual net debt to equity differ by more than this, percentage points. */
  capitalStructurePoints: 20,
  /** First forecast year EBITDA margin above or below the last actual (normalised) margin by more than this, percentage points. */
  marginStepPoints: 1.5,
  /** EBITDA add-backs above this share of reported EBITDA are a warning: they carry much of the value and must survive diligence. */
  addBackShare: 0.2,
  /** Growth implied by reinvestment and ROIC differs from long-term growth by more than this, percentage points. */
  reinvestmentGapPoints: 2,
  /** Terminal growth more than this below expected local inflation, percentage points. */
  inflationBelowPoints: 1,
  /** Terminal growth more than this above expected local inflation, percentage points. */
  inflationAbovePoints: 2,
  /** A stake must be above this percentage for a control premium to fit. */
  controlStakeAbovePercent: 50,
} as const;

/** Thresholds for choosing the factors that could support a higher valuation (`recommendations.ts`). */
export const RECOMMENDATION_RULES = {
  /** A one point lower WACC moving perpetuity DCF equity by more than this share is material. */
  waccSensitivityMaterial: 0.1,
  /** Forecast free cash flow below this share of forecast EBITDA. */
  fcfConversionBelow: 0.6,
  /** Final forecast year EBITDA margin below this. */
  terminalMarginBelow: 0.15,
  /** At most this many are listed, the always eligible diligence point included. */
  maxItems: 5,
} as const;

/* ------------------------------------------------------------------------ */
/* Countries                                                                 */
/* ------------------------------------------------------------------------ */

export type CountryData = {
  /** Country risk premium, percent. */
  crp: number;
  /** Sovereign default spread, percent. */
  ds: number;
  /** Marginal corporate tax rate, percent. */
  tax: number;
  /** ISO currency code. Amounts are entered in millions of this currency. */
  code: string;
  /** True when the currency is pegged to the US dollar. */
  pegged: boolean;
  /** SAR per one unit of the currency. Used for deal size bands and size premium thresholds. */
  sarPerUnit: number;
  /** Default long-term growth, percent. */
  growth: number;
  /**
   * Highest long-term nominal growth that reads as sensible in this currency,
   * percent. Above it the results carry a warning. Roughly long-run inflation
   * plus real growth: about 4% for dollar-pegged currencies, higher where
   * expected inflation is higher.
   */
  growthCeiling: number;
  /** Expected long-term local inflation, percent. Non-pegged currencies only. */
  inflationLocal?: number;
  /** Expected long-term US inflation, percent. Non-pegged currencies only. */
  inflationUs?: number;
  /**
   * Tax losses carried forward can offset at most this share of a year's
   * taxable profit, percent. 100 is no cap. Simplified: loss expiry periods
   * are not modelled.
   */
  lossOffsetCap: number;
};

/**
 * When the indicative exchange rates to SAR were taken: ExchangeRate-API's open endpoint
 * (open.er-api.com/v6/latest/SAR, www.exchangerate-api.com), daily mid rates it compiles from
 * central bank and commercial data, as published at 00:02 UTC on 21 September 2026. Every country
 * added on 2026-09-22 and the Pakistan rupee (updated 2026-09-23) use it. The six GCC currencies
 * are at their official US dollar pegs, which match it. Refresh with the January update.
 */
export const FX_AS_OF = '2026-09-21';

/** Listed first in the country search, in this order. Everything else follows alphabetically. */
export const PINNED_VALUATION_COUNTRIES = ['Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Oman', 'Bahrain', 'Pakistan'] as const;

/**
 * Every country in Damodaran's January 2026 country risk dataset (`ctryprem.xlsx`, "ERPs by
 * country", rated and frontier tables), except the three emirates he lists separately from the
 * United Arab Emirates, and North Korea and Somalia, which his corporate tax dataset does not
 * cover. Country risk premium and default spread from that file, rounded to two decimals (for a
 * frontier market without a rating the default spread is his CRP-implied figure); tax is the
 * marginal corporate rate from his `countrytaxrates.xlsx`, January 2026.
 *
 * The seven countries first were set before 2026-09-22 and confirmed by the firm, so they are kept
 * as they were, including the UAE's 9% (Damodaran shows 0%).
 *
 * `pegged` is true only for a currency fixed to the US dollar (or, for Macao, to the Hong Kong
 * dollar) and for countries that use the dollar. Every other currency uses the inflation
 * conversion Pakistan uses: `inflationLocal` is a long-term default set by PaceMakers from each
 * central bank's target and medium-term IMF projections, the default growth is that inflation to
 * the nearest half point, and the growth ceiling is inflation plus 2 points. All editable.
 */
export const COUNTRIES = {
  'Saudi Arabia': { crp: 0.78, ds: 0.51, tax: 20, code: 'SAR', pegged: true, sarPerUnit: 1, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 25 },
  'United Arab Emirates': { crp: 0.64, ds: 0.42, tax: 9, code: 'AED', pegged: true, sarPerUnit: 1.0211, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 75 },
  Qatar: { crp: 0.64, ds: 0.42, tax: 10, code: 'QAR', pegged: true, sarPerUnit: 1.0302, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 100 },
  Kuwait: { crp: 0.91, ds: 0.6, tax: 15, code: 'KWD', pegged: true, sarPerUnit: 12.2, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 100 },
  Oman: { crp: 2.85, ds: 1.87, tax: 15, code: 'OMR', pegged: true, sarPerUnit: 9.753, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 100 },
  Bahrain: { crp: 7.12, ds: 4.67, tax: 0, code: 'BHD', pegged: true, sarPerUnit: 9.973, growth: 2.5, growthCeiling: 4.0, lossOffsetCap: 100 },
  Pakistan: {
    crp: 9.71,
    ds: 6.37,
    tax: 29,
    code: 'PKR',
    pegged: false,
    // 74.05 PKR per SAR, ExchangeRate-API as at FX_AS_OF (was 0.01333, set on 2026-09-16).
    sarPerUnit: 0.0135,
    growth: 6.0,
    growthCeiling: 9.0,
    lossOffsetCap: 100,
    inflationLocal: 7.0,
    inflationUs: 2.5,
  },
  // Every other country Damodaran covers, alphabetically. Generated on 2026-09-22 from his January
  // 2026 country risk and tax datasets (see the note above COUNTRIES), exchange rates as at `FX_AS_OF`.
  Albania: { crp: 4.66, ds: 3.06, tax: 15, code: 'ALL', pegged: false, sarPerUnit: 0.04689, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Algeria: { crp: 5.83, ds: 3.83, tax: 26, code: 'DZD', pegged: false, sarPerUnit: 0.02794, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Andorra: { crp: 2.07, ds: 1.36, tax: 10, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Angola: { crp: 8.41, ds: 5.52, tax: 25, code: 'AOA', pegged: false, sarPerUnit: 0.004081, growth: 12, growthCeiling: 14, inflationLocal: 12, inflationUs: 2.5, lossOffsetCap: 100 },
  Argentina: { crp: 9.71, ds: 6.37, tax: 35, code: 'ARS', pegged: false, sarPerUnit: 0.00248, growth: 20, growthCeiling: 22, inflationLocal: 20, inflationUs: 2.5, lossOffsetCap: 100 },
  Armenia: { crp: 4.66, ds: 3.06, tax: 18, code: 'AMD', pegged: false, sarPerUnit: 0.01029, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Aruba: { crp: 2.85, ds: 1.87, tax: 22, code: 'AWG', pegged: true, sarPerUnit: 2.095, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Australia: { crp: 0, ds: 0, tax: 30, code: 'AUD', pegged: false, sarPerUnit: 2.67, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Austria: { crp: 0.36, ds: 0.23, tax: 23, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Azerbaijan: { crp: 2.85, ds: 1.87, tax: 20, code: 'AZN', pegged: false, sarPerUnit: 2.199, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Bahamas: { crp: 5.83, ds: 3.83, tax: 0, code: 'BSD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Bangladesh: { crp: 7.12, ds: 4.67, tax: 27.5, code: 'BDT', pegged: false, sarPerUnit: 0.03047, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Barbados: { crp: 7.12, ds: 4.67, tax: 9, code: 'BBD', pegged: true, sarPerUnit: 1.875, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Belarus: { crp: 26.66, ds: 17.5, tax: 25, code: 'BYN', pegged: false, sarPerUnit: 1.236, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Belgium: { crp: 0.78, ds: 0.51, tax: 25, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Belize: { crp: 9.71, ds: 6.37, tax: 0, code: 'BZD', pegged: true, sarPerUnit: 1.875, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Benin: { crp: 5.83, ds: 3.83, tax: 30, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Bermuda: { crp: 1.1, ds: 0.72, tax: 0, code: 'BMD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Bolivia: { crp: 15.54, ds: 10.2, tax: 25, code: 'BOB', pegged: false, sarPerUnit: 0.3337, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  'Bosnia and Herzegovina': { crp: 8.41, ds: 5.52, tax: 10, code: 'BAM', pegged: false, sarPerUnit: 2.2, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Botswana: { crp: 2.07, ds: 1.36, tax: 22, code: 'BWP', pegged: false, sarPerUnit: 0.2694, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Brazil: { crp: 3.24, ds: 2.13, tax: 34, code: 'BRL', pegged: false, sarPerUnit: 0.7294, growth: 3.5, growthCeiling: 5.5, inflationLocal: 3.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Brunei: { crp: 0.78, ds: 0.51, tax: 18.5, code: 'BND', pegged: false, sarPerUnit: 2.938, growth: 1.5, growthCeiling: 3.5, inflationLocal: 1.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Bulgaria: { crp: 2.07, ds: 1.36, tax: 10, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  'Burkina Faso': { crp: 9.71, ds: 6.37, tax: 27.5, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Cambodia: { crp: 7.12, ds: 4.67, tax: 20, code: 'KHR', pegged: false, sarPerUnit: 0.0009228, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Cameroon: { crp: 9.71, ds: 6.37, tax: 33, code: 'XAF', pegged: false, sarPerUnit: 0.006561, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Canada: { crp: 0, ds: 0, tax: 26.14, code: 'CAD', pegged: false, sarPerUnit: 2.68, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Cape Verde': { crp: 7.12, ds: 4.67, tax: 21.42, code: 'CVE', pegged: false, sarPerUnit: 0.03903, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Cayman Islands': { crp: 0.78, ds: 0.51, tax: 0, code: 'KYD', pegged: true, sarPerUnit: 4.5, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Chile: { crp: 1.1, ds: 0.72, tax: 27, code: 'CLP', pegged: false, sarPerUnit: 0.003899, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  China: { crp: 0.91, ds: 0.6, tax: 25, code: 'CNY', pegged: false, sarPerUnit: 0.5593, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Colombia: { crp: 2.85, ds: 1.87, tax: 35, code: 'COP', pegged: false, sarPerUnit: 0.001185, growth: 3.5, growthCeiling: 5.5, inflationLocal: 3.5, inflationUs: 2.5, lossOffsetCap: 100 },
  'Cook Islands': { crp: 5.83, ds: 3.83, tax: 20, code: 'NZD', pegged: false, sarPerUnit: 2.145, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Costa Rica': { crp: 3.9, ds: 2.56, tax: 30, code: 'CRC', pegged: false, sarPerUnit: 0.008356, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  "Côte d'Ivoire": { crp: 3.9, ds: 2.56, tax: 25, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Croatia: { crp: 1.55, ds: 1.02, tax: 18, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Cuba: { crp: 15.54, ds: 10.2, tax: 35, code: 'CUP', pegged: false, sarPerUnit: 0.1563, growth: 15, growthCeiling: 17, inflationLocal: 15, inflationUs: 2.5, lossOffsetCap: 100 },
  'Curaçao': { crp: 2.85, ds: 1.87, tax: 22, code: 'XCG', pegged: true, sarPerUnit: 2.095, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Cyprus: { crp: 1.55, ds: 1.02, tax: 12.5, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Czech Republic': { crp: 0.78, ds: 0.51, tax: 21, code: 'CZK', pegged: false, sarPerUnit: 0.1768, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Democratic Republic of the Congo': { crp: 8.41, ds: 5.52, tax: 30, code: 'CDF', pegged: false, sarPerUnit: 0.00162, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  Denmark: { crp: 0, ds: 0, tax: 22, code: 'DKK', pegged: false, sarPerUnit: 0.5753, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Dominican Republic': { crp: 3.9, ds: 2.56, tax: 27, code: 'DOP', pegged: false, sarPerUnit: 0.06358, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Ecuador: { crp: 12.95, ds: 8.5, tax: 25, code: 'USD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Egypt: { crp: 9.71, ds: 6.37, tax: 22.5, code: 'EGP', pegged: false, sarPerUnit: 0.07197, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  'El Salvador': { crp: 8.41, ds: 5.52, tax: 30, code: 'USD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Estonia: { crp: 0.91, ds: 0.6, tax: 20, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Eswatini: { crp: 7.12, ds: 4.67, tax: 25, code: 'SZL', pegged: false, sarPerUnit: 0.2306, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Ethiopia: { crp: 11.66, ds: 7.65, tax: 30, code: 'ETB', pegged: false, sarPerUnit: 0.02325, growth: 12, growthCeiling: 14, inflationLocal: 12, inflationUs: 2.5, lossOffsetCap: 100 },
  Fiji: { crp: 5.83, ds: 3.83, tax: 25, code: 'FJD', pegged: false, sarPerUnit: 1.686, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Finland: { crp: 0.36, ds: 0.23, tax: 20, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  France: { crp: 0.78, ds: 0.51, tax: 25.83, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Gabon: { crp: 11.66, ds: 7.65, tax: 30, code: 'XAF', pegged: false, sarPerUnit: 0.006561, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Gambia: { crp: 7.12, ds: 4.67, tax: 27, code: 'GMD', pegged: false, sarPerUnit: 0.05035, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  Georgia: { crp: 3.9, ds: 2.56, tax: 15, code: 'GEL', pegged: false, sarPerUnit: 1.437, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Germany: { crp: 0, ds: 0, tax: 29.93, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Ghana: { crp: 9.71, ds: 6.37, tax: 25, code: 'GHS', pegged: false, sarPerUnit: 0.3244, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  Greece: { crp: 2.85, ds: 1.87, tax: 22, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Guatemala: { crp: 3.24, ds: 2.13, tax: 25, code: 'GTQ', pegged: false, sarPerUnit: 0.4898, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Guernsey: { crp: 0.91, ds: 0.6, tax: 0, code: 'GBP', pegged: false, sarPerUnit: 5.016, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Guinea: { crp: 11.66, ds: 7.65, tax: 25, code: 'GNF', pegged: false, sarPerUnit: 0.0004259, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  'Guinea-Bissau': { crp: 9.71, ds: 6.37, tax: 25, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Guyana: { crp: 2.07, ds: 1.36, tax: 25, code: 'GYD', pegged: false, sarPerUnit: 0.01784, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Haiti: { crp: 12.95, ds: 8.5, tax: 30, code: 'HTG', pegged: false, sarPerUnit: 0.0286, growth: 12, growthCeiling: 14, inflationLocal: 12, inflationUs: 2.5, lossOffsetCap: 100 },
  Honduras: { crp: 5.83, ds: 3.83, tax: 30, code: 'HNL', pegged: false, sarPerUnit: 0.1392, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  'Hong Kong': { crp: 0.78, ds: 0.51, tax: 16.5, code: 'HKD', pegged: true, sarPerUnit: 0.478, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Hungary: { crp: 2.46, ds: 1.62, tax: 9, code: 'HUF', pegged: false, sarPerUnit: 0.01181, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Iceland: { crp: 0.91, ds: 0.6, tax: 21, code: 'ISK', pegged: false, sarPerUnit: 0.03084, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  India: { crp: 2.85, ds: 1.87, tax: 30, code: 'INR', pegged: false, sarPerUnit: 0.03904, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Indonesia: { crp: 2.46, ds: 1.62, tax: 22, code: 'IDR', pegged: false, sarPerUnit: 0.0002107, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Iran: { crp: 9.71, ds: 6.37, tax: 25, code: 'IRR', pegged: false, sarPerUnit: 0.00000246, growth: 30, growthCeiling: 32, inflationLocal: 30, inflationUs: 2.5, lossOffsetCap: 100 },
  Iraq: { crp: 9.71, ds: 6.37, tax: 15, code: 'IQD', pegged: true, sarPerUnit: 0.002853, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Ireland: { crp: 0.78, ds: 0.51, tax: 12.5, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Isle of Man': { crp: 0.78, ds: 0.51, tax: 0, code: 'GBP', pegged: false, sarPerUnit: 5.016, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Israel: { crp: 2.07, ds: 1.36, tax: 23, code: 'ILS', pegged: false, sarPerUnit: 1.236, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Italy: { crp: 2.46, ds: 1.62, tax: 27.81, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Jamaica: { crp: 4.66, ds: 3.06, tax: 25, code: 'JMD', pegged: false, sarPerUnit: 0.0237, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Japan: { crp: 0.91, ds: 0.6, tax: 29.74, code: 'JPY', pegged: false, sarPerUnit: 0.02386, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Jersey: { crp: 0.78, ds: 0.51, tax: 0, code: 'GBP', pegged: false, sarPerUnit: 5.016, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Jordan: { crp: 4.66, ds: 3.06, tax: 20, code: 'JOD', pegged: true, sarPerUnit: 5.289, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Kazakhstan: { crp: 2.07, ds: 1.36, tax: 20, code: 'KZT', pegged: false, sarPerUnit: 0.008386, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Kenya: { crp: 8.41, ds: 5.52, tax: 30, code: 'KES', pegged: false, sarPerUnit: 0.02894, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Kyrgyzstan: { crp: 8.41, ds: 5.52, tax: 10, code: 'KGS', pegged: false, sarPerUnit: 0.04272, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Laos: { crp: 11.66, ds: 7.65, tax: 20, code: 'LAK', pegged: false, sarPerUnit: 0.0001677, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  Latvia: { crp: 1.55, ds: 1.02, tax: 20, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Lebanon: { crp: 26.66, ds: 17.5, tax: 17, code: 'LBP', pegged: false, sarPerUnit: 0.0000419, growth: 10, growthCeiling: 12, inflationLocal: 10, inflationUs: 2.5, lossOffsetCap: 100 },
  Liberia: { crp: 11.66, ds: 7.65, tax: 25, code: 'LRD', pegged: false, sarPerUnit: 0.02155, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Libya: { crp: 3.9, ds: 2.56, tax: 20, code: 'LYD', pegged: false, sarPerUnit: 0.5878, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Liechtenstein: { crp: 0, ds: 0, tax: 12.5, code: 'CHF', pegged: false, sarPerUnit: 4.555, growth: 1, growthCeiling: 3, inflationLocal: 1, inflationUs: 2.5, lossOffsetCap: 100 },
  Lithuania: { crp: 1.1, ds: 0.72, tax: 15, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Luxembourg: { crp: 0, ds: 0, tax: 24.94, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Macao: { crp: 0.78, ds: 0.51, tax: 12, code: 'MOP', pegged: true, sarPerUnit: 0.4641, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Madagascar: { crp: 8.41, ds: 5.52, tax: 20, code: 'MGA', pegged: false, sarPerUnit: 0.0008565, growth: 7, growthCeiling: 9, inflationLocal: 7, inflationUs: 2.5, lossOffsetCap: 100 },
  Malawi: { crp: 12.95, ds: 8.5, tax: 30, code: 'MWK', pegged: false, sarPerUnit: 0.002145, growth: 15, growthCeiling: 17, inflationLocal: 15, inflationUs: 2.5, lossOffsetCap: 100 },
  Malaysia: { crp: 1.55, ds: 1.02, tax: 24, code: 'MYR', pegged: false, sarPerUnit: 0.919, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Maldives: { crp: 11.66, ds: 7.65, tax: 15, code: 'MVR', pegged: false, sarPerUnit: 0.2425, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Mali: { crp: 11.66, ds: 7.65, tax: 30, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Malta: { crp: 1.1, ds: 0.72, tax: 35, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Mauritius: { crp: 2.85, ds: 1.87, tax: 15, code: 'MUR', pegged: false, sarPerUnit: 0.07864, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Mexico: { crp: 2.46, ds: 1.62, tax: 30, code: 'MXN', pegged: false, sarPerUnit: 0.2176, growth: 3.5, growthCeiling: 5.5, inflationLocal: 3.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Moldova: { crp: 8.41, ds: 5.52, tax: 12, code: 'MDL', pegged: false, sarPerUnit: 0.2135, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Mongolia: { crp: 5.83, ds: 3.83, tax: 25, code: 'MNT', pegged: false, sarPerUnit: 0.00105, growth: 7, growthCeiling: 9, inflationLocal: 7, inflationUs: 2.5, lossOffsetCap: 100 },
  Montenegro: { crp: 5.83, ds: 3.83, tax: 15, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Montserrat: { crp: 2.85, ds: 1.87, tax: 30, code: 'XCD', pegged: true, sarPerUnit: 1.389, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Morocco: { crp: 3.24, ds: 2.13, tax: 33, code: 'MAD', pegged: false, sarPerUnit: 0.3932, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Mozambique: { crp: 12.95, ds: 8.5, tax: 32, code: 'MZN', pegged: false, sarPerUnit: 0.05873, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Myanmar: { crp: 15.54, ds: 10.2, tax: 22, code: 'MMK', pegged: false, sarPerUnit: 0.001779, growth: 12, growthCeiling: 14, inflationLocal: 12, inflationUs: 2.5, lossOffsetCap: 100 },
  Namibia: { crp: 5.83, ds: 3.83, tax: 32, code: 'NAD', pegged: false, sarPerUnit: 0.2306, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Nepal: { crp: 4.66, ds: 3.06, tax: 25, code: 'NPR', pegged: false, sarPerUnit: 0.0244, growth: 5.5, growthCeiling: 7.5, inflationLocal: 5.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Netherlands: { crp: 0, ds: 0, tax: 25.8, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'New Zealand': { crp: 0, ds: 0, tax: 28, code: 'NZD', pegged: false, sarPerUnit: 2.145, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Nicaragua: { crp: 7.12, ds: 4.67, tax: 30, code: 'NIO', pegged: false, sarPerUnit: 0.1016, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Niger: { crp: 12.95, ds: 8.5, tax: 30, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Nigeria: { crp: 8.41, ds: 5.52, tax: 30, code: 'NGN', pegged: false, sarPerUnit: 0.002814, growth: 12, growthCeiling: 14, inflationLocal: 12, inflationUs: 2.5, lossOffsetCap: 100 },
  'North Macedonia': { crp: 4.66, ds: 3.06, tax: 10, code: 'MKD', pegged: false, sarPerUnit: 0.06961, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Norway: { crp: 0, ds: 0, tax: 22, code: 'NOK', pegged: false, sarPerUnit: 0.3983, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Panama: { crp: 2.85, ds: 1.87, tax: 25, code: 'USD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  'Papua New Guinea': { crp: 7.12, ds: 4.67, tax: 30, code: 'PGK', pegged: false, sarPerUnit: 0.834, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Paraguay: { crp: 2.85, ds: 1.87, tax: 10, code: 'PYG', pegged: false, sarPerUnit: 0.0006284, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Peru: { crp: 2.07, ds: 1.36, tax: 29.5, code: 'PEN', pegged: false, sarPerUnit: 1.109, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Philippines: { crp: 2.46, ds: 1.62, tax: 25, code: 'PHP', pegged: false, sarPerUnit: 0.05963, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Poland: { crp: 1.1, ds: 0.72, tax: 19, code: 'PLN', pegged: false, sarPerUnit: 0.9859, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Portugal: { crp: 1.55, ds: 1.02, tax: 31.5, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Republic of the Congo': { crp: 11.66, ds: 7.65, tax: 28, code: 'XAF', pegged: false, sarPerUnit: 0.006561, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Romania: { crp: 2.85, ds: 1.87, tax: 16, code: 'RON', pegged: false, sarPerUnit: 0.8172, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Russia: { crp: 3.9, ds: 2.56, tax: 20, code: 'RUB', pegged: false, sarPerUnit: 0.04452, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Rwanda: { crp: 7.12, ds: 4.67, tax: 28, code: 'RWF', pegged: false, sarPerUnit: 0.002535, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  'Saint Vincent and the Grenadines': { crp: 8.41, ds: 5.52, tax: 28, code: 'XCD', pegged: true, sarPerUnit: 1.389, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Senegal: { crp: 9.71, ds: 6.37, tax: 30, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Serbia: { crp: 3.9, ds: 2.56, tax: 15, code: 'RSD', pegged: false, sarPerUnit: 0.03663, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  'Sierra Leone': { crp: 8.41, ds: 5.52, tax: 25, code: 'SLE', pegged: false, sarPerUnit: 0.1505, growth: 10, growthCeiling: 12, inflationLocal: 10, inflationUs: 2.5, lossOffsetCap: 100 },
  Singapore: { crp: 0, ds: 0, tax: 17, code: 'SGD', pegged: false, sarPerUnit: 2.938, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Sint Maarten': { crp: 3.9, ds: 2.56, tax: 34.5, code: 'XCG', pegged: true, sarPerUnit: 2.095, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Slovakia: { crp: 1.55, ds: 1.02, tax: 21, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2.5, growthCeiling: 4.5, inflationLocal: 2.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Slovenia: { crp: 1.55, ds: 1.02, tax: 22, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Solomon Islands': { crp: 9.71, ds: 6.37, tax: 30, code: 'SBD', pegged: false, sarPerUnit: 0.472, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  'South Africa': { crp: 3.9, ds: 2.56, tax: 27, code: 'ZAR', pegged: false, sarPerUnit: 0.2306, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  'South Korea': { crp: 0.64, ds: 0.42, tax: 26.4, code: 'KRW', pegged: false, sarPerUnit: 0.002704, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Spain: { crp: 1.55, ds: 1.02, tax: 25, code: 'EUR', pegged: false, sarPerUnit: 4.303, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Sri Lanka': { crp: 15.54, ds: 10.2, tax: 30, code: 'LKR', pegged: false, sarPerUnit: 0.01132, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Sudan: { crp: 26.66, ds: 17.5, tax: 35, code: 'SDG', pegged: false, sarPerUnit: 0.007303, growth: 30, growthCeiling: 32, inflationLocal: 30, inflationUs: 2.5, lossOffsetCap: 100 },
  Suriname: { crp: 9.71, ds: 6.37, tax: 36, code: 'SRD', pegged: false, sarPerUnit: 0.09836, growth: 10, growthCeiling: 12, inflationLocal: 10, inflationUs: 2.5, lossOffsetCap: 100 },
  Sweden: { crp: 0, ds: 0, tax: 20.6, code: 'SEK', pegged: false, sarPerUnit: 0.3813, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  Switzerland: { crp: 0, ds: 0, tax: 19.61, code: 'CHF', pegged: false, sarPerUnit: 4.555, growth: 1, growthCeiling: 3, inflationLocal: 1, inflationUs: 2.5, lossOffsetCap: 100 },
  Syria: { crp: 15.54, ds: 10.2, tax: 25, code: 'SYP', pegged: false, sarPerUnit: 0.0307, growth: 20, growthCeiling: 22, inflationLocal: 20, inflationUs: 2.5, lossOffsetCap: 100 },
  Taiwan: { crp: 0.78, ds: 0.51, tax: 20, code: 'TWD', pegged: false, sarPerUnit: 0.1178, growth: 1.5, growthCeiling: 3.5, inflationLocal: 1.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Tajikistan: { crp: 8.41, ds: 5.52, tax: 18, code: 'TJS', pegged: false, sarPerUnit: 0.4034, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Tanzania: { crp: 5.83, ds: 3.83, tax: 30, code: 'TZS', pegged: false, sarPerUnit: 0.001416, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Thailand: { crp: 2.07, ds: 1.36, tax: 20, code: 'THB', pegged: false, sarPerUnit: 0.1124, growth: 1.5, growthCeiling: 3.5, inflationLocal: 1.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Togo: { crp: 8.41, ds: 5.52, tax: 27, code: 'XOF', pegged: false, sarPerUnit: 0.006561, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'Trinidad and Tobago': { crp: 3.9, ds: 2.56, tax: 30, code: 'TTD', pegged: false, sarPerUnit: 0.5504, growth: 3, growthCeiling: 5, inflationLocal: 3, inflationUs: 2.5, lossOffsetCap: 100 },
  Tunisia: { crp: 9.71, ds: 6.37, tax: 25, code: 'TND', pegged: false, sarPerUnit: 1.277, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  Turkey: { crp: 4.66, ds: 3.06, tax: 22, code: 'TRY', pegged: false, sarPerUnit: 0.07685, growth: 15, growthCeiling: 17, inflationLocal: 15, inflationUs: 2.5, lossOffsetCap: 100 },
  'Turks and Caicos Islands': { crp: 2.07, ds: 1.36, tax: 0, code: 'USD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Uganda: { crp: 8.41, ds: 5.52, tax: 30, code: 'UGX', pegged: false, sarPerUnit: 0.0009564, growth: 5, growthCeiling: 7, inflationLocal: 5, inflationUs: 2.5, lossOffsetCap: 100 },
  Ukraine: { crp: 15.54, ds: 10.2, tax: 18, code: 'UAH', pegged: false, sarPerUnit: 0.08381, growth: 6, growthCeiling: 8, inflationLocal: 6, inflationUs: 2.5, lossOffsetCap: 100 },
  'United Kingdom': { crp: 0.78, ds: 0.51, tax: 19, code: 'GBP', pegged: false, sarPerUnit: 5.016, growth: 2, growthCeiling: 4, inflationLocal: 2, inflationUs: 2.5, lossOffsetCap: 100 },
  'United States': { crp: 0.23, ds: 0.23, tax: 25.89, code: 'USD', pegged: true, sarPerUnit: 3.75, growth: 2.5, growthCeiling: 4, lossOffsetCap: 100 },
  Uruguay: { crp: 2.07, ds: 1.36, tax: 25, code: 'UYU', pegged: false, sarPerUnit: 0.09298, growth: 4.5, growthCeiling: 6.5, inflationLocal: 4.5, inflationUs: 2.5, lossOffsetCap: 100 },
  Uzbekistan: { crp: 4.66, ds: 3.06, tax: 12, code: 'UZS', pegged: false, sarPerUnit: 0.0003163, growth: 7, growthCeiling: 9, inflationLocal: 7, inflationUs: 2.5, lossOffsetCap: 100 },
  Venezuela: { crp: 26.66, ds: 17.5, tax: 34, code: 'VES', pegged: false, sarPerUnit: 0.004414, growth: 50, growthCeiling: 52, inflationLocal: 50, inflationUs: 2.5, lossOffsetCap: 100 },
  Vietnam: { crp: 3.9, ds: 2.56, tax: 20, code: 'VND', pegged: false, sarPerUnit: 0.0001442, growth: 4, growthCeiling: 6, inflationLocal: 4, inflationUs: 2.5, lossOffsetCap: 100 },
  Yemen: { crp: 15.54, ds: 10.2, tax: 20, code: 'YER', pegged: false, sarPerUnit: 0.0158, growth: 15, growthCeiling: 17, inflationLocal: 15, inflationUs: 2.5, lossOffsetCap: 100 },
  Zambia: { crp: 11.66, ds: 7.65, tax: 35, code: 'ZMW', pegged: false, sarPerUnit: 0.19, growth: 8, growthCeiling: 10, inflationLocal: 8, inflationUs: 2.5, lossOffsetCap: 100 },
  Zimbabwe: { crp: 11.66, ds: 7.65, tax: 25.75, code: 'ZWG', pegged: false, sarPerUnit: 0.1407, growth: 15, growthCeiling: 17, inflationLocal: 15, inflationUs: 2.5, lossOffsetCap: 100 },
} satisfies Record<string, CountryData>;

export type CountryName = keyof typeof COUNTRIES;

/* ------------------------------------------------------------------------ */
/* Industries                                                                */
/* ------------------------------------------------------------------------ */

export type IndustryData = {
  /** Damodaran global unlevered beta, corrected for cash. */
  unleveredBeta: number;
  /** Damodaran global market debt to equity, percent. */
  debtToEquity: number;
  /** Preset indicative private company EV / EBITDA: low, median, high. */
  ebitdaMultiples: readonly [number, number, number];
  /** Preset indicative private company EV / Revenue: low, median, high. */
  revenueMultiples: readonly [number, number, number];
};

function ind(
  unleveredBeta: number,
  debtToEquity: number,
  e: [number, number, number],
  r: [number, number, number],
): IndustryData {
  return { unleveredBeta, debtToEquity, ebitdaMultiples: e, revenueMultiples: r };
}

export const INDUSTRIES = {
  'Real Estate (Development)': ind(0.45, 191.18, [6, 8, 10], [1.0, 1.5, 2.0]),
  'Real Estate (Operations & Services)': ind(0.51, 82.5, [8, 11, 14], [2.0, 3.5, 5.0]),
  'R.E.I.T.': ind(0.36, 80.07, [12, 15, 18], [6.0, 8.0, 10.0]),
  'Engineering/Construction': ind(0.76, 76.55, [4, 5.5, 7], [0.3, 0.5, 0.7]),
  'Building Materials': ind(0.9, 22.78, [6, 7.5, 9], [0.8, 1.2, 1.6]),
  Machinery: ind(1.33, 13.56, [6, 8, 10], [0.8, 1.2, 1.6]),
  'Chemical (Basic)': ind(1.0, 50.48, [6, 7.5, 9], [0.8, 1.1, 1.5]),
  'Hospitals/Healthcare Facilities': ind(0.58, 46.58, [10, 12.5, 15], [1.5, 2.2, 3.0]),
  'Healthcare Support Services': ind(0.78, 38.13, [8, 10, 12], [1.0, 1.5, 2.0]),
  Education: ind(0.74, 28.61, [9, 11, 13], [1.5, 2.2, 3.0]),
  'Retail (General)': ind(0.94, 13.04, [6, 8, 10], [0.5, 0.8, 1.2]),
  'Retail (Grocery and Food)': ind(0.69, 45.96, [6, 8, 10], [0.3, 0.5, 0.8]),
  'Food Processing': ind(0.56, 37.1, [7, 9, 11], [0.8, 1.3, 1.8]),
  'Restaurant/Dining': ind(0.66, 26.01, [7, 9, 11], [0.8, 1.2, 1.8]),
  'Hotel/Gaming': ind(0.66, 40.24, [8, 10, 12], [1.5, 2.2, 3.0]),
  Transportation: ind(0.75, 53.47, [6, 7.5, 9], [0.6, 0.9, 1.2]),
  'Software (System & Application)': ind(1.33, 5.84, [12, 16, 20], [2.0, 3.5, 5.0]),
  'Computer Services': ind(1.07, 15.01, [8, 10, 12], [0.8, 1.2, 1.8]),
  'Oilfield Svcs/Equip.': ind(0.8, 39.66, [5, 6.5, 8], [0.8, 1.1, 1.5]),
  Power: ind(0.46, 85.87, [8, 10, 12], [2.0, 3.0, 4.0]),
  'Green & Renewable Energy': ind(0.57, 71.43, [9, 11, 13], [3.0, 4.5, 6.0]),
  'Telecom. Services': ind(0.5, 73.18, [5, 6.5, 8], [1.5, 2.0, 2.5]),
  'Environmental & Waste Services': ind(0.91, 35.7, [7, 9, 11], [1.0, 1.5, 2.0]),
  'Business & Consumer Services': ind(0.91, 20.61, [6, 8, 10], [0.8, 1.2, 1.6]),
} satisfies Record<string, IndustryData>;

export type IndustryName = keyof typeof INDUSTRIES;

/* ------------------------------------------------------------------------ */
/* Deal size bands and purposes                                              */
/* ------------------------------------------------------------------------ */

/**
 * Planned transaction size bands, defined in SAR millions and relabelled in the
 * selected currency. `lt50` is below the firm's minimum mandate size.
 */
export const DEAL_BANDS_SAR = [
  { value: 'lt50', lo: null, hi: 50 },
  { value: '50-200', lo: 50, hi: 200 },
  { value: '200-1000', lo: 200, hi: 1000 },
  { value: 'gt1000', lo: 1000, hi: null },
] as const;

export const DEAL_BAND_UNSURE = 'unsure';
export const BELOW_MINIMUM_BAND = 'lt50';

export const PURPOSES = [
  { value: 'raise', label: 'Raising equity' },
  { value: 'debt', label: 'Raising debt' },
  { value: 'sale', label: 'Selling the business or a stake' },
  { value: 'acquire', label: 'Acquiring a business' },
  { value: 'internal', label: 'Internal planning or shareholders' },
] as const;

/* ------------------------------------------------------------------------ */
/* The worked example                                                        */
/* ------------------------------------------------------------------------ */

/** The "Load an example company" button. Also the verifier's first case. */
export const EXAMPLE_COMPANY = {
  industry: 'Healthcare Support Services',
  country: 'Saudi Arabia',
  financialYear: 2025,
  /** Borrowings and cash at the year end: net debt of 45. */
  debt: 65,
  cash: 20,
  history: {
    rev: [180, 205, 232],
    ebitda: [29, 34, 40],
    da: [6, 7, 8],
    capex: [9, 11, 12],
    nwc: [30, 33, 37],
  },
  fill: { growth: 12, ebitdaMargin: 18, daOfRevenue: 3.5, capexOfRevenue: 5, nwcOfRevenue: 16 },
  /** Saudi / GCC ownership, percent. The form has no default; the example company fills it like every other field. */
  gccOwnership: 100,
  peers: [
    { name: 'Listed peer A', evEbitda: 11.5, evRevenue: 1.9 },
    { name: 'Listed peer B', evEbitda: 9.8, evRevenue: 1.4 },
  ],
} as const;

/* ------------------------------------------------------------------------ */
/* Source notes                                                              */
/* ------------------------------------------------------------------------ */

const MARKET_DATA = marketDataInUse();
const pct2 = (v: number) => v.toFixed(2) + '%';
const ERP_DATE_TEXT = MARKET_DATA.aligned
  ? formatDataDate(MARKET_DATA.erp.asOf)
  : `${formatDataDate(MARKET_DATA.erp.asOf)}, latest month on file`;

export const SOURCE_NOTES: SourceNote[] = [
  {
    label: 'Country risk premiums, default spreads and tax rates',
    source: 'Aswath Damodaran, country risk and corporate tax rate datasets',
    asOf: 'January 2026 update',
  },
  {
    label: 'Unlevered betas (corrected for cash) and debt to equity',
    source: 'Aswath Damodaran, global industry datasets',
    asOf: 'January 2026 update',
  },
  {
    label: 'Mature market implied equity risk premium',
    source: `Aswath Damodaran, implied equity risk premium of ${pct2(MARKET_DATA.erp.value)} (trailing 12 month cash yield, with adjusted payout), as at`,
    asOf: ERP_DATE_TEXT,
  },
  {
    label: 'Risk-free rate',
    source: `US 10-year Treasury yield of ${pct2(MARKET_DATA.treasury.value)}, less the ${pct2(MARKET.usDefaultSpread)} US default spread per Damodaran. Yield as at`,
    asOf: formatDataDate(MARKET_DATA.treasury.asOf),
  },
  {
    label: 'Set by PaceMakers',
    source: `Long-term inflation for currencies not pegged to the US dollar (from central bank targets and IMF projections), preset multiples, size premium bands and credit spread. Reviewed annually`,
    asOf: 'September 2026',
  },
  {
    label: 'Exchange rates to SAR',
    source: 'ExchangeRate-API (open.er-api.com) daily mid rates; GCC currencies at their official US dollar pegs. Indicative, used only for deal size bands and the size premium. As at',
    asOf: formatDataDate(FX_AS_OF),
  },
  {
    label: 'Zakat and tax loss carry-forward',
    source: `Zakat at ${TAX.zakatRate}% by default (editable) of an approximate base; loss offset caps simplified from local rules (Saudi Arabia 25%, United Arab Emirates 75%, elsewhere uncapped), expiry not modelled. Set by PaceMakers`,
    asOf: 'September 2026',
  },
];

/** The one-paragraph version shown under the WACC build. */

/**
 * Local lending base rates for the default pre-tax cost of debt (since 2026-09-21): the base a
 * corporate loan is priced over in each country, plus `ASSUMPTIONS.companyCreditSpread` (2.0%, set
 * by PaceMakers) as the typical margin. No published typical bank margin was found for any of these
 * countries, so the margin is the firm's assumption and says so. Entered in the valuation currency;
 * the form prefills it and the visitor can change it on the cost of capital step.
 *
 * REFRESH with the January Damodaran update, and whenever a central bank moves: the Saudi figure
 * predates the September 2026 rate rises. Qatar uses the QCB lending rate because the QIBOR feed
 * looked inconsistent; Oman the CBO repo rate because the latest published OMIBOR was May 2026.
 *
 * Since 2026-09-22 every other country the BIS central bank policy rate series covers takes that
 * rate as its base (the euro members the ECB's, the UK Crown Dependencies the Bank of England's,
 * Liechtenstein the Swiss National Bank's), as at the latest observation fetched that day: daily,
 * or the latest month for India and Israel, whose daily series stopped earlier. A country with no
 * entry here has no benchmark on file: its cost of debt is built from the risk-free rate, its
 * default spread and the same margin, and the report says so (`builtCostOfDebtNote`).
 */
export type LendingRate = { name: string; short: string; rate: number; asOf: string; source: string };
const BIS = 'Bank for International Settlements, central bank policy rates';
export const LENDING_RATES: Partial<Record<CountryName, LendingRate>> = {
  'Saudi Arabia': { name: '3-month SAIBOR', short: 'SAIBOR', rate: 4.76, asOf: '2026-08-27', source: 'SAIBOR fixing, Argaam' },
  'United Arab Emirates': { name: '3-month EIBOR', short: 'EIBOR', rate: 4.4, asOf: '2026-09-21', source: 'Trading Economics' },
  Qatar: { name: 'QCB lending rate', short: 'QCB rate', rate: 4.6, asOf: '2026-09-17', source: 'Qatar Central Bank, reported by The Peninsula' },
  Kuwait: { name: 'CBK discount rate', short: 'CBK rate', rate: 3.5, asOf: '2026-09-16', source: 'Central Bank of Kuwait' },
  Oman: { name: 'CBO repo rate', short: 'CBO repo', rate: 4.5, asOf: '2026-09-17', source: 'Central Bank of Oman, reported by the Oman Observer' },
  Bahrain: { name: '3-month BHIBOR', short: 'BHIBOR', rate: 5.43, asOf: '2026-09-20', source: 'Trading Economics' },
  Pakistan: { name: '3-month KIBOR (offer)', short: 'KIBOR', rate: 11.75, asOf: '2026-09-18', source: 'State Bank of Pakistan' },
  // Central bank policy rates from the BIS series, for every other country the series covers.
  Australia: { name: 'Reserve Bank of Australia policy rate', short: 'RBA rate', rate: 4.35, asOf: '2026-09-10', source: BIS },
  Austria: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Belgium: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Brazil: { name: 'Central Bank of Brazil policy rate', short: 'Selic', rate: 14, asOf: '2026-09-15', source: BIS },
  Bulgaria: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Canada: { name: 'Bank of Canada policy rate', short: 'BoC rate', rate: 2.25, asOf: '2026-09-14', source: BIS },
  Chile: { name: 'Central Bank of Chile policy rate', short: 'BCCh rate', rate: 4.5, asOf: '2026-09-15', source: BIS },
  China: { name: "People's Bank of China policy rate", short: 'PBoC rate', rate: 3, asOf: '2026-09-15', source: BIS },
  Colombia: { name: 'Central Bank of Colombia policy rate', short: 'BanRep rate', rate: 12, asOf: '2026-09-08', source: BIS },
  Croatia: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Cyprus: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  'Czech Republic': { name: 'Czech National Bank policy rate', short: 'CNB rate', rate: 3.75, asOf: '2026-09-14', source: BIS },
  Denmark: { name: 'Danmarks Nationalbank policy rate', short: 'DN rate', rate: 2.1, asOf: '2026-09-14', source: BIS },
  Estonia: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Finland: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  France: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Germany: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Greece: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Guernsey: { name: 'Bank of England policy rate', short: 'Bank Rate', rate: 3.75, asOf: '2026-09-14', source: BIS },
  'Hong Kong': { name: 'Hong Kong Monetary Authority policy rate', short: 'HKMA base rate', rate: 4, asOf: '2026-09-09', source: BIS },
  Hungary: { name: 'Hungarian National Bank policy rate', short: 'MNB rate', rate: 5.5, asOf: '2026-09-09', source: BIS },
  Iceland: { name: 'Central Bank of Iceland policy rate', short: 'CBI rate', rate: 8, asOf: '2026-09-15', source: BIS },
  India: { name: 'Reserve Bank of India policy rate', short: 'RBI repo', rate: 5.25, asOf: '2026-06', source: BIS },
  Indonesia: { name: 'Bank Indonesia policy rate', short: 'BI rate', rate: 5.75, asOf: '2026-09-03', source: BIS },
  Ireland: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  'Isle of Man': { name: 'Bank of England policy rate', short: 'Bank Rate', rate: 3.75, asOf: '2026-09-14', source: BIS },
  Israel: { name: 'Bank of Israel policy rate', short: 'BoI rate', rate: 3.5, asOf: '2026-07', source: BIS },
  Italy: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Japan: { name: 'Bank of Japan policy rate', short: 'BoJ rate', rate: 1, asOf: '2026-09-15', source: BIS },
  Jersey: { name: 'Bank of England policy rate', short: 'Bank Rate', rate: 3.75, asOf: '2026-09-14', source: BIS },
  Latvia: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Liechtenstein: { name: 'Swiss National Bank policy rate', short: 'SNB rate', rate: 0, asOf: '2026-09-15', source: BIS },
  Lithuania: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Luxembourg: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Malaysia: { name: 'Bank Negara Malaysia policy rate', short: 'OPR', rate: 2.75, asOf: '2026-09-14', source: BIS },
  Malta: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Mexico: { name: 'Bank of Mexico policy rate', short: 'Banxico rate', rate: 6.5, asOf: '2026-09-15', source: BIS },
  Morocco: { name: 'Bank Al-Maghrib policy rate', short: 'BAM rate', rate: 2.25, asOf: '2026-08-31', source: BIS },
  Netherlands: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  'New Zealand': { name: 'Reserve Bank of New Zealand policy rate', short: 'OCR', rate: 2.75, asOf: '2026-09-11', source: BIS },
  'North Macedonia': { name: 'National Bank of the Republic of North Macedonia policy rate', short: 'NBRNM rate', rate: 4.25, asOf: '2026-09-15', source: BIS },
  Norway: { name: 'Norges Bank policy rate', short: 'Norges Bank rate', rate: 4.25, asOf: '2026-09-11', source: BIS },
  Peru: { name: 'Central Reserve Bank of Peru policy rate', short: 'BCRP rate', rate: 4.25, asOf: '2026-09-11', source: BIS },
  Philippines: { name: 'Bangko Sentral ng Pilipinas policy rate', short: 'BSP rate', rate: 5, asOf: '2026-09-11', source: BIS },
  Poland: { name: 'National Bank of Poland policy rate', short: 'NBP rate', rate: 3.75, asOf: '2026-09-15', source: BIS },
  Portugal: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Romania: { name: 'National Bank of Romania policy rate', short: 'NBR rate', rate: 6.5, asOf: '2026-09-15', source: BIS },
  Russia: { name: 'Bank of Russia policy rate', short: 'key rate', rate: 14, asOf: '2026-09-15', source: BIS },
  Serbia: { name: 'National Bank of Serbia policy rate', short: 'NBS rate', rate: 5.75, asOf: '2026-09-11', source: BIS },
  Slovakia: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Slovenia: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  'South Africa': { name: 'South African Reserve Bank policy rate', short: 'repo rate', rate: 7, asOf: '2026-09-14', source: BIS },
  'South Korea': { name: 'Bank of Korea policy rate', short: 'BoK rate', rate: 3, asOf: '2026-08-28', source: BIS },
  Spain: { name: 'European Central Bank policy rate', short: 'ECB rate', rate: 2.25, asOf: '2026-09-15', source: BIS },
  Sweden: { name: 'Sveriges Riksbank policy rate', short: 'Riksbank rate', rate: 1.75, asOf: '2026-09-15', source: BIS },
  Switzerland: { name: 'Swiss National Bank policy rate', short: 'SNB rate', rate: 0, asOf: '2026-09-15', source: BIS },
  Thailand: { name: 'Bank of Thailand policy rate', short: 'BoT rate', rate: 1, asOf: '2026-09-10', source: BIS },
  Turkey: { name: 'Central Bank of the Republic of Turkey policy rate', short: 'CBRT rate', rate: 37, asOf: '2026-09-11', source: BIS },
  'United Kingdom': { name: 'Bank of England policy rate', short: 'Bank Rate', rate: 3.75, asOf: '2026-09-14', source: BIS },
  'United States': { name: 'US Federal Reserve policy rate', short: 'Fed funds', rate: 3.625, asOf: '2026-09-15', source: BIS },
};

/** The expected long-term inflation a country's figures are converted with, percent. */
export function countryInflation(country: string): number | null {
  const c = (COUNTRIES as Record<string, { inflationLocal?: number } | undefined>)[country];
  return c ? c.inflationLocal ?? MARKET.usInflationLongRun : null;
}

/**
 * Whether a country's benchmark rate is used as its default cost of debt: `none` when there is no
 * rate on file, `inconsistent` when it sits more than `maxBenchmarkAboveInflationPoints` above the
 * inflation default, else `used`.
 */
export function benchmarkStatus(country: string): { status: 'used' | 'none' | 'inconsistent'; lending: LendingRate | null; inflation: number | null } {
  const lending = (LENDING_RATES as Record<string, LendingRate | undefined>)[country] ?? null;
  const inflation = countryInflation(country);
  if (!lending || inflation === null) return { status: 'none', lending, inflation };
  const gap = lending.rate - inflation;
  return { status: gap > ASSUMPTIONS.maxBenchmarkAboveInflationPoints ? 'inconsistent' : 'used', lending, inflation };
}

/**
 * The default pre-tax cost of debt for a country, percent: the local base rate plus the typical
 * margin. Null when the rate is missing or inconsistent with the inflation default, and for an
 * unknown country: the cost of debt is then built from the spreads.
 */
export function defaultCostOfDebt(country: string): number | null {
  const b = benchmarkStatus(country);
  return b.status === 'used' && b.lending ? +(b.lending.rate + ASSUMPTIONS.companyCreditSpread).toFixed(2) : null;
}

/**
 * The lending rate behind a result's cost of debt: the country's, when the result names it. Results
 * stored before 2026-09-22 carry only the currency, which then identifies the country only when one
 * country uses it (true of all seven countries offered at the time; not of EUR or USD since).
 */
export function lendingForCurrency(code: string, country?: string): { country: string; lending: LendingRate } | null {
  const table = COUNTRIES as Record<string, { code: string }>;
  let name = country && table[country] ? country : undefined;
  if (!name) {
    const users = Object.keys(table).filter((k) => table[k].code === code);
    name = users.length === 1 ? users[0] : undefined;
  }
  const lending = name ? (LENDING_RATES as Record<string, LendingRate | undefined>)[name] : undefined;
  return name && lending ? { country: name, lending } : null;
}

/** Why a cost of debt is built from the spreads, as the opening of a sentence. */
export function builtCostOfDebtReason(country: string): string {
  const b = benchmarkStatus(country);
  if (b.status === 'inconsistent' && b.lending && b.inflation !== null) {
    return `The ${b.lending.name} of ${b.lending.rate.toFixed(2)}% is more than ${ASSUMPTIONS.maxBenchmarkAboveInflationPoints} points above the ${b.inflation.toFixed(1)}% long-term inflation used for ${country}, which would overstate the US dollar cost of debt`;
  }
  if (b.status === 'used') return 'The benchmark lending rate was not used';
  return `No benchmark lending rate for ${country} is on file`;
}

/**
 * The source line for a cost of debt built from the spreads: always for a country with no benchmark
 * rate on file, and for one that has a rate when the visitor cleared the field.
 */
export function builtCostOfDebtNote(country: string): SourceNote {
  const why = builtCostOfDebtReason(country);
  return {
    label: 'Cost of debt',
    source: `${why}, so the pre-tax cost of debt is the risk-free rate plus the ${country} default spread (Damodaran) plus a ${ASSUMPTIONS.companyCreditSpread.toFixed(1)}% margin set by PaceMakers. Default spread as at`,
    asOf: 'January 2026 update',
  };
}

/** The source line for a country's default cost of debt, for the report and the results page. */
export function lendingSourceNote(country: string): SourceNote | null {
  const l = (LENDING_RATES as Record<string, LendingRate | undefined>)[country];
  if (!l) return null;
  return {
    label: 'Cost of debt',
    source: `${l.name} of ${l.rate.toFixed(2)}% (${l.source}), plus a ${ASSUMPTIONS.companyCreditSpread.toFixed(1)}% margin set by PaceMakers, unless changed. Rate as at`,
    asOf: formatDataDate(l.asOf),
  };
}
export const WACC_SOURCE_SENTENCE = `Sources: country risk premiums, default spreads and tax rates from Aswath Damodaran, January 2026 update. Implied equity risk premium of ${pct2(MARKET_DATA.erp.value)}, Damodaran, as at ${ERP_DATE_TEXT}. Unlevered betas (corrected for cash) and D/E from Damodaran global industry data, January 2026. Risk-free rate uses the US 10-year Treasury yield of ${pct2(MARKET_DATA.treasury.value)} (${formatDataDate(MARKET_DATA.treasury.asOf)}), less the ${pct2(MARKET.usDefaultSpread)} US default spread per Damodaran’s method.`;
