// scripts/render-valuation-qa.mjs
//
// The valuation report QA set: renders the PDF report for every test case,
// rasterises every page to a PNG for inspection, and prints the page count and
// the headline figures per case. No database is written and no email is sent.
// The logo and partner card are read from the CMS read only when .env.local has
// Supabase credentials, as render-valuation-examples does; BRANDING=none skips it.
//
//   npm run render-valuation-qa -- <output directory>
//
// CASES (valuation date fixed at 2026-09-16 unless stated)
//   01 regression, GCC ownership 0%, no stub period, ERP 4.23% (the old report's inputs)
//   02 regression at its example values and current market data (100% GCC
//      ownership, no cash entered, so the zakat base is working capital alone)
//   03 healthy profitable business, long company name and long peer names, 60% GCC
//      ownership with cash entered
//   04 negative and weak EBITDA: EV / Revenue, loss carry-forward, negative_ebitda
//   05 high debt, net debt above half of enterprise value, 100% GCC, no cash
//   06 very small values (thousands)
//   07 very large values (billions), 0% GCC ownership (corporate tax only)
//   08 non-Saudi country (UAE): no zakat, corporate tax applied
//   09 raising equity with an amount to raise: pre-money and post-money, cash entered
//   10 Pakistan with every version 2 feature in use and a long description
//
// Each page is drawn by pdf.js inside headless Chrome from a local static server,
// so what is inspected is what a PDF viewer draws.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { REPORT_META, VALUATION_DATE, fullFeatureCase, minimalCase, withFin } from './lib/valuationCases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, '.valuation-qa'));
fs.mkdirSync(out, { recursive: true });

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const state = await jiti.import(path.join(root, 'src/components/tools/valuation/state.ts'));
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const pdf = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));

const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
let branding = null;
if (process.env.BRANDING !== 'none' && process.env.SUPABASE_URL) {
  const brand = await jiti.import(path.join(root, 'src/lib/tools/brand/fetch.ts'));
  branding = await brand.fetchReportBranding();
}

/* ------------------------------------------------------------------------ */
/* Cases                                                                     */
/* ------------------------------------------------------------------------ */

const LONG_NAME = 'Al Mashreq Integrated Healthcare Support and Facilities Management Services Holding Company Limited';

function saudiBase(industry, fin, extra = {}) {
  let s = state.initialState();
  s = state.applyIndustryDefaults({ ...s, industry });
  s = state.applyCountryDefaults({ ...s, country: 'Saudi Arabia', financialYear: '2025', ...extra });
  s = withFin(s, fin);
  return state.onEnterWacc(state.resetWacc(s));
}

