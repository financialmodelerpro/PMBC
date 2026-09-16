/**
 * Form state for the valuation tool, and its conversion to engine inputs.
 *
 * Every field is held as the string the visitor typed, as the reference's DOM
 * inputs were, so a half-typed "1." or a deliberately blank cell survives a
 * re-render. `toInputs` parses with `parseFloat`, which is what the reference's
 * `val()` did, so the same keystrokes produce the same numbers.
 */

import { ASSUMPTIONS, COUNTRIES, EXAMPLE_COMPANY, MARKET } from '@/lib/tools/valuation/data';
import {
  currencyFor,
  defaultExitMultiple,
  defaultSizePremium,
  fillForecast,
  industryFor,
  LINE_KEYS,
  TOTAL_YEARS,
  HISTORY_YEARS,
  type Financials,
  type LineKey,
  type Peer,
  type ValuationInputs,
  type WaccInputs,
} from '@/lib/tools/valuation/engine';

export type WaccKey = keyof WaccInputs;
export const WACC_KEYS: WaccKey[] = ['rf', 'erp', 'crp', 'bu', 'de', 'sp', 'ds', 'cs', 'tax', 'inflationLocal', 'inflationUs'];

export type FillKey = 'growth' | 'ebitdaMargin' | 'daOfRevenue' | 'capexOfRevenue' | 'nwcOfRevenue';

export type PeerRow = { id: number; name: string; evEbitda: string; evRevenue: string };

export type FormState = {
  industry: string;
  country: string;
  financialYear: string;
  netDebt: string;
  fin: Record<LineKey, string[]>;
  fill: Record<FillKey, string>;
  wacc: Record<WaccKey, string>;
  spTouched: boolean;
  growth: string;
  exitMultiple: string;
  xmTouched: boolean;
  midYear: boolean;
  peers: PeerRow[];
  privateDiscount: string;
  dcfWeight: string;
};

let peerSeq = 0;
export function newPeer(name = '', evEbitda = '', evRevenue = ''): PeerRow {
  peerSeq += 1;
  return { id: peerSeq, name, evEbitda, evRevenue };
}

export function initialState(): FormState {
  const blankLine = () => new Array<string>(TOTAL_YEARS).fill('');
  const fill = ASSUMPTIONS.forecastFill;
  return {
    industry: '',
    country: '',
    financialYear: String(ASSUMPTIONS.defaultFinancialYear),
    netDebt: '',
    fin: { rev: blankLine(), ebitda: blankLine(), da: blankLine(), capex: blankLine(), nwc: blankLine() },
    fill: {
      growth: String(fill.growth),
      ebitdaMargin: String(fill.ebitdaMargin),
      daOfRevenue: String(fill.daOfRevenue),
      capexOfRevenue: String(fill.capexOfRevenue),
      nwcOfRevenue: String(fill.nwcOfRevenue),
    },
    wacc: { rf: '', erp: '', crp: '', bu: '', de: '', sp: '', ds: '', cs: '', tax: '', inflationLocal: '', inflationUs: '' },
    spTouched: false,
    growth: '2.5',
    exitMultiple: '',
    xmTouched: false,
    midYear: ASSUMPTIONS.midYear,
    peers: [newPeer(), newPeer()],
    privateDiscount: String(ASSUMPTIONS.privateDiscount),
    dcfWeight: String(ASSUMPTIONS.dcfWeight),
  };
}

export function num(s: string): number | null {
  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
}

/** A number as the reference wrote it back into an input. */
export function str(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(v) ? '' : String(v);
}

export function parseFinancials(fin: FormState['fin']): Financials {
  const out = {} as Financials;
  for (const k of LINE_KEYS) out[k] = fin[k].map(num);
  return out;
}

/**
 * Writes the forecast columns of a filled result back as strings, leaving the
 * three actual years exactly as typed. The reference did the same: its fill
 * read the raw strings and rewrote only the forecast.
 */
export function withForecastFrom(fin: FormState['fin'], filled: Financials): FormState['fin'] {
  const out = {} as FormState['fin'];
  for (const k of LINE_KEYS) {
    out[k] = fin[k].map((v, i) => (i < HISTORY_YEARS ? v : str(filled[k][i])));
  }
  return out;
}

export function parsePeers(rows: PeerRow[]): Peer[] {
  return rows.map((r) => ({ name: r.name.trim(), evEbitda: num(r.evEbitda), evRevenue: num(r.evRevenue) }));
}

export function parseWacc(w: FormState['wacc']): WaccInputs {
  const out = {} as WaccInputs;
  for (const k of WACC_KEYS) out[k] = num(w[k]);
  return out;
}

