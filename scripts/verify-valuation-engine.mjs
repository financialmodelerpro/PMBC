// scripts/verify-valuation-engine.mjs
//
// Holds the Business Valuation engine to the reference implementation it was
// ported from, by running both on the same cases and comparing every number.
//
// WHY THE REFERENCE RUNS IN A BROWSER
// Expected values typed into this file would only prove the engine matches
// whatever someone typed. So the reference HTML itself is opened in headless
// Chrome, driven through its own buttons and fields, and its internal `calc`
// object and rendered text are read back. The engine side is built through the
// same state functions the page uses (`src/components/tools/valuation/state.ts`),
// so a defaults or transition bug in the UI layer fails here too.
//
// WHAT IT CHECKS, PER CASE
//   1. Prefilled inputs: every cost of capital field, growth, and the whole
//      financials table, including the rounded forecast fill.
//   2. Every intermediate: WACC build, projection rows, discount factors,
//      terminal values, flexed ranges, comps multiples, blended EV. Relative
//      tolerance 1e-9, which is float noise, not rounding.
//   3. Every rendered figure: headline, KPIs, football field values and scale,
//      FCF, sensitivity and bridge tables, currency labels, deal size bands.
//   4. The three deliberate changes, asserted as changes: exit multiple
//      follows the peer median; negative equity floors the midpoint too; the
//      private company discount defaults to 20% once two or more peers are in
//      use and applies to the exit multiple as well as the comparables. For
//      the last, the reference is given the same discount and the discounted
//      exit multiple, so the rest of the run still compares exactly.
//   5. Every version 2 input (normalisation, bridge items, stake, scenarios,
//      invested capital, WACC adjustment) left at its neutral default, which
//      is what keeps these figures identical to the reference. The version 2
//      features themselves are proved by verify-valuation-v2.
//   6. Version 3 changed the method on purpose: the normalised terminal cash
//      flow, the stub period from the valuation date, zakat and loss
//      carry-forward. The engine is run here with `REFERENCE_METHOD`, no
//      valuation date and 0% Saudi / GCC ownership, which must reproduce the
//      reference exactly; verify-valuation-v2 proves the new method against
//      independent arithmetic. Tables are compared by value, since version 3
//      relabelled them (base case, 2dp WACC) and added rows the reference
//      never had.
//
// CASES
//   A. The reference's own example: Healthcare Support Services, Saudi Arabia,
//      FY2025, two listed peers, mid-year.
//   B. Pakistan: Food Processing, PKR, inflation conversion, preset comps,
//      end-of-year discounting, 20% private discount, 50% DCF weight.
//   C. Distressed UAE contractor: negative LTM EBITDA (revenue comps only),
//      hand-typed forecast, one peer (preset used), a typed size premium, and
//      net debt above enterprise value across the range.
//
//   npm run verify-valuation-engine
//
// No server needed. Chrome is found at the usual Windows paths or CHROME_PATH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REFERENCE = path.join(root, 'reference', 'tools', 'business-valuation.html');

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') } });
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));

let failures = 0;
let checks = 0;
const pass = () => checks++;
function fail(msg) {
  checks++;
  failures++;
  console.log('  FAIL  ' + msg);
}

/* ------------------------------------------------------------------------ */
/* Chrome over CDP, the same harness the layout verifiers use                */
/* ------------------------------------------------------------------------ */

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function waitFor(fn, tries = 80, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('timed out waiting for condition');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.value;
  }
}

async function openWs(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return ws;
}