const CASES = [
  {
    id: '01-regression-gcc0-nostub',
    meta: { company: 'FMP', industry: 'Healthcare Support Services', country: 'Saudi Arabia', purpose: 'sale' },
    // The old report's inputs, including its January 2026 ERP of 4.23%.
    inputs: () => {
      const i = state.toInputs(minimalCase(state), null);
      return { ...i, gccOwnership: 0, wacc: { ...i.wacc, erp: 4.23 } };
    },
  },
  {
    id: '02-regression-defaults',
    meta: { company: 'FMP', industry: 'Healthcare Support Services', country: 'Saudi Arabia', purpose: 'sale' },
    inputs: () => state.toInputs(minimalCase(state), VALUATION_DATE),
  },
  {
    id: '03-healthy-long-names',
    meta: { company: LONG_NAME, industry: 'Education', country: 'Saudi Arabia', purpose: 'sale' },
    inputs: () => {
      let s = saudiBase('Education', {
        rev: [420, 468, 522, 580, 640, 700, 760, 815],
        ebitda: [96, 110, 127, 142, 158, 174, 190, 204],
        da: [18, 20, 22, 24, 26, 28, 30, 32],
        capex: [24, 26, 28, 30, 32, 34, 36, 38],
        nwc: [40, 44, 48, 53, 58, 63, 68, 73],
      }, { debt: '105', cash: '45', gccOwnership: '60' });
      s = {
        ...s,
        companyName: LONG_NAME,
        peers: [
          state.newPeer('Saudi National Education and Training Services Holding Company', '12.4', '2.6'),
          state.newPeer('Gulf Integrated Schools and Higher Learning Group International', '10.9', '2.1'),
          state.newPeer('Middle East Academic Campuses and Student Housing Development Company', '11.6', '2.3'),
          state.newPeer('Riyadh Private Schools Operator', '9.8', '1.9'),
        ],
        investedCapital: '520',
        cash: '45',
        norm: { oneOff: '4', ownerCosts: '3', carryOwnerCosts: true },
      };
      return state.toInputs(state.syncPeerDefaults(s), VALUATION_DATE);
    },
  },
  {
    id: '04-negative-ebitda',
    meta: { company: 'Turnaround Contracting Co', industry: 'Engineering/Construction', country: 'Saudi Arabia', purpose: 'internal' },
    inputs: () => {
      const s = saudiBase('Engineering/Construction', {
        rev: [300, 280, 250, 262, 280, 300, 322, 345],
        ebitda: [6, -8, -14, -4, 10, 22, 30, 36],
        da: [10, 10, 9, 9, 9, 10, 10, 11],
        capex: [8, 6, 5, 5, 6, 7, 8, 9],
        nwc: [60, 58, 55, 56, 58, 60, 62, 64],
      }, { debt: '40', cash: '0' });
      return state.toInputs({ ...s, gccOwnership: '0' }, VALUATION_DATE);
    },
  },
  {
    id: '05-high-debt',
    meta: { company: 'Leveraged Logistics Co', industry: 'Transportation', country: 'Saudi Arabia', purpose: 'debt' },
    inputs: () => {
      const s = saudiBase('Transportation', {
        rev: [500, 540, 580, 620, 660, 700, 740, 780],
        ebitda: [70, 76, 82, 88, 94, 100, 106, 112],
        da: [30, 32, 34, 36, 38, 40, 42, 44],
        capex: [36, 38, 40, 42, 44, 46, 48, 50],
        nwc: [50, 54, 58, 62, 66, 70, 74, 78],
      }, { debt: '420', cash: '0', gccOwnership: '100' });
      return state.toInputs(s, VALUATION_DATE);
    },
  },
  {
    id: '06-very-small',
    meta: { company: 'Small Cafe', industry: 'Restaurant/Dining', country: 'Saudi Arabia', purpose: 'sale' },
    inputs: () => {
      const s = saudiBase('Restaurant/Dining', {
        rev: [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5],
        ebitda: [0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.24],
        da: [0.02, 0.02, 0.03, 0.03, 0.03, 0.03, 0.04, 0.04],
        capex: [0.03, 0.03, 0.03, 0.04, 0.04, 0.04, 0.05, 0.05],
        nwc: [0.05, 0.05, 0.06, 0.06, 0.07, 0.07, 0.08, 0.08],
      }, { debt: '0.02', cash: '0', gccOwnership: '100' });
      return state.toInputs(s, VALUATION_DATE);
    },
  },
  {
    id: '07-very-large',
    meta: { company: 'National Power Holding', industry: 'Power', country: 'Saudi Arabia', purpose: 'acquire' },
    inputs: () => {
      const s = saudiBase('Power', {
        rev: [38000, 41000, 44000, 47000, 50000, 53000, 56000, 59000],
        ebitda: [11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000],
        da: [3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400],
        capex: [4200, 4400, 4600, 4800, 5000, 5200, 5400, 5600],
        nwc: [2000, 2150, 2300, 2450, 2600, 2750, 2900, 3050],
      }, { debt: '52000', cash: '0', gccOwnership: '0' });
      return state.toInputs(s, VALUATION_DATE);
    },
  },
  {
    id: '08-non-saudi-uae',
    meta: { company: 'Dubai Software LLC', industry: 'Software (System & Application)', country: 'United Arab Emirates', purpose: 'sale' },
    inputs: () => {
      let s = state.initialState();
      s = state.applyIndustryDefaults({ ...s, industry: 'Software (System & Application)' });
      s = state.applyCountryDefaults({ ...s, country: 'United Arab Emirates', financialYear: '2025', debt: '0', cash: '15' });
      s = withFin(s, {
        rev: [60, 75, 92, 112, 134, 158, 182, 205],
        ebitda: [9, 13, 18, 24, 31, 38, 45, 52],
        da: [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5],
        capex: [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5],
        nwc: [6, 7.5, 9, 11, 13, 15, 17, 19],
      });
      return state.toInputs(state.onEnterWacc(state.resetWacc(s)), VALUATION_DATE);
    },
  },
  {
    id: '09-raising-equity',
    meta: { company: 'Growth Clinics Co', industry: 'Hospitals/Healthcare Facilities', country: 'Saudi Arabia', purpose: 'raise' },
    inputs: () => {
      const s = saudiBase('Hospitals/Healthcare Facilities', {
        rev: [150, 175, 205, 240, 280, 325, 370, 415],
        ebitda: [24, 29, 35, 42, 50, 59, 68, 77],
        da: [7, 8, 9, 11, 13, 15, 17, 19],
        capex: [15, 18, 22, 26, 30, 32, 34, 36],
        nwc: [15, 17, 20, 24, 28, 32, 36, 40],
      }, { debt: '55', cash: '30', gccOwnership: '100', investedCapital: '180' });
      return { ...state.toInputs(s, VALUATION_DATE), purpose: 'raise', raiseAmount: 120 };
    },
  },
  {
    id: '10-pakistan-full',
    meta: { company: 'Example Foods Pakistan', industry: 'Food Processing', country: 'Pakistan', purpose: 'sale' },
    inputs: () => state.toInputs(fullFeatureCase(state), VALUATION_DATE),
    description: true,
  },
];

