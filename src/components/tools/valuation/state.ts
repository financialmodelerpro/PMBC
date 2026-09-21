/**
 * Form state for the valuation tool, and its conversion to engine inputs.
 *
 * Every field is held as the string the visitor typed, as the reference's DOM
 * inputs were, so a half-typed "1." or a deliberately blank cell survives a
 * re-render. `toInputs` parses with `parseFloat`, which is what the reference's
 * `val()` did, so the same keystrokes produce the same numbers.
 *
 * Plain functions of state, with no React, so the verifiers drive exactly the
 * transitions the page does.
 */

import {
  ASSUMPTIONS,
  COUNTRIES,
  EXAMPLE_COMPANY,
  MARKET,
  TAX,
  V2_DEFAULTS,
  WARNING_RULES,
  defaultCostOfDebt,
  defaultFinancialYearFor,
  marketDataInUse,
} from '@/lib/tools/valuation/data';
import { cleanProfile } from '@/lib/tools/valuation/profile';
import {
  INPUT_SCHEMA_VERSION,
  currencyFor,
  defaultExitMultiple,
  defaultPrivateDiscount,
  defaultSizePremium,
  fillForecast,
  industryFor,
  LINE_KEYS,
  TOTAL_YEARS,
  HISTORY_YEARS,
  type Financials,
  type LineKey,
  type Peer,
  type StakeAdjustment,
  type ValuationInputs,
  type WaccInputs,
} from '@/lib/tools/valuation/engine';

export type WaccKey = keyof WaccInputs;
export const WACC_KEYS: WaccKey[] = ['rf', 'erp', 'crp', 'bu', 'de', 'sp', 'ds', 'cs', 'tax', 'inflationLocal', 'inflationUs', 'kd'];

export type FillKey = 'growth' | 'ebitdaMargin' | 'daOfRevenue' | 'capexOfRevenue' | 'nwcOfRevenue';

export type PeerRow = { id: number; name: string; evEbitda: string; evRevenue: string; evEbit: string; pe: string };

export type BridgeKey = 'eosb' | 'leases' | 'minorityInterest' | 'surplusAssets';
export type ScenarioKey = 'upsideGrowth' | 'upsideMargin' | 'downsideGrowth' | 'downsideMargin' | 'weightDownside' | 'weightBase' | 'weightUpside';

export type FormState = {
  /** Report only. Never read by the engine. */
  companyName: string;
  description: string;
  industry: string;
  country: string;
  financialYear: string;
  /** Borrowings at the year end (version 4). Net debt is borrowings less cash. */
  debt: string;
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
  /** True once the visitor types a discount. Until then it follows the peers. */
  discountTouched: boolean;
  dcfWeight: string;
  /* Version 2 ---------------------------------------------------------- */
  norm: { oneOff: string; ownerCosts: string; carryOwnerCosts: boolean };
  bridge: Record<BridgeKey, string>;
  /** Invested capital as one figure: stored inputs from before it was split, and the verifiers. Not shown on the form. */
  investedCapital: string;
  /** Invested capital in two parts. Blank working capital means the last actual year's figure from the financials. */
  icWorkingCapital: string;
  icFixedAssets: string;
  /** Net income, last actual year, millions. Optional: only the P/E reference method reads it. */
  netIncome: string;
  /** The zakat rate, percent. Saudi Arabia only; 2.5 by default and editable. */
  zakatRate: string;
  /** The month the financial year ends, "1" to "12". December by default. */
  fyEndMonth: string;
  stake: { percent: string; adjustment: StakeAdjustment; controlPremium: string; minorityDiscount: string };
  /** True once the visitor picks an adjustment. Until then it follows the stake size. */
  stakeAdjustmentTouched: boolean;
  scenarios: Record<ScenarioKey, string>;
  /** Exploration only: percentage points on WACC from the results slider. */
  waccAdjustment: string;
  /* Version 3 ---------------------------------------------------------- */
  /** Saudi / GCC ownership, percent. Shown, and sent, for Saudi Arabia only. */
  gccOwnership: string;
  /** Cash at the year end. Required in every country: it nets off borrowings, and in Saudi Arabia adds to the zakat base. */
  cash: string;
};