async function launchChrome() {
  const chrome = CHROME_CANDIDATES.find((c) => fs.existsSync(c));
  if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');
  const port = 9361;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-cdp-val-'));
  const proc = spawn(
    chrome,
    ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok);
  const browserWs = await openWs((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl);
  const browser = new Cdp(browserWs);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.id === targetId);
  const tabWs = await openWs(tab.webSocketDebuggerUrl);
  const page = new Cdp(tabWs);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return {
    page,
    close() {
      try {
        tabWs.close();
        browserWs.close();
      } catch {
        /* already gone */
      }
      proc.kill();
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

const GATE = { name: 'Verifier Run', email: 'verifier@example.com', purpose: 'sale', deal: '50-200' };

/**
 * Each case is described once and applied to both sides:
 *   `ref`    a script run inside the reference page
 *   `ours`   the same edits applied through state.ts, in the same order
 */
const CASES = [
  {
    name: 'A. Reference example, Saudi Arabia',
    ref: `
      $("exampleBtn").click();
      document.querySelector('#p0 [data-next="1"]').click();
      document.querySelector('#p1 [data-next="2"]').click();
      document.querySelector('#p2 [data-next="3"]').click();
    `,
    ours() {
      let s = state.exampleState();
      s = state.onLeaveCompany(s);
      s = state.onEnterWacc(s);
      return s;
    },
    expectFloor: 'none',
    expectPeerExitMultiple: 10.65,
    expectAutoDiscount: 20,
  },
  {
    name: 'B. Pakistan, PKR with inflation conversion',
    ref: `
      const set = (id, v, ev) => { $(id).value = v; if (ev) $(id).dispatchEvent(new Event(ev)); };
      set("sector", "Food Processing", "change");
      set("country", "Pakistan", "change");
      set("fy", "2025", "change");
      set("netdebt", "1200");
      document.querySelector('#p0 [data-next="1"]').click();
      const hist = ${JSON.stringify(PK_HISTORY())};
      document.querySelectorAll("#finTable input").forEach(inp => {
        const i = +inp.dataset.i; if (i < 3) inp.value = hist[inp.dataset.k][i];
      });
      set("aG","14"); set("aM","16"); set("aD","3"); set("aC","5"); set("aW","18");
      $("fillBtn").click();
      document.querySelector('#p1 [data-next="2"]').click();
      document.querySelector('#p2 [data-next="3"]').click();
      set("midyr","0"); set("dlom","20"); set("wDcf","50");
    `,
    ours() {
      let s = state.initialState();
      s = state.applyIndustryDefaults({ ...s, industry: 'Food Processing' });
      s = state.applyCountryDefaults({ ...s, country: 'Pakistan' });
      s = { ...s, financialYear: '2025', netDebt: '1200' };
      s = state.onLeaveCompany(s);
      s = withHistory(s, PK_HISTORY());
      s = { ...s, fill: { growth: '14', ebitdaMargin: '16', daOfRevenue: '3', capexOfRevenue: '5', nwcOfRevenue: '18' } };
      s = state.applyFill(s);
      s = state.onEnterWacc(s);
      s = { ...s, midYear: false, privateDiscount: '20', dcfWeight: '50' };
      return s;
    },
    expectFloor: 'none',
    expectCurrency: 'PKR',
  },
  {
    name: 'C. Distressed UAE contractor, negative equity',
    ref: `
      const set = (id, v, ev) => { $(id).value = v; if (ev) $(id).dispatchEvent(new Event(ev)); };
      set("sector", "Engineering/Construction", "change");
      set("country", "United Arab Emirates", "change");
      set("fy", "2024", "change");
      set("netdebt", "400");
      document.querySelector('#p0 [data-next="1"]').click();
      const fin = ${JSON.stringify(UAE_FIN())};
      document.querySelectorAll("#finTable input").forEach(inp => { inp.value = fin[inp.dataset.k][+inp.dataset.i]; });
      document.querySelector('#p1 [data-next="2"]').click();
      set("cs", "3.5", "input");
      set("sp", "4", "input");
      document.querySelector('#p2 [data-next="3"]').click();
      const peer = document.querySelectorAll("#peerBody tr")[0].querySelectorAll("input");
      peer[0].value = "Only peer"; peer[1].value = "6"; peer[2].value = "0.5";
    `,
    ours() {
      let s = state.initialState();
      s = state.applyIndustryDefaults({ ...s, industry: 'Engineering/Construction' });
      s = state.applyCountryDefaults({ ...s, country: 'United Arab Emirates' });
      s = { ...s, financialYear: '2024', netDebt: '400' };
      s = state.onLeaveCompany(s);
      const fin = UAE_FIN();
      s = { ...s, fin: Object.fromEntries(Object.entries(fin).map(([k, v]) => [k, v.map(String)])) };
      s = state.onEnterWacc(s);
      s = { ...s, wacc: { ...s.wacc, cs: '3.5', sp: '4' }, spTouched: true };
      s = { ...s, peers: [state.newPeer('Only peer', '6', '0.5'), state.newPeer()] };
      s = state.syncExitMultiple(s);
      return s;
    },
    expectFloor: 'all',
    // One peer is not enough to use peer multiples, so no automatic discount.
    expectAutoDiscount: 0,
  },
];

function PK_HISTORY() {
  return {
    rev: [8500, 9800, 11200],
    ebitda: [1250, 1480, 1720],
    da: [300, 340, 390],
    capex: [450, 520, 600],
    nwc: [1500, 1700, 1950],
  };
}

function UAE_FIN() {
  return {
    rev: [300, 280, 250, 260, 275, 290, 305, 320],
    ebitda: [12, 4, -6, 2, 8, 14, 20, 24],
    da: [10, 10, 9, 9, 9, 9, 10, 10],
    capex: [8, 6, 5, 5, 6, 6, 7, 7],
    nwc: [60, 58, 55, 56, 58, 60, 62, 64],
  };
}

function withHistory(s, hist) {
  const fin = {};
  for (const k of Object.keys(s.fin)) fin[k] = s.fin[k].map((v, i) => (i < 3 ? String(hist[k][i]) : v));
  return { ...s, fin };
}

/* ------------------------------------------------------------------------ */
/* Reading the reference                                                     */
/* ------------------------------------------------------------------------ */

const READ_INPUTS = `(() => {
  const v = id => $(id).value;
  const fin = {};
  document.querySelectorAll("#finTable input").forEach(inp => {
    (fin[inp.dataset.k] ||= [])[+inp.dataset.i] = inp.value;
  });
  return {
    wacc: { rf: v("rf"), erp: v("erp"), crp: v("crp"), bu: v("bu"), de: v("de"), sp: v("sp"),
            ds: v("ds"), cs: v("cs"), tax: v("tax"), inflationLocal: v("infL"), inflationUs: v("infU") },
    growth: v("g"), exitMultiple: v("xm"), fin, currency: CUR.code, curm: document.querySelector(".curm").textContent,
    deals: [...$("fDeal").options].map(o => ({ value: o.value, label: o.textContent })),
  };
})()`;

const RUN_AND_READ = `(() => {
  $("runBtn").click();
  if ($("gate").classList.contains("hidden")) return { error: $("eStep4").textContent || "run did not reach the gate" };
  $("fName").value = ${JSON.stringify(GATE.name)};
  $("fEmail").value = ${JSON.stringify(GATE.email)};
  $("fPurpose").value = ${JSON.stringify(GATE.purpose)};
  $("fDeal").value = ${JSON.stringify(GATE.deal)};
  $("showBtn").click();
  const t = id => $(id).textContent;
  const cells = sel => [...document.querySelectorAll(sel)].map(e => e.textContent);
  const nanSafe = JSON.stringify(calc, (k, v) => (typeof v === "number" && !Number.isFinite(v)) ? "NaN:" + v : v);
  return {
    calc: nanSafe,
    text: {
      rRange: t("rRange"), rMid: t("rMid"), rEv: t("rEv"), rFy: t("rFy"),
      kW: t("kW"), kTv: t("kTv"), kIm: t("kIm"), kLtm: t("kLtm"),
      ffVals: cells("#ff .ff-val"), ffScale: cells("#ffScale span"),
      fcf: cells("#fcfTable th, #fcfTable td"),
      sens: cells("#sensTable th, #sensTable td"),
      bridge: cells("#bridgeTable th, #bridgeTable td"),
    },
  };
})()`;

function revive(json) {
  return JSON.parse(json, (k, v) => (typeof v === 'string' && v.startsWith('NaN:') ? Number(v.slice(4)) : v));
}

/* ------------------------------------------------------------------------ */
/* Comparison                                                                */
/* ------------------------------------------------------------------------ */

function close(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function num(label, ours, ref) {
  if (close(ours, ref)) pass();
  else fail(`${label}: ours ${ours}, reference ${ref}`);
}

function nums(label, ours, ref) {
  if (ours === null || ref === null || ours === undefined || ref === undefined) {
    if (ours == null && ref == null) pass();
    else fail(`${label}: ours ${JSON.stringify(ours)}, reference ${JSON.stringify(ref)}`);
    return;
  }
  if (ours.length !== ref.length) return fail(`${label}: length ${ours.length} vs ${ref.length}`);
  ours.forEach((v, i) => num(`${label}[${i}]`, v, ref[i]));
}

function same(label, ours, ref) {
  const a = JSON.stringify(ours), b = JSON.stringify(ref);
  if (a === b) pass();
  else fail(`${label}:\n          ours      ${a}\n          reference ${b}`);
}

function tableCells(t) {
  return [...t.head, ...t.rows.flatMap((r) => [r.label, ...r.values])];
}

/** The value cells of a reference table read as header then rows of `width` cells, skipping each row's label. */
function valueCells(cells, width, valuesPerRow) {
  const out = [];
  for (let i = width; i < cells.length; i += width) out.push(...cells.slice(i + 1, i + 1 + valuesPerRow));
  return out;
}

/**
 * The free cash flow table as the reference printed it. Version 3's table adds
 * a terminal column, the valuation date row and discount periods, so the
 * reference's own layout is rebuilt here from the same result fields.
 */
function legacyFcfCells(r) {
  const m = (arr) => arr.map(format.fmtMillions);
  const rows = [
    ['Revenue', m(r.rows.map((x) => x.rev))],
    ['EBITDA', m(r.rows.map((x) => x.ebitda))],
    ['Less depreciation and amortisation', m(r.rows.map((x) => -x.da))],
    ['EBIT', m(r.rows.map((x) => x.ebit))],
    [format.taxRowLabel(r), m(r.rows.map((x) => -x.tax))],
    ['Add back depreciation and amortisation', m(r.rows.map((x) => x.da))],
    ['Less capital expenditure', m(r.rows.map((x) => -x.capex))],
    ['Less increase in working capital', m(r.rows.map((x) => -x.dnwc))],
    ['Free cash flow to firm', m(r.rows.map((x) => x.fcf))],
    ['Discount factor', r.base.dfs.map((v) => v.toFixed(3))],
    ['Present value', m(r.rows.map((x, i) => x.fcf * r.base.dfs[i]))],
  ];
  return [format.currencyMillions(r.currency), ...r.years.forecast.map((y) => `FY${y} F`), ...rows.flatMap(([label, values]) => [label, ...values])];
}

/**
 * The one known display difference, and it is a fix. Tax on a loss-making year
 * is `Math.max(0, ebit) * t` negated, which is -0, and the reference printed
 * that as "-0.0". Ours prints "0.0". The number underneath is identical and is
 * compared separately above; only the reference's text is normalised here.
 */
function normaliseNegativeZero(cells) {
  return cells.map((c) => (c === '-0.0' || c === '(0.0)' ? '0.0' : c));
}

/* ------------------------------------------------------------------------ */

async function runCase(page, c) {
  console.log(`\n${c.name}`);
  await page.send('Page.navigate', { url: pathToFileURL(REFERENCE).href });
  await waitFor(() => page.evaluate('document.readyState === "complete" && typeof calc !== "undefined"'));
  await page.evaluate(`(() => { ${c.ref} })()`);

  const refIn = await page.evaluate(READ_INPUTS);
  let s = c.ours();

  // 1. Prefilled and typed inputs.
  for (const k of Object.keys(refIn.wacc)) {
    const a = parseFloat(s.wacc[k]), b = parseFloat(refIn.wacc[k]);
    if ((Number.isNaN(a) && Number.isNaN(b)) || close(a, b)) pass();
    else fail(`input ${k}: ours "${s.wacc[k]}", reference "${refIn.wacc[k]}"`);
  }
  num('input growth', parseFloat(s.growth), parseFloat(refIn.growth));
  for (const k of Object.keys(refIn.fin)) {
    refIn.fin[k].forEach((v, i) => {
      const a = parseFloat(s.fin[k][i]), b = parseFloat(v);
      if ((Number.isNaN(a) && Number.isNaN(b)) || close(a, b)) pass();
      else fail(`financials ${k}[${i}]: ours "${s.fin[k][i]}", reference "${v}"`);
    });
  }
  const currency = engine.currencyFor(s.country);
  same('currency code', currency.code, refIn.currency);
  same('amount suffix', `${currency.code} m`, refIn.curm);
  if (c.expectCurrency) same('expected currency', currency.code, c.expectCurrency);
  const ourDeals = [{ value: '', label: 'Select a range' }, ...engine.dealBandOptions(currency), { value: 'unsure', label: 'Not decided yet' }];
  same('deal size bands', ourDeals, refIn.deals);

  // CHANGED 1: the exit multiple. The reference keeps the preset median; ours
  // follows two or more peers. Assert the change, then give both sides the
  // reference's figure so everything downstream is a like-for-like comparison.
  const oursXm = parseFloat(s.exitMultiple), refXm = parseFloat(refIn.exitMultiple);
  if (c.expectPeerExitMultiple !== undefined) {
    num('CHANGED exit multiple follows the peer median', oursXm, c.expectPeerExitMultiple);
    if (close(refXm, oursXm)) fail('exit multiple: expected ours to differ from the reference preset median');
    else pass();
  } else {
    num('exit multiple default (no peer override)', oursXm, refXm);
  }
  s = { ...s, exitMultiple: refIn.exitMultiple, xmTouched: true };

  // CHANGED 3: the private company discount. Ours defaults to 20% once peers
  // are in use, and applies to the exit multiple as well as the comparables.
  // Assert the default, then give the reference the same discount and the
  // discounted exit multiple, which is exactly what our DCF uses.
  const oursDisc = parseFloat(s.privateDiscount) || 0;
  if (c.expectAutoDiscount !== undefined) num('CHANGED discount defaults with peers', oursDisc, c.expectAutoDiscount);
  const appliedXm = oursDisc ? parseFloat(refIn.exitMultiple) * (1 - oursDisc / 100) : parseFloat(refIn.exitMultiple);
  await page.evaluate(`(() => { $("xm").value = ${JSON.stringify(String(appliedXm))}; $("dlom").value = ${JSON.stringify(String(oursDisc))}; })()`);

  // 2. Run both.
  const refOut = await page.evaluate(RUN_AND_READ);
  if (refOut.error) return fail(`reference run failed: ${refOut.error}`);
  const ref = revive(refOut.calc);

  // The reference's method, with every version 3 input neutral.
  const outcome = engine.runValuation({ ...state.toInputs(s, null), gccOwnership: 0 }, engine.REFERENCE_METHOD);
  if (!outcome.ok) return fail(`engine refused the case at step ${outcome.step}: ${JSON.stringify(outcome.errors)}`);
  const r = outcome.result;

  for (const k of ['bl', 'ke', 'kd', 'kdt', 'we', 'wd', 'waccUsd', 'wacc', 't']) num(`wacc.${k}`, r.wacc[k], ref.w[k]);
  num('growth', r.growth, ref.g);
  num('net debt', r.netDebt, ref.nd);
  num('private discount', r.privateDiscount, ref.disc);
  same('rows count', r.rows.length, ref.rows.length);
  r.rows.forEach((row, i) => {
    for (const k of ['rev', 'ebitda', 'da', 'ebit', 'tax', 'capex', 'dnwc', 'fcf']) num(`rows[${i}].${k}`, row[k], ref.rows[i][k]);
  });
  for (const k of ['pv', 'dfN', 'tvG', 'tvX', 'evG', 'evX']) num(`base.${k}`, r.base[k], ref.base[k]);
  nums('base.dfs', r.base.dfs, ref.base.dfs);
  for (const k of ['loG', 'hiG', 'loX', 'hiX']) num(k, r[k], ref[k]);
  nums('comps ebitda multiples', r.comps.ebitda, ref.cm.ebitda);
  nums('comps revenue multiples', r.comps.revenue, ref.cm.revenue);
  nums('comps EV from EBITDA', r.compsEbitda, ref.cE);
  nums('comps EV from revenue', r.compsRevenue, ref.cR);
  nums('DCF range', r.dcfRange, ref.dcfRange);
  nums('comps range', r.compRange, ref.compRange);
  nums('blended EV', r.ev, ref.ev);
  nums('equity', r.equity, ref.ev.map((v) => v - ref.nd));

  // 3. Rendered text.
  const h = format.headline(r);
  const t = refOut.text;
  same('headline equity range', h.equityRange, t.rRange);
  same('headline EV range', h.evRange, t.rEv);
  same('valuation date', h.valuationDate, t.rFy);
  same('KPI WACC', h.wacc, t.kW);
  same('KPI terminal value share', h.tvShare, t.kTv);
  same('KPI implied terminal multiple (perpetuity method)', h.impliedExitMultiple, t.kIm);
  same('KPI EV / LTM EBITDA', h.ltmMultiple, t.kLtm);
  // The reference's five rows. Version 2 adds a scenarios row it never had.
  const rows = format.footballFieldRows(r).filter((x) => format.REFERENCE_FOOTBALL_KEYS.includes(x.key));
  same('football field values', rows.map((x) => (x.range ? `${format.fmtMillions(x.range[0])} to ${format.fmtMillions(x.range[2])}` : '')), t.ffVals);
  same('football field scale', format.footballFieldScale(rows).ticks, t.ffScale);
  same('FCF table', legacyFcfCells(r), normaliseNegativeZero(t.fcf));
  // Sensitivity: every value cell as printed; the axis labels as numbers, since
  // version 3 prints WACC and growth to two decimals where the reference used one.
  const sens = format.sensitivityTable(r);
  same('sensitivity values', sens.rows.flatMap((row) => row.values), valueCells(normaliseNegativeZero(t.sens), 6, 5));
  const refSens = normaliseNegativeZero(t.sens);
  sens.rows.forEach((row, i) => {
    const ours = parseFloat(row.label), ref = parseFloat(refSens[6 + i * 6]);
    if (Math.abs(ours - ref) <= 0.05 + 1e-9) pass();
    else fail(`sensitivity WACC label ${i}: ours ${row.label}, reference ${refSens[6 + i * 6]}`);
  });
  if (/^\d+\.\d{2}%$/.test(sens.rows[2].label)) pass();
  else fail(`CHANGED sensitivity WACC labels to two decimals: ${sens.rows[2].label}`);
  // Bridge: values only. Version 3 labels the middle column "Base case".
  const bridge = format.bridgeTable(r);
  same('bridge table values', bridge.rows.flatMap((row) => row.values), valueCells(normaliseNegativeZero(t.bridge), 4, 3));
  same('CHANGED bridge column is the base case', bridge.head[2], 'Base case');

  // CHANGED 2: negative equity. The reference floored the low and high only.
  same('equity floor', r.equityFloor, c.expectFloor);
  if (c.expectFloor === 'none') {
    same('headline midpoint', h.midpoint, t.rMid);
    if (h.floorNote === null) pass();
    else fail('floor note shown when equity is positive');
  } else {
    same('CHANGED midpoint floored at zero', r.equityDisplay, [0, 0, 0].map((z, i) => Math.max(z, r.equity[i])));
    if (r.equity[1] < 0 && h.midpoint === format.fmtBig(0, r.currency)) pass();
    else fail(`CHANGED midpoint: expected zero, got ${h.midpoint}`);
    if (t.rMid.startsWith('negative')) pass();
    else fail(`reference midpoint was expected to be negative, got ${t.rMid}`);
    if (h.floorNote) pass();
    else fail('no note explaining that net debt exceeds enterprise value');
  }

  console.log(`  equity ${h.equityRange}, midpoint ${h.midpoint}, WACC ${h.wacc}`);
}

async function main() {
  // Registry and visibility rules live in verify-tools-visibility.mjs. This
  // verifier is only about the engine agreeing with the reference.

  const { page, close: closeChrome } = await launchChrome();
  try {
    for (const c of CASES) await runCase(page, c);
  } finally {
    closeChrome();
  }

  console.log(`\n${checks - failures} of ${checks} checks passed.`);
  if (failures) {
    console.log(`${failures} FAILED`);
    process.exitCode = 1;
  } else {
    console.log('COMPLETE');
  }
}

main().catch((err) => {
  console.error('verify-valuation-engine failed:', err);
  process.exitCode = 1;
});