export function toInputs(s: FormState): ValuationInputs {
  const fy = parseInt(s.financialYear, 10);
  return {
    industry: s.industry,
    country: s.country,
    financialYear: Number.isNaN(fy) ? null : fy,
    netDebt: num(s.netDebt),
    financials: parseFinancials(s.fin),
    wacc: parseWacc(s.wacc),
    growth: num(s.growth),
    exitMultiple: num(s.exitMultiple),
    midYear: s.midYear,
    // Only rows with something in them travel, as the reference recorded.
    peers: parsePeers(s.peers).filter(
      (p) => p.name || p.evEbitda !== null || p.evRevenue !== null,
    ),
    privateDiscount: num(s.privateDiscount),
    dcfWeight: num(s.dcfWeight),
  };
}

/* ------------------------------------------------------------------------ */
/* Defaults, applied as the reference applied them                           */
/* ------------------------------------------------------------------------ */

export function applyCountryDefaults(s: FormState): FormState {
  const c = (COUNTRIES as Record<string, (typeof COUNTRIES)[keyof typeof COUNTRIES]>)[s.country];
  if (!c) return s;
  const wacc = { ...s.wacc, crp: str(c.crp), ds: str(c.ds), tax: str(c.tax) };
  if (!c.pegged && 'inflationLocal' in c) {
    wacc.inflationLocal = str(c.inflationLocal);
    wacc.inflationUs = str(c.inflationUs);
  }
  return { ...s, wacc, growth: str(c.growth) };
}

/** Beta, D/E and a fresh exit multiple default. A new industry resets a typed multiple. */
export function applyIndustryDefaults(s: FormState): FormState {
  const i = industryFor(s.industry);
  if (!i) return s;
  const next = { ...s, wacc: { ...s.wacc, bu: str(i.unleveredBeta), de: str(i.debtToEquity) }, xmTouched: false };
  return syncExitMultiple(next);
}

/** Keeps the exit multiple on its default until the visitor types one. */
export function syncExitMultiple(s: FormState): FormState {
  if (s.xmTouched) return s;
  const xm = defaultExitMultiple(s.industry, parsePeers(s.peers));
  return xm === null ? s : { ...s, exitMultiple: str(xm) };
}

export function sizePremiumDefault(s: FormState): string {
  return str(defaultSizePremium(num(s.fin.rev[HISTORY_YEARS - 1]), currencyFor(s.country)));
}

/* ------------------------------------------------------------------------ */
/* Step transitions, as the reference's navigation applied them              */
/* ------------------------------------------------------------------------ */

/** Leaving step 1 for the first time prefills the whole cost of capital. */
export function onLeaveCompany(s: FormState): FormState {
  return s.wacc.rf ? s : resetWacc(s);
}

/** Entering the cost of capital re-sizes the premium, unless the visitor set one. */
export function onEnterWacc(s: FormState): FormState {
  return s.spTouched ? s : { ...s, wacc: { ...s.wacc, sp: sizePremiumDefault(s) } };
}

/** The "Load an example company" button. */
export function exampleState(): FormState {
  const ex = EXAMPLE_COMPANY;
  let next: FormState = {
    ...initialState(),
    industry: ex.industry,
    country: ex.country,
    financialYear: String(ex.financialYear),
    netDebt: String(ex.netDebt),
    fill: {
      growth: String(ex.fill.growth),
      ebitdaMargin: String(ex.fill.ebitdaMargin),
      daOfRevenue: String(ex.fill.daOfRevenue),
      capexOfRevenue: String(ex.fill.capexOfRevenue),
      nwcOfRevenue: String(ex.fill.nwcOfRevenue),
    },
    peers: ex.peers.map((p) => newPeer(p.name, String(p.evEbitda), String(p.evRevenue))),
  };
  const fin = {} as FormState['fin'];
  for (const k of LINE_KEYS) {
    fin[k] = next.fin[k].map((_, i) => (i < HISTORY_YEARS ? String(ex.history[k][i]) : ''));
  }
  next = applyFill({ ...next, fin });
  return resetWacc(next);
}

/** "Fill forecast". Returns the error to show when there is no revenue to grow from. */
export function applyFill(s: FormState): FormState & { fillError?: string } {
  const filled = fillForecast(parseFinancials(s.fin), {
    growth: num(s.fill.growth),
    ebitdaMargin: num(s.fill.ebitdaMargin),
    daOfRevenue: num(s.fill.daOfRevenue),
    capexOfRevenue: num(s.fill.capexOfRevenue),
    nwcOfRevenue: num(s.fill.nwcOfRevenue),
  });
  if (!filled.ok) return { ...s, fillError: filled.error };
  return { ...s, fin: withForecastFrom(s.fin, filled.financials) };
}

export function resetWacc(s: FormState): FormState {
  let next: FormState = {
    ...s,
    wacc: {
      ...s.wacc,
      rf: str(+(MARKET.usTreasury10y - MARKET.usDefaultSpread).toFixed(2)),
      erp: str(MARKET.matureErp),
      cs: str(ASSUMPTIONS.companyCreditSpread),
    },
  };
  next = applyCountryDefaults(next);
  next = applyIndustryDefaults(next);
  return { ...next, wacc: { ...next.wacc, sp: sizePremiumDefault(next) }, spTouched: false };
}
