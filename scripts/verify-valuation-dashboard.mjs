// scripts/verify-valuation-dashboard.mjs
//
// Drives the Business Valuation tool end to end in headless Chrome, through the
// inputs, the gate and the whole results dashboard, at 1440 and 390 wide, with
// no request reaching a server that could write.
//
// HOW NOTHING IS WRITTEN
// Every request to /api/ is intercepted with the DevTools Fetch domain before it
// leaves the browser. The three the tool makes are answered here from the same
// code the routes run:
//   POST /api/tools/business-valuation/lead          engine recomputation, fake token
//   POST /api/tools/business-valuation/lead/version  engine recomputation
//   POST /api/tools/business-valuation/pdf           the real PDF renderer
// Any other /api/ request is refused with a 403 and fails the run. The page
// itself is served by a local build (`next start`), which reads CMS content from
// the database but is sent nothing to write. A production base URL is refused.
//
//   npx next start -p 3107
//   VERIFY_BASE=http://127.0.0.1:3107 npm run verify-valuation-dashboard -- [screenshot dir]
//
// WHAT IT CHECKS, AT EACH WIDTH
//   The Saudi / GCC ownership field is required (an error when blank) and has
//   no default; the net debt label carries its date; the gate shows the raise
//   amount only for raising equity; the lead request carries the purpose and
//   the raise; the headline equals the engine's figures for the submitted
//   inputs; every tab renders its v3 content (checks, value by method, the
//   bridge with net debt and the cash flow since, pre-money and post-money,
//   FCFF, sensitivity, scenarios, assumptions with tax and zakat, terminal ROIC
//   and the financial year end); a slider explores; Email me this version and
//   Download PDF go through their intercepted routes and report success; no
//   uncaught page error; no horizontal scroll; no request escaped.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

import { refuseWritesAgainstProduction } from './lib/productionGuard.mjs';

const BASE = process.env.VERIFY_BASE ?? 'http://127.0.0.1:3107';
refuseWritesAgainstProduction(BASE, 'verify-valuation-dashboard');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const jiti = createJiti(import.meta.url, { alias: { '@': path.join(root, 'src') }, jsx: { runtime: 'automatic' } });
const engine = await jiti.import(path.join(root, 'src/lib/tools/valuation/engine.ts'));
const format = await jiti.import(path.join(root, 'src/lib/tools/valuation/format.ts'));
const serialize = await jiti.import(path.join(root, 'src/lib/tools/valuation/serialize.ts'));
const leads = await jiti.import(path.join(root, 'src/lib/tools/leads/valuation.ts'));
const pdf = await jiti.import(path.join(root, 'src/lib/tools/pdf/ValuationReport.tsx'));

// The founder portrait's own proportions, read from the file the profile uses,
// so the portrait checks compare against the source rather than a constant.
// Read only; the Supabase URL and key come from .env.local when not set.
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const partnerCard = await (await jiti.import(path.join(root, 'src/lib/tools/brand/fetch.ts'))).fetchPartnerCard();
const SOURCE_PORTRAIT_RATIO = await (async () => {
  if (!partnerCard?.photoUrl) return NaN;
  const sharp = (await import('sharp')).default;
  const meta = await sharp(Buffer.from(await (await fetch(partnerCard.photoUrl)).arrayBuffer())).metadata();
  return meta.width / meta.height;
})();

let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, tries = 80, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* keep waiting */
    }
    await wait(delay);
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Chrome                                                                    */
/* ------------------------------------------------------------------------ */

const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .filter(Boolean)
  .find((c) => fs.existsSync(c));
if (!CHROME) throw new Error('Chrome not found. Set CHROME_PATH.');

async function openPage() {
  // A fresh port for each browser: a closing Chrome can still hold the previous one.
  const port = 9393 + (openPage.launches = (openPage.launches ?? 0) + 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-dash-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  const tabs = await waitFor(async () => {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    return t.find((x) => x.type === 'page') ? t : null;
  });
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) listeners.forEach((l) => l(m));
  });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result?.result?.value;
  };
  // On Windows, kill the whole Chrome process tree: proc.kill() leaves its children holding the port.
  const close = () => { ws.close(); if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill(); };
  return { send, evaluate, on: (fn) => listeners.push(fn), close };
}

/* ------------------------------------------------------------------------ */
/* Interception                                                              */
/* ------------------------------------------------------------------------ */