let peerSeq = 0;
export function newPeer(name = '', evEbitda = '', evRevenue = '', evEbit = '', pe = ''): PeerRow {
  peerSeq += 1;
  return { id: peerSeq, name, evEbitda, evRevenue, evEbit, pe };
}

export function initialState(): FormState {
  const blankLine = () => new Array<string>(TOTAL_YEARS).fill('');
  const fill = ASSUMPTIONS.forecastFill;
  const d = V2_DEFAULTS;
  return {
    companyName: '',
    description: '',
    industry: '',
    country: '',
    financialYear: String(defaultFinancialYearFor()),
    debt: '',
    fin: { rev: blankLine(), ebitda: blankLine(), da: blankLine(), capex: blankLine(), nwc: blankLine() },
    fill: {
      growth: String(fill.growth),
      ebitdaMargin: String(fill.ebitdaMargin),
      daOfRevenue: String(fill.daOfRevenue),
      capexOfRevenue: String(fill.capexOfRevenue),
      nwcOfRevenue: String(fill.nwcOfRevenue),
    },
    wacc: { rf: '', erp: '', crp: '', bu: '', de: '', sp: '', ds: '', cs: '', tax: '', inflationLocal: '', inflationUs: '', kd: '' },
    spTouched: false,
    growth: '2.5',
    exitMultiple: '',
    xmTouched: false,
    midYear: ASSUMPTIONS.midYear,
    peers: [newPeer(), newPeer()],
    privateDiscount: String(ASSUMPTIONS.privateDiscount),
    discountTouched: false,
    dcfWeight: String(ASSUMPTIONS.dcfWeight),
    norm: { oneOff: '', ownerCosts: '', carryOwnerCosts: false },
    bridge: { eosb: '', leases: '', minorityInterest: '', surplusAssets: '' },
    investedCapital: '',
    icWorkingCapital: '',
    icFixedAssets: '',
    netIncome: '',
    zakatRate: String(TAX.zakatRate),
    fyEndMonth: '12',
    stakeAdjustmentTouched: false,
    stake: {
      percent: String(d.stake.percent),
      adjustment: 'none',
      controlPremium: String(d.stake.controlPremium),
      minorityDiscount: String(d.stake.minorityDiscount),
    },
    scenarios: {
      upsideGrowth: String(d.scenarios.upsideGrowth),
      upsideMargin: String(d.scenarios.upsideMargin),
      downsideGrowth: String(d.scenarios.downsideGrowth),
      downsideMargin: String(d.scenarios.downsideMargin),
      weightDownside: String(d.scenarioWeights.downside),
      weightBase: String(d.scenarioWeights.base),
      weightUpside: String(d.scenarioWeights.upside),
    },
    waccAdjustment: '0',
    // Required for Saudi Arabia and deliberately blank: no default.
    gccOwnership: '',
    cash: '',
  };
}

/**
 * Today as YYYY-MM-DD in UTC, the calendar the server values on. It once used the visitor's local
 * date, so late on 30 December in the Americas a year the page accepted was refused by the server
 * as twelve months old, and the lead was lost without a message.
 */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
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
  return rows.map((r) => ({ name: r.name.trim(), evEbitda: num(r.evEbitda), evRevenue: num(r.evRevenue), evEbit: num(r.evEbit ?? ''), pe: num(r.pe ?? '') }));
}

export function parseWacc(w: FormState['wacc']): WaccInputs {
  const out = {} as WaccInputs;
  for (const k of WACC_KEYS) out[k] = num(w[k]);
  return out;
}

