// scripts/lib/valuationCases.mjs
//
// Shared valuation cases for the verifiers and the example PDF renderer, built
// through the same state functions the tool page uses. No database, no network.

/**
 * The valuation date every verifier and example uses, so a figure does not move
 * with the day a script runs. The report date in REPORT_META matches it.
 */
export const VALUATION_DATE = '2026-09-16';

export function withFin(s, fin) {
  return { ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) };
}

/** The reference example, left exactly at its defaults. Every version 2 feature neutral. */
export function minimalCase(state) {
  return state.onEnterWacc(state.onLeaveCompany(state.exampleState()));
}

/**
 * Pakistan with every version 2 feature in use: normalised EBITDA carried into
 * the forecast, all four bridge items, a 40% stake with a minority discount,
 * custom scenarios and weights, invested capital, and two listed peers.
 */
export function fullFeatureCase(state) {
  let s = state.initialState();
  s = state.applyIndustryDefaults({ ...s, industry: 'Food Processing' });
  s = state.applyCountryDefaults({ ...s, country: 'Pakistan', debt: '1200', cash: '0', financialYear: '2025' });
  s = withFin(s, {
    rev: [8500, 9800, 11200, 12768, 14556, 16594, 18917, 21565],
    ebitda: [1250, 1480, 1720, 2043, 2329, 2655, 3027, 3450],
    da: [300, 340, 390, 383, 437, 498, 568, 647],
    capex: [450, 520, 600, 638, 728, 830, 946, 1078],
    nwc: [1500, 1700, 1950, 2298, 2620, 2987, 3405, 3882],
  });
  s = state.onEnterWacc(state.resetWacc(s));
  s = {
    ...s,
    peers: [state.newPeer('Listed peer one', '8.5', '1.1'), state.newPeer('Listed peer two', '10.5', '1.5')],
    norm: { oneOff: '85', ownerCosts: '40', carryOwnerCosts: true },
    bridge: { eosb: '160', leases: '220', minorityInterest: '75', surplusAssets: '300' },
    investedCapital: '6200',
    stake: { percent: '40', adjustment: 'minority_discount', controlPremium: '25', minorityDiscount: '20' },
    stakeAdjustmentTouched: true,
    scenarios: {
      upsideGrowth: '4', upsideMargin: '2', downsideGrowth: '-5', downsideMargin: '-3',
      weightDownside: '30', weightBase: '50', weightUpside: '20',
    },
    midYear: false,
    dcfWeight: '50',
    companyName: 'Example Foods Pakistan',
    description:
      'Example Foods Pakistan processes and packages dairy and ready meals for retail chains across Punjab and Sindh, from two plants near Lahore and Karachi.\n\nThe owners are preparing to sell a minority stake to fund a third plant and a cold chain for export to the GCC, and want an independent view of value before speaking to investors.',
  };
  s = state.syncPeerDefaults(s);
  return s;
}

export const REPORT_META = {
  preparedFor: 'Example Reader',
  purpose: 'sale',
  generatedAt: new Date('2026-09-16T12:00:00Z'),
  dataVersion: '2026-09-17',
  bookingHref: 'https://www.pacemakersglobal.com/api/tools/book?t=example-token&src=pdf',
};