function fakeServer(page, log) {
  page.on(async (m) => {
    if (m.method === 'Runtime.exceptionThrown') log.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const url = new URL(request.url);
    const body = request.postData ? JSON.parse(request.postData) : null;
    const json = (status, obj) =>
      page.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: status,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(obj)).toString('base64'),
      });
    const now = new Date();
    try {
      if (request.method === 'POST' && url.pathname === '/api/tools/business-valuation/lead') {
        // What the route does: validate, stamp the server fields, recompute.
        const out = await leads.processValuationSubmission(
          body,
          { now, toolSlug: 'business-valuation', toolLive: true, isStaff: false, ipHash: null, userAgent: 'dashboard-verifier', newToken: () => 'verifier-token-' + 'x'.repeat(40) },
          { countSince: async () => 0, insert: async () => ({ ok: true, id: '00000000-0000-4000-8000-000000000099' }) },
        );
        log.lead.push({ body, outcome: out });
        return json(out.status, out.body);
      }
      if (request.method === 'POST' && url.pathname === '/api/tools/business-valuation/lead/version') {
        const recomputed = leads.recomputeInputs(body.inputs, now);
        log.version.push({ body, ok: recomputed.ok });
        if (!recomputed.ok) return json(400, { error: 'Validation failed', issues: recomputed.issues });
        return json(200, { ok: true, result: serialize.serializeResult(recomputed.result) });
      }
      if (request.method === 'POST' && url.pathname === '/api/tools/business-valuation/pdf') {
        const recomputed = leads.recomputeInputs({ ...body.inputs, purpose: 'raise' }, now);
        if (!recomputed.ok) {
          log.pdf.push({ ok: false });
          return json(400, { error: 'Validation failed' });
        }
        const buf = await pdf.renderValuationReport(recomputed.result, {
          preparedFor: 'Dashboard Verifier', company: 'Example Co', industry: body.inputs.industry, country: body.inputs.country, purpose: 'raise',
          generatedAt: now, dataVersion: '2026-09-16', bookingHref: 'https://www.pacemakersglobal.com/api/tools/book?t=verifier&src=pdf',
        });
        log.pdf.push({ ok: true, bytes: buf.length, header: buf.subarray(0, 5).toString() });
        return page.send('Fetch.fulfillRequest', {
          requestId, responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/pdf' }, { name: 'content-disposition', value: 'attachment; filename="report.pdf"' }],
          body: buf.toString('base64'),
        });
      }
      log.refused.push(`${request.method} ${url.pathname}`);
      return json(403, { error: 'Refused by verify-valuation-dashboard' });
    } catch (err) {
      log.errors.push(`interceptor: ${err.message}`);
      return json(500, { error: 'interceptor failed' });
    }
  });
}

/* ------------------------------------------------------------------------ */
/* The walk                                                                  */
/* ------------------------------------------------------------------------ */