/**
 * `valuationDate` defaults to today. The verifiers pass a fixed date so a
 * figure does not move with the day they run.
 */
export function toInputs(s: FormState, valuationDate: string | null = todayIso()): ValuationInputs {
  const fy = parseInt(s.financialYear, 10);
  const sc = s.scenarios;
  return {
    schemaVersion: INPUT_SCHEMA_VERSION,
    industry: s.industry,
    country: s.country,
    financialYear: Number.isNaN(fy) ? null : fy,
    debt: num(s.debt),
    // The engine derives net debt from these two on every run; this is the same figure, for the form's own checks.
    netDebt: netDebtOf(s),
    financials: parseFinancials(s.fin),
    wacc: parseWacc(s.wacc),
    growth: num(s.growth),
    exitMultiple: num(s.exitMultiple),
    midYear: s.midYear,
    // Only rows with something in them travel, as the reference recorded.
    peers: parsePeers(s.peers).filter((p) => p.name || p.evEbitda !== null || p.evRevenue !== null || p.evEbit !== null || p.pe !== null),
    netIncome: num(s.netIncome),
    privateDiscount: num(s.privateDiscount),
    dcfWeight: num(s.dcfWeight),
    normalisation: { oneOff: num(s.norm.oneOff), ownerCosts: num(s.norm.ownerCosts), carryOwnerCosts: s.norm.carryOwnerCosts },
    bridge: {
      eosb: num(s.bridge.eosb),
      leases: num(s.bridge.leases),
      minorityInterest: num(s.bridge.minorityInterest),
      surplusAssets: num(s.bridge.surplusAssets),
    },
    // Two parts when net fixed assets are entered (the engine sums them); the single legacy figure otherwise.
    investedCapital: num(s.icFixedAssets) !== null ? investedCapitalOf(s) : num(s.investedCapital),
    investedCapitalParts: num(s.icFixedAssets) !== null ? { workingCapital: num(s.icWorkingCapital), fixedAssets: num(s.icFixedAssets) } : null,
    stake: {
      percent: num(s.stake.percent),
      adjustment: s.stake.adjustment,
      controlPremium: num(s.stake.controlPremium),
      minorityDiscount: num(s.stake.minorityDiscount),
    },
    scenarios: {
      upsideGrowth: num(sc.upsideGrowth),
      upsideMargin: num(sc.upsideMargin),
      downsideGrowth: num(sc.downsideGrowth),
      downsideMargin: num(sc.downsideMargin),
      weightDownside: num(sc.weightDownside),
      weightBase: num(sc.weightBase),
      weightUpside: num(sc.weightUpside),
    },
    waccAdjustment: num(s.waccAdjustment) ?? 0,
    profile: cleanProfile({ companyName: s.companyName, description: s.description }),
    gccOwnership: s.country === TAX.zakatCountry ? num(s.gccOwnership) : null,
    zakatRate: s.country === TAX.zakatCountry ? num(s.zakatRate) : null,
    fyEndMonth: parseInt(s.fyEndMonth, 10) || 12,
    cash: num(s.cash),
    valuationDate,
  };
}

/* ------------------------------------------------------------------------ */
/* Defaults, applied as the reference applied them                           */
/* ------------------------------------------------------------------------ */

type CountryRecord = (typeof COUNTRIES)[keyof typeof COUNTRIES];