/* ------------------------------------------------------------------------ */
/* Rasterising with pdf.js in headless Chrome                                */
/* ------------------------------------------------------------------------ */

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((c) => fs.existsSync(c));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* keep waiting */
    }
    await wait(250);
  }
  throw new Error('timed out');
}

function serve() {
  const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.pdf': 'application/pdf', '.html': 'text/html' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url.startsWith('/out/') ? path.join(out, url.slice(5)) : path.join(root, url);
    if (url === '/raster.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><html><body></body></html>');
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function chrome() {
  const port = 9377;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-qa-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok);
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result?.result?.value;
  };
  return { send, evaluate, close: () => (ws.close(), proc.kill()) };
}

/* ------------------------------------------------------------------------ */

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = CHROME && process.env.RASTER !== 'none' ? await chrome() : null;
if (browser) {
  await browser.send('Page.navigate', { url: `${base}/raster.html` });
  await waitFor(() => browser.evaluate('document.readyState === "complete"'));
}

const DESCRIPTION =
  'Example Foods Pakistan processes and packages dairy and ready meals for retail chains across Punjab and Sindh, from two plants near Lahore and Karachi, supplying more than four hundred stores and a growing food service channel.\n\nThe owners are preparing to sell a minority stake to fund a third plant and a cold chain for export to the GCC, and want an independent view of value before speaking to investors and lenders about the expansion and its timing.';

const summary = [];
for (const c of CASES) {
  const inputs = c.inputs();
  const outcome = engine.runValuation(inputs);
  if (!outcome.ok) {
    console.log(`${c.id}: refused at step ${outcome.step}: ${JSON.stringify(outcome.errors)}`);
    summary.push({ id: c.id, error: outcome.errors });
    continue;
  }
  const r = outcome.result;
  const buf = await pdf.renderValuationReport(r, {
    ...REPORT_META,
    ...c.meta,
    branding,
    description: c.description ? DESCRIPTION : null,
  });
  const dir = path.join(out, c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.pdf'), buf);
  let pages = null;
  if (browser) {
    pages = await browser.evaluate(`(async () => {
      const pdfjs = await import('${base}/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '${base}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
      const doc = await pdfjs.getDocument('${base}/out/${c.id}/report.pdf').promise;
      const images = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        images.push(canvas.toDataURL('image/png'));
      }
      return images;
    })()`);
    pages.forEach((png, i) => fs.writeFileSync(path.join(dir, `page-${String(i + 1).padStart(2, '0')}.png`), Buffer.from(png.split(',')[1], 'base64')));
  }
  const h = format.headline(r);
  const row = {
    id: c.id,
    pages: pages?.length ?? null,
    equity: h.equityRange,
    base: h.midpoint,
    wacc: h.wacc,
    tvShare: h.tvShare,
    ltmMultiple: h.ltmMultiple,
    implied: format.fmtMultiple(r.terminal.impliedMultiple),
    terminalFcf: format.fmtMillions(r.terminal.fcf),
    warnings: r.checks.filter((x) => x.status === 'warning').map((x) => x.id).join(', '),
    recommendations: r.recommendations.map((x) => x.id).join(', '),
  };
  summary.push(row);
  console.log(`${c.id}: ${row.pages ?? '?'} pages; equity ${row.equity}, base ${row.base}; WACC ${row.wacc}; TV share ${row.tvShare}; ${row.ltmMultiple} LTM; implied ${row.implied}; terminal FCF ${row.terminalFcf}; warnings: ${row.warnings || 'none'}`);
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
browser?.close();
server.close();
