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
 *      Spreads and Risk Premiums" and "Corporate Marginal Tax Rates by country".
 *   2. Unlevered beta (corrected for cash) and market D/E: the global
 *      "Betas by Sector" and "Debt Fundamentals by Sector" datasets.
 *   3. Mature market implied ERP (add the month to `IMPLIED_ERP_BY_MONTH`,
 *      ideally the same month as the Treasury yield) and the US default spread.
 *   4. The US 10-year Treasury yield, on the date of the refresh, and its date
 *      in `usTreasury10yAsOf`.
 *   5. FX to SAR and the inflation expectations for non-pegged currencies.
 *   6. Update every `asOf` below, bump `VALUATION_DATA_VERSION`, run
 *      `npm run verify-valuation-engine`. The verifier passes these values into
 *      the reference HTML itself; do not edit the reference file.
 * Leads store the version they were computed under, so older leads keep
 * showing the numbers their owner was actually given.
 */

/** Stamped on every lead. Bump on any change to a value in this file. */
export const VALUATION_DATA_VERSION = '2026-09-17';

/**
 * How each data version is described to a reader: the PDF report's cover and
 * footer, and the admin lead view. Add a line with every bump of
 * `VALUATION_DATA_VERSION`, so leads computed under an older version keep the
 * description of the data they were actually given.
 */
export const DATA_VERSION_LABELS: Record<string, string> = {
  '2026-09-16': 'Damodaran January 2026, risk-free September 2026',
  '2026-09-17': 'Market data: Damodaran 2026, risk-free 15 September 2026',
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
  zakatRate: 2.5,
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
export function defaultFinancialYearFor(today: Date = new Date()): number {
  return Math.max(ASSUMPTIONS.defaultFinancialYear, today.getUTCFullYear() - 1);
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
  /** First forecast year EBITDA margin above the last actual year by more than this, percentage points. */
  marginStepPoints: 1.5,
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
    sarPerUnit: 0.01333,
    growth: 6.0,
    growthCeiling: 9.0,
    lossOffsetCap: 100,
    inflationLocal: 7.0,
    inflationUs: 2.5,
  },
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
  netDebt: 45,
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
    source: 'Indicative exchange rates to SAR, long-term inflation for non-pegged currencies, preset private company multiples, size premium bands and credit spread, reviewed annually',
    asOf: 'September 2026',
  },
  {
    label: 'Zakat and tax loss carry-forward',
    source: `Zakat at ${TAX.zakatRate}% of an approximate base; loss offset caps simplified from local rules (Saudi Arabia 25%, United Arab Emirates 75%, elsewhere uncapped), expiry not modelled. Set by PaceMakers`,
    asOf: 'September 2026',
  },
];

/** The one-paragraph version shown under the WACC build. */
export const WACC_SOURCE_SENTENCE = `Sources: country risk premiums, default spreads and tax rates from Aswath Damodaran, January 2026 update. Implied equity risk premium of ${pct2(MARKET_DATA.erp.value)}, Damodaran, as at ${ERP_DATE_TEXT}. Unlevered betas (corrected for cash) and D/E from Damodaran global industry data, January 2026. Risk-free rate uses the US 10-year Treasury yield of ${pct2(MARKET_DATA.treasury.value)} (${formatDataDate(MARKET_DATA.treasury.asOf)}), less the ${pct2(MARKET.usDefaultSpread)} US default spread per Damodaran’s method.`;