export function applyCountryDefaults(s: FormState): FormState {
  const c = (COUNTRIES as Record<string, CountryRecord>)[s.country];
  if (!c) return s;
  // The cost of debt follows the country too: its local lending rate plus the typical margin
  // (`defaultCostOfDebt`). A rate typed for another country is in that country's currency, so it goes.
  const wacc = { ...s.wacc, crp: str(c.crp), ds: str(c.ds), tax: str(c.tax), kd: str(defaultCostOfDebt(s.country)) };
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

/** Keeps the private company discount on its default (20% with peers, 0% without) until the visitor types one. */
/**
 * The stake adjustment follows the stake until the visitor picks one: a
 * minority discount at or below the control threshold (50%), none above it.
 * A control premium chosen for a stake without control is kept and warned
 * about (`premium_on_minority_stake`), never silently changed.
 */
export function syncStakeAdjustment(s: FormState): FormState {
  if (s.stakeAdjustmentTouched) return s;
  const p = num(s.stake.percent);
  const adjustment: StakeAdjustment = p !== null && p > 0 && p <= WARNING_RULES.controlStakeAbovePercent ? 'minority_discount' : 'none';
  return adjustment === s.stake.adjustment ? s : { ...s, stake: { ...s.stake, adjustment } };
}

export function syncPrivateDiscount(s: FormState): FormState {
  if (s.discountTouched) return s;
  return { ...s, privateDiscount: str(defaultPrivateDiscount(parsePeers(s.peers))) };
}

/** Both peer-driven defaults, after any change to the peer rows. */
export function syncPeerDefaults(s: FormState): FormState {
  return syncPrivateDiscount(syncExitMultiple(s));
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
    financialYear: String(defaultFinancialYearFor()),
    debt: String(ex.debt),
    cash: String(ex.cash),
    fill: {
      growth: String(ex.fill.growth),
      ebitdaMargin: String(ex.fill.ebitdaMargin),
      daOfRevenue: String(ex.fill.daOfRevenue),
      capexOfRevenue: String(ex.fill.capexOfRevenue),
      nwcOfRevenue: String(ex.fill.nwcOfRevenue),
    },
    peers: ex.peers.map((p) => newPeer(p.name, String(p.evEbitda), String(p.evRevenue))),
    gccOwnership: String(ex.gccOwnership),
  };
  const fin = {} as FormState['fin'];
  for (const k of LINE_KEYS) {
    fin[k] = next.fin[k].map((_, i) => (i < HISTORY_YEARS ? String(ex.history[k][i]) : ''));
  }
  next = applyFill({ ...next, fin });
  return syncPrivateDiscount(resetWacc(next));
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
      rf: str(+(marketDataInUse().treasury.value - MARKET.usDefaultSpread).toFixed(2)),
      erp: str(marketDataInUse().erp.value),
      cs: str(ASSUMPTIONS.companyCreditSpread),
      // The company's own borrowing rate is cleared too: the reset returns to the spread build.
      kd: '',
    },
  };
  next = applyCountryDefaults(next);
  next = applyIndustryDefaults(next);
  return { ...next, wacc: { ...next.wacc, sp: sizePremiumDefault(next) }, spTouched: false };
}