const clickButton = (text) =>
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.textContent.trim().toLowerCase().startsWith(${JSON.stringify(text.toLowerCase())})); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`;
const setField = (labelStart, value) =>
  `(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.offsetParent !== null && l.textContent.trim().startsWith(${JSON.stringify(labelStart)}));
    if (!label) return 'no label';
    const input = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector('input,select,textarea');
    if (!input) return 'no input';
    const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`;
const text = () => `document.body.innerText.replace(/\\s+/g, ' ')`;

async function walk(width) {
  const label = `${width}px`;
  console.log(`\n${label}`);
  const page = await openPage();
  const log = { lead: [], version: [], pdf: [], refused: [], errors: [], requests: [] };
  fakeServer(page, log);
  page.on((m) => {
    if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/')) log.requests.push(m.params.request.url);
  });
  await page.send('Runtime.enable');
  await page.send('Network.enable');
  await page.send('Page.enable');
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await page.send('Page.navigate', { url: `${BASE}/tools/business-valuation` });
  check(`${label}: tool page loads`, Boolean(await waitFor(() => page.evaluate(`document.readyState === 'complete' && document.body.innerText.includes('Load an example company')`))));
  const shot = async (name) => {
    if (!shots) return;
    const r = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(shots, `${width}-${name}.png`), Buffer.from(r.result.data, 'base64'));
  };

  // Step 1: the example company, then ownership blank to prove it is required.
  check(`${label}: example loads`, await page.evaluate(clickButton('Load an example company')));
  await wait(500);
  const t1 = await page.evaluate(text());
  check(`${label}: ownership field shown for Saudi Arabia`, t1.includes('Saudi / GCC ownership %'));
  check(`${label}: borrowings and cash fields carry the year end date`, t1.includes('Borrowings at 31 December 2025') && t1.includes('Cash at 31 December 2025') && !t1.includes('(optional)Cash'), t1.match(/Borrowings at[^.]{0,40}/)?.[0]);
  check(`${label}: the example shows net debt as borrowings less cash`, t1.includes('Net debt: 45 SAR m (borrowings less cash)'), t1.match(/Net (debt|cash):[^.]{0,60}/)?.[0]);
  check(`${label}: financial year end disclosed on the form`, t1.includes('assumed to end on 31 December'));
  await page.evaluate(setField('Saudi / GCC ownership', ''));
  await page.evaluate(clickButton('Continue to financials'));
  await wait(400);
  check(`${label}: blank ownership is refused`, (await page.evaluate(text())).includes(engine.GCC_REQUIRED_MESSAGE));
  await page.evaluate(setField('Saudi / GCC ownership', '100'));
  // Cash is required: blank is refused with its own message.
  await page.evaluate(setField('Cash at 31 December 2025', ''));
  await page.evaluate(clickButton('Continue to financials'));
  await wait(400);
  check(`${label}: blank cash is refused`, (await page.evaluate(text())).includes(engine.CASH_REQUIRED_MESSAGE));
  check(`${label}: borrowings entered`, (await page.evaluate(setField('Borrowings at 31 December 2025', '75'))) === true);
  check(`${label}: cash entered`, (await page.evaluate(setField('Cash at 31 December 2025', '30'))) === true);
  await wait(200);
  check(`${label}: net debt updates as the fields are typed`, (await page.evaluate(text())).includes('Net debt: 45 SAR m (borrowings less cash)'));
  check(`${label}: continues once ownership is entered`, await page.evaluate(clickButton('Continue to financials')));
  await wait(400);
  check(`${label}: on financials`, await page.evaluate(clickButton('Continue to cost of capital')));
  await wait(400);
  check(`${label}: on cost of capital`, await page.evaluate(clickButton('Continue to terminal')));
  await wait(400);
  check(`${label}: run valuation`, await page.evaluate(clickButton('Run valuation')));
  check(`${label}: gate shown`, Boolean(await waitFor(() => page.evaluate(`document.body.innerText.includes('Your valuation is ready')`))));

  // The gate.
  const noRaise = await page.evaluate(`document.body.innerText.includes('Amount you plan to raise')`);
  check(`${label}: no raise amount field before raising equity is chosen`, !noRaise);
  for (const [f, v] of [['Full name', 'Dashboard Verifier'], ['Work email', 'verifier@example.com'], ['What is the valuation for?', 'raise']]) {
    check(`${label}: gate field ${f}`, (await page.evaluate(setField(f, v))) === true);
  }
  await wait(300);
  check(`${label}: raise amount field appears for raising equity`, (await page.evaluate(setField('Amount you plan to raise', '120'))) === true);
  const deal = await page.evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === '50-200')); if (!s) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '50-200'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  check(`${label}: deal size chosen`, deal);
  await page.evaluate(`(() => { const c = [...document.querySelectorAll('input[type=checkbox]')][0]; c.click(); return true; })()`);
  await wait(3200); // the server's minimum fill time, so the intercepted route answers as it would for a person
  await shot('gate');
  check(`${label}: submit`, await page.evaluate(clickButton('Show my valuation')));
  check(`${label}: results shown`, Boolean(await waitFor(() => page.evaluate(`document.body.innerText.toLowerCase().includes('email me this version')`))));
  await wait(1500); // count-up animation

  // The lead request and the figures on screen.
  const lead = log.lead[0];
  check(`${label}: one lead request, intercepted`, log.lead.length === 1 && lead?.outcome.kind === 'saved', JSON.stringify(lead?.outcome?.body).slice(0, 200));
  check(`${label}: the request carries the purpose, the raise amount, borrowings, cash and net debt`, lead?.body.inputs.purpose === 'raise' && lead?.body.inputs.raiseAmount === 120 && lead?.body.inputs.gccOwnership === 100 && lead?.body.inputs.debt === 75 && lead?.body.inputs.cash === 30 && lead?.body.inputs.netDebt === 45);
  const result = lead?.outcome.result;
  const h = result ? format.headline(result) : null;
  const tr = await page.evaluate(text());
  check(`${label}: headline equals the engine for the submitted inputs`, Boolean(h && tr.includes(h.equityRange) && tr.includes(`Base case ${h.midpoint}`)), h?.equityRange);
  check(`${label}: equity value as at the valuation date`, Boolean(h && tr.includes(h.asAt)));
  check(`${label}: v3 tile labels`, tr.includes('Implied EV / LTM EBITDA') && tr.includes('Implied terminal multiple (perpetuity method)'));
  await shot('results-summary');

  // Every tab.
  const tabs = [
    ['Summary', ['Checks', 'Value by method', 'Less net debt at 31 December 2025, borrowings less cash', 'Add free cash flow from 31 December 2025 to the valuation date', 'Less after-tax interest on net debt for that period', 'Pre-money and post-money', 'Post-money equity value']],
    ['DCF', ['Free cash flow to firm', 'Terminal', 'Less tax and zakat', 'Discount period, years']],
    ['Comparables', ['Selected comparable companies (2)', 'DCF exit multiple (after discount)', 'Trading multiples, EV / EBITDA']],
    ['Scenarios', ['Probability-weighted', 'Scenarios flex the DCF; comparables use the last actual year.']],
    ['Sensitivity', ['Equity value, perpetuity growth DCF']],
    ['Assumptions', ['Valuation date and net debt', 'Net debt at valuation date', 'Financial years are assumed to end on 31 December.', 'Tax and zakat', 'Implied terminal ROIC', 'Terminal reinvestment rate', '15 September 2026', 'Add cash, year end', 'Borrowings, year end', 'Net debt at year end (borrowings less cash)', 'Zakat base (approximate)', 'After-tax interest since year end', 'uses forecast free cash flow, not actual results', '1 September 2026']],
  ];
  for (const [tab, expects] of tabs) {
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(tab)})); if (!b) return false; b.click(); return true; })()`);
    await wait(400);
    const t = await page.evaluate(text());
    check(`${label}: ${tab} tab opens`, clicked);
    for (const e of expects) check(`${label}: ${tab} tab shows "${e}"`, t.includes(e));
    check(`${label}: ${tab} tab has no NaN or undefined`, !/\bNaN\b|undefined|Infinity/.test(t));
    await shot(`tab-${tab.toLowerCase()}`);
  }

  // Exploration, then the two actions.
  const moved = await page.evaluate(`(() => { const s = document.getElementById('explore-growth'); if (!s) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, String(parseFloat(s.value) + 0.5)); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await wait(500);
  check(`${label}: growth slider explores`, moved && (await page.evaluate(`document.body.innerText.toLowerCase().includes('exploration')`)));
  check(`${label}: Email me this version`, await page.evaluate(clickButton('Email me this version')));
  check(`${label}: version request intercepted and confirmed`, Boolean(await waitFor(() => page.evaluate(`document.body.innerText.includes('This version is on its way')`))) && log.version.length === 1 && log.version[0].ok);
  check(`${label}: Download PDF`, await page.evaluate(clickButton('Download PDF')));
  check(`${label}: PDF request intercepted, rendered and confirmed`, Boolean(await waitFor(() => page.evaluate(`document.body.innerText.includes('Your report has downloaded.')`), 120)) && log.pdf.length === 1 && log.pdf[0].header === '%PDF-');

  // The partner portrait keeps its proportions: a 4:5 frame, the image cropped
  // to cover it, and the file itself not distorted on the way.
  const portrait = await page.evaluate(`(async () => {
    const img = document.querySelector('[aria-labelledby="partner-card-name"] img');
    if (!img) return null;
    img.scrollIntoView({ block: 'center' });
    await img.decode().catch(() => null);
    const b = img.getBoundingClientRect(), f = img.parentElement.getBoundingClientRect();
    return { natural: img.naturalWidth / img.naturalHeight, frame: f.width / f.height, box: b.width / b.height, fit: getComputedStyle(img).objectFit, w: f.width, h: f.height };
  })()`);
  check(`${label}: partner portrait shown`, Boolean(portrait));
  if (portrait) {
    const detail = JSON.stringify(portrait);
    check(`${label}: partner portrait frame is 4:5`, Math.abs(portrait.frame - 0.8) < 0.01, detail);
    check(`${label}: partner portrait fills its frame`, Math.abs(portrait.box - portrait.frame) < 0.01, detail);
    check(`${label}: partner portrait is cropped, never stretched`, portrait.fit === 'cover', detail);
    check(`${label}: partner portrait file keeps the source ratio`, Math.abs(portrait.natural - SOURCE_PORTRAIT_RATIO) < 0.01, `${detail}, source ${SOURCE_PORTRAIT_RATIO}`);
  }

  // Layout and hygiene.
  const overflow = await page.evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
  check(`${label}: no horizontal scroll`, overflow <= 1, `${overflow}px wider than the viewport`);
  check(`${label}: no uncaught page errors`, log.errors.length === 0, log.errors.join(' | '));
  check(`${label}: nothing else under /api/ was requested`, log.refused.length === 0, log.refused.join(', '));
  check(`${label}: every /api/ request was one of the three intercepted`, log.requests.every((u) => /\/api\/tools\/business-valuation\/(lead|lead\/version|pdf)$/.test(new URL(u).pathname)), log.requests.join(', '));
  await shot('results-final');
  page.close();
}

try {
  await walk(1440);
  await walk(1024);
  await walk(390);
} catch (err) {
  failures++;
  console.log('  FAIL  run aborted: ' + err.message);
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
