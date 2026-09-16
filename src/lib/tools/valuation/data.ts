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
 *   3. Mature market implied ERP and the US default spread.
 *   4. The US 10-year Treasury yield, on the date of the refresh.
 *   5. FX to SAR and the inflation expectations for non-pegged currencies.
 *   6. Update every `asOf` below, bump `VALUATION_DATA_VERSION`, run
 *      `npm run verify-valuation-engine`.
 * Leads store the version they were computed under, so older leads keep
 * showing the numbers their owner was actually given.
 */

/** Stamped on every lead. Bump on any change to a value in this file. */
export const VALUATION_DATA_VERSION = '2026-09-16';

export type SourceNote = { label: string; source: string; asOf: string };

/* ------------------------------------------------------------------------ */
/* Market inputs                                                             */
/* ------------------------------------------------------------------------ */

export const MARKET = {
  /** US 10-year Treasury yield, percent. */
  usTreasury10y: 5.0,
  /** Damodaran's US sovereign default spread, percent, subtracted to get a risk-free rate. */
  usDefaultSpread: 0.23,
  /** Damodaran implied mature market equity risk premium, percent. */
  matureErp: 4.23,
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
  /** Expected long-term local inflation, percent. Non-pegged currencies only. */
  inflationLocal?: number;
  /** Expected long-term US inflation, percent. Non-pegged currencies only. */
  inflationUs?: number;
};

export const COUNTRIES = {
  'Saudi Arabia': { crp: 0.78, ds: 0.51, tax: 20, code: 'SAR', pegged: true, sarPerUnit: 1, growth: 2.5 },
  'United Arab Emirates': { crp: 0.64, ds: 0.42, tax: 9, code: 'AED', pegged: true, sarPerUnit: 1.0211, growth: 2.5 },
  Qatar: { crp: 0.64, ds: 0.42, tax: 10, code: 'QAR', pegged: true, sarPerUnit: 1.0302, growth: 2.5 },
  Kuwait: { crp: 0.91, ds: 0.6, tax: 15, code: 'KWD', pegged: true, sarPerUnit: 12.2, growth: 2.5 },
  Oman: { crp: 2.85, ds: 1.87, tax: 15, code: 'OMR', pegged: true, sarPerUnit: 9.753, growth: 2.5 },
  Bahrain: { crp: 7.12, ds: 4.67, tax: 0, code: 'BHD', pegged: true, sarPerUnit: 9.973, growth: 2.5 },
  Pakistan: {
    crp: 9.71,
    ds: 6.37,
    tax: 29,
    code: 'PKR',
    pegged: false,
    sarPerUnit: 0.01333,
    growth: 6.0,
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
  peers: [
    { name: 'Listed peer A', evEbitda: 11.5, evRevenue: 1.9 },
    { name: 'Listed peer B', evEbitda: 9.8, evRevenue: 1.4 },
  ],
} as const;

/* ------------------------------------------------------------------------ */
/* Source notes                                                              */
/* ------------------------------------------------------------------------ */

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
    label: 'Mature market equity risk premium and US default spread',
    source: 'Aswath Damodaran, implied equity risk premium',
    asOf: 'January 2026 update',
  },
  {
    label: 'Risk-free rate',
    source: 'US 10-year Treasury at about 5.0%, less the 0.23% US default spread per Damodaran',
    asOf: 'mid September 2026',
  },
  {
    label: 'Exchange rates to SAR',
    source: 'Indicative rates, used only for deal size bands and size premium thresholds',
    asOf: 'September 2026',
  },
  {
    label: 'Inflation expectations for non-pegged currencies',
    source: 'Long-term expectations set by PaceMakers',
    asOf: 'September 2026',
  },
  {
    label: 'Preset comparables multiples, size premium bands and credit spread',
    source: 'Indicative private company ranges set by PaceMakers, reviewed annually',
    asOf: 'September 2026',
  },
];

/** The one-paragraph version shown under the WACC build. */
export const WACC_SOURCE_SENTENCE =
  'Sources: country risk premiums, default spreads, tax rates and mature market premium from Aswath Damodaran, January 2026 update. Unlevered betas (corrected for cash) and D/E from Damodaran global industry data, January 2026. Risk-free rate uses the US 10-year Treasury at about 5.0% in mid September 2026, less the 0.23% US default spread per Damodaran’s method.';