/** Rebuilds form state from stored engine inputs, for "Change inputs" after a reload and for admin. */
export function stateFromInputs(i: ValuationInputs): FormState {
  const base = initialState();
  const d = (v: number | null | undefined) => str(v ?? null);
  const fin = {} as FormState['fin'];
  for (const k of LINE_KEYS) fin[k] = i.financials[k].map((v) => d(v));
  const wacc = {} as FormState['wacc'];
  for (const k of WACC_KEYS) wacc[k] = d(i.wacc[k]);
  return {
    ...base,
    companyName: i.profile?.companyName ?? '',
    description: i.profile?.description ?? '',
    industry: i.industry,
    country: i.country,
    financialYear: d(i.financialYear),
    ...balancesFromInputs(i),
    fin,
    wacc,
    spTouched: true,
    growth: d(i.growth),
    exitMultiple: d(i.exitMultiple),
    xmTouched: true,
    midYear: i.midYear,
    peers: i.peers.length ? i.peers.map((p) => newPeer(p.name, d(p.evEbitda), d(p.evRevenue), d(p.evEbit ?? null), d(p.pe ?? null))) : base.peers,
    netIncome: d(i.netIncome ?? null),
    privateDiscount: d(i.privateDiscount),
    discountTouched: true,
    dcfWeight: d(i.dcfWeight),
    norm: i.normalisation
      ? { oneOff: d(i.normalisation.oneOff), ownerCosts: d(i.normalisation.ownerCosts), carryOwnerCosts: i.normalisation.carryOwnerCosts }
      : base.norm,
    bridge: i.bridge
      ? { eosb: d(i.bridge.eosb), leases: d(i.bridge.leases), minorityInterest: d(i.bridge.minorityInterest), surplusAssets: d(i.bridge.surplusAssets) }
      : base.bridge,
    investedCapital: i.investedCapitalParts?.fixedAssets !== null && i.investedCapitalParts?.fixedAssets !== undefined ? '' : d(i.investedCapital),
    icWorkingCapital: d(i.investedCapitalParts?.workingCapital ?? null),
    icFixedAssets: d(i.investedCapitalParts?.fixedAssets ?? null),
    zakatRate: d(i.zakatRate ?? TAX.zakatRate),
    fyEndMonth: String(i.fyEndMonth ?? 12),
    stakeAdjustmentTouched: true,
    stake: i.stake
      ? { percent: d(i.stake.percent), adjustment: i.stake.adjustment, controlPremium: d(i.stake.controlPremium), minorityDiscount: d(i.stake.minorityDiscount) }
      : base.stake,
    scenarios: i.scenarios
      ? {
          upsideGrowth: d(i.scenarios.upsideGrowth),
          upsideMargin: d(i.scenarios.upsideMargin),
          downsideGrowth: d(i.scenarios.downsideGrowth),
          downsideMargin: d(i.scenarios.downsideMargin),
          weightDownside: d(i.scenarios.weightDownside),
          weightBase: d(i.scenarios.weightBase),
          weightUpside: d(i.scenarios.weightUpside),
        }
      : base.scenarios,
    waccAdjustment: d(i.waccAdjustment ?? 0),
    // Stored inputs from before version 3 were valued on corporate tax alone.
    gccOwnership: i.gccOwnership === null || i.gccOwnership === undefined ? ((i.schemaVersion ?? 1) >= 3 ? '' : '0') : d(i.gccOwnership),
  };
}

/**
 * Borrowings and cash for the form. Version 4 inputs carry both. Earlier inputs
 * entered net debt, with cash (Saudi Arabia only) used for the zakat base alone,
 * so they are split to give the same net debt and the same zakat base:
 * borrowings are the positive net debt plus that cash, and cash is that cash
 * plus any net cash.
 */
export function balancesFromInputs(i: ValuationInputs): { debt: string; cash: string } {
  const d = (v: number | null | undefined) => str(v ?? null);
  if (i.debt !== null && i.debt !== undefined) return { debt: d(i.debt), cash: d(i.cash) };
  if (i.netDebt === null || i.netDebt === undefined) return { debt: '', cash: d(i.cash) };
  const zakatCash = i.cash ?? 0;
  return { debt: d(Math.max(i.netDebt, 0) + zakatCash), cash: d(zakatCash + Math.max(-i.netDebt, 0)) };
}

/**
 * Invested capital from the form's two boxes: working capital (blank means the
 * last actual year's net working capital in the financials) plus net fixed
 * assets. Null until net fixed assets are entered.
 */
export function investedCapitalOf(s: Pick<FormState, 'icWorkingCapital' | 'icFixedAssets' | 'fin'>): number | null {
  const fa = num(s.icFixedAssets);
  if (fa === null) return null;
  const wc = num(s.icWorkingCapital) ?? num(s.fin.nwc[HISTORY_YEARS - 1]);
  return wc === null ? null : wc + fa;
}

/** Net debt from the form's borrowings and cash, or null until both are numbers. */
export function netDebtOf(s: Pick<FormState, 'debt' | 'cash'>): number | null {
  const debt = num(s.debt), cash = num(s.cash);
  return debt === null || cash === null ? null : debt - cash;
}
