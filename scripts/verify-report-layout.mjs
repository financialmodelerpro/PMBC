// scripts/verify-report-layout.mjs
//
// Proves the valuation report keeps its layout in every combination of the
// inputs that change page length, not only the ten QA cases. Each report must:
//
//   1. have exactly eight pages, the closing page last;
//   2. fill page 6 to the bottom: pages 6 and 7 are one flowing section, so a
//      page 6 that ends early means a block jumped a page and left a gap (the
//      failure reported on 2026-09-21: a 35% stake with a minority discount,
//      add-backs, end of service benefits and leases gave nine pages, a half
//      empty page 6 and a page 8 holding only "Important");
//   3. keep the tax and balance sheet block whole on page 6, "EBITDA,
//      normalised" with it;
//   4. carry "Important" on page 7.
//
// The matrix: country (Saudi with 60% GCC ownership and cash, Pakistan, UAE) x
// stake (100%, 35% minority, 60% control) x normalisation (none, owner costs not
// carried plus one-off, owner costs carried) x bridge items (none, end of service
// and leases, all four) x peers (none, two, eight with long names) x invested
// capital (none, in parts) x margin (as entered, weak, which raises the number
// of checks and value factors). The reported case is first. Nothing is written
// to a database and nothing is sent.
//
//   npm run verify-report-layout                  the reported case and a fixed spread of 120
//   LAYOUT_FULL=1 npm run verify-report-layout    every combination (973, about an hour)
//   LAYOUT_SAMPLE=40 npm run verify-report-layout a smaller spread

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, VALUATION_DATE, fullFeatureCase, minimalCase } from './lib/valuationCases.mjs';

for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']) delete process.env[k];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const pdfModule = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

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
// The case reported on 2026-09-21 first: a 35% stake with a minority discount, add-backs, EOSB and leases.
// This combination reproduces all three symptoms on the layout before the fix (nine pages, page 6 ending
// near 595pt, and the tax and balance sheet block with "Important" pushed over).
const reported = { country: 'Pakistan', stake: 'minority35', norm: 'notCarried', bridge: 'eosbLeases', peers: 'eight', ic: 'parts', margin: 'entered' };
combos = [reported, ...combos];
const sample = process.env.LAYOUT_FULL === '1' ? 0 : Number(process.env.LAYOUT_SAMPLE || 120);
if (sample > 0) combos = [reported, ...combos.slice(1).filter((_, k) => k % Math.ceil((combos.length - 1) / sample) === 0)];

/* ------------------------------------------------------------------------ */
/* Measure                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Page 6 must be at least 80% full: its content reaches this far down (points from the top of an 842pt
 * page; content runs from about 56 to 786). The section after the checks starts with a page title, a
 * heading and a paragraph kept together, so page 6 can end up to about 135pt early when that group
 * starts on page 7, which is a page end, not a gap. A block that jumped a page left page 6 near 450.
 */
const PAGE6_FILLED_TO = 640;

async function pages(buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const H = page.getViewport({ scale: 1 }).height;
    const items = (await page.getTextContent()).items.filter((i) => i.str.trim());
    const body = items.filter((i) => H - i.transform[5] < H - 70); // above the footer
    out.push({ text: items.map((i) => i.str).join(' ').replace(/\s+/g, ' '), lowest: Math.max(0, ...body.map((i) => H - i.transform[5])) });
  }
  return out;
}

console.log(`Report layout: ${combos.length} combinations`);
let worst6 = Infinity, worstCase = null, refused = 0;
for (const [k, c] of combos.entries()) {
  const label = Object.values(c).join(' / ');
  const out = engine.runValuation(state.toInputs(build(c), VALUATION_DATE));
  if (!out.ok) {
    refused++;
    check(`${label}: case runs`, false, JSON.stringify(out.errors).slice(0, 160));
    continue;
  }
  const r = out.result;
  const p = await pages(await pdfModule.renderValuationReport(r, { ...REPORT_META, branding: null, company: 'Al Mashreq Integrated Healthcare and Education Services Company', description: 'A business described in two paragraphs.\n\nSo the cover carries the About block.', bookingHref: 'https://www.pacemakersglobal.com/b/Fq7mKx2RtWp9e' }));
  const tag = k === 0 ? `reported case (${label})` : label;
  check(`${tag}: eight pages`, p.length === 8, `${p.length} pages`);
  if (p.length < 7) continue;
  check(`${tag}: page 6 filled to the bottom, no gap`, p[5].lowest >= PAGE6_FILLED_TO, `page 6 ends at ${Math.round(p[5].lowest)}pt`);
  check(`${tag}: tax and balance sheet block whole on page 6`, p[5].text.includes('Balance sheet') && !p[6].text.includes('Balance sheet'));
  if (r.normalisation.used) check(`${tag}: both EBITDA rows on page 6`, p[5].text.includes('EBITDA, reported') && p[5].text.includes('EBITDA, normalised') && !p[6].text.includes('EBITDA, normalised'));
  check(`${tag}: column titles read "Tax, zakat and timing", never "and zakat and timing"`, !p[5].text.includes('and zakat and timing'));
  check(`${tag}: Important on page 7`, p[6].text.includes('Important') && p[6].text.includes('Indicative only'));
  if (p.length === 8) check(`${tag}: closing page last`, p[7].text.includes('Working with PaceMakers'));
  if (p[5].lowest < worst6) { worst6 = p[5].lowest; worstCase = label; }
  if (k === 0) console.log(`  reported case: ${p.length} pages, page 6 ends at ${Math.round(p[5].lowest)}pt`);
  if ((k + 1) % 100 === 0) console.log(`  ${k + 1} of ${combos.length}`);
}
console.log(`  lowest page 6 end: ${Math.round(worst6)}pt (${worstCase})${refused ? `; ${refused} cases refused by the engine` : ''}`);

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
