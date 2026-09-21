// scripts/lib/layoutCases.mjs
//
// The report layout matrix: the inputs that change how long pages 5 to 7 run.
// Shared by verify-report-layout and anything that measures the layout.

import { fullFeatureCase, minimalCase } from './valuationCases.mjs';

export function makeLayoutCases(state) {
  function base(country) {
    if (country === 'Pakistan') {
      const s = fullFeatureCase(state);
      return {
        ...s,
        peers: [],
        norm: { oneOff: '', ownerCosts: '', carryOwnerCosts: false },
        bridge: { eosb: '', leases: '', minorityInterest: '', surplusAssets: '' },
        icWorkingCapital: '',
        icFixedAssets: '',
        stake: { ...s.stake, percent: '100', adjustment: 'none' },
      };
    }
    let s = minimalCase(state);
    if (country === 'United Arab Emirates') s = state.onEnterWacc(state.resetWacc(state.applyCountryDefaults({ ...s, country })));
    else s = { ...s, gccOwnership: '60', cash: '45' };
    return s;
  }

  const LONG = ['Al Mashreq Integrated Industrial Holdings', 'Gulf Consolidated Services Company', 'Arabian Regional Logistics Group', 'National Specialised Manufacturing', 'Eastern Province Engineering Works', 'Riyadh Commercial Development Holding', 'Northern Emirates Trading and Contracting', 'Levant Diversified Industries'];

  function build({ country, stake, norm, bridge, peers, ic, margin }) {
    let s = base(country);
    const fin = { ...s.fin, ebitda: [...s.fin.ebitda] };
    if (margin === 'weak') for (let i = 3; i < 8; i++) fin.ebitda[i] = String(+fin.ebitda[i] * 0.55);
    s = { ...s, fin };
    const ltm = +s.fin.ebitda[2], rev = +s.fin.rev[2];
    const f = (v) => String(+v.toFixed(1));
    if (norm !== 'none') s = { ...s, norm: { oneOff: norm === 'notCarried' ? f(ltm * 0.1) : '', ownerCosts: f(ltm * 0.15), carryOwnerCosts: norm === 'carried' } };
    if (bridge !== 'none') {
      s = { ...s, bridge: bridge === 'eosbLeases' ? { eosb: f(rev * 0.02), leases: f(rev * 0.03), minorityInterest: '', surplusAssets: '' } : { eosb: f(rev * 0.02), leases: f(rev * 0.03), minorityInterest: f(rev * 0.01), surplusAssets: f(rev * 0.04) } };
    }
    if (peers !== 'none') {
      const n = peers === 'two' ? 2 : 8;
      s = { ...s, peers: LONG.slice(0, n).map((name, k) => state.newPeer(name, String(8 + k * 0.5), String(1 + k * 0.1), String(11 + k * 0.5))) };
    }
    if (ic === 'parts') s = { ...s, icWorkingCapital: '', icFixedAssets: f(rev * 0.5) };
    if (stake === 'minority35') s = { ...s, stake: { percent: '35', adjustment: 'minority_discount', controlPremium: '25', minorityDiscount: '20' }, stakeAdjustmentTouched: true };
    if (stake === 'control60') s = { ...s, stake: { percent: '60', adjustment: 'control_premium', controlPremium: '25', minorityDiscount: '20' }, stakeAdjustmentTouched: true };
    s = state.syncPeerDefaults(s);
    return s;
  }

  const D = {
    country: ['Saudi Arabia', 'Pakistan', 'United Arab Emirates'],
    stake: ['none', 'minority35', 'control60'],
    norm: ['none', 'notCarried', 'carried'],
    bridge: ['none', 'eosbLeases', 'all'],
    peers: ['none', 'two', 'eight'],
    ic: ['none', 'parts'],
    margin: ['entered', 'weak'],
  };

  let combos = [{}];
  for (const [k, vals] of Object.entries(D)) combos = combos.flatMap((c) => vals.map((v) => ({ ...c, [k]: v })));
  return { build, D, combos };
}
