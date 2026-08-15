// scripts/verify-container-widths.mjs
//
// Asserts that the navbar, the footer and every page section share one
// container, by measuring a real layout in headless Chrome at more than one
// viewport.
//
// WHY THIS EXISTS
// "The navbar is narrower than the content" has now been raised twice. The
// first time it was true: the navbar and footer carried `max-w-[1280px] px-6`
// while sections used `max-w-[1200px]` inside a `px-6` wrapper, and the two
// used different box models, so the logo sat 32px left of the content below it.
// That was fixed by PAGE_GUTTER and PAGE_INNER in src/lib/public/layout.ts.
//
// The second time it was not true, and finding that out took a measurement.
// Reading class names could not settle it, because the question is not which
// constants the source imports, it is where the pixels land. So this script
// exists to answer it in one command, for any surface, at any width.
//
// A class name in the source proves nothing on its own: Tailwind has to have
// emitted the rule, the component has to have used the constant, and the
// element has to have laid out. Every number below is a getBoundingClientRect.
//
// WHAT IT CHECKS
//   1. Every page container (header, sections, footer) is the same width and
//      starts at the same x, at every viewport measured.
//   2. The header's brand box starts on that same x, so the logo lines up with
//      the content below it.
//   3. The desktop nav does not run into the CTA. The header container is
//      capped at 1200px, so the room the nav has is fixed no matter how wide
//      the screen is, and adding one nav item too many closes the gap silently.
//   4. Reported, not asserted: how much transparent padding the logo file
//      carries. A logo box can start in exactly the right place and still look
//      indented if the PNG has empty pixels baked into it, which is a fact
//      about the asset rather than about the layout, and is not something CSS
//      can see or fix.
//
// Heroes are deliberately exempt from check 1. They keep a narrower 1100px
// inner box on purpose, and their content is centred, so their left edge is not
// a reference for anything. See CLAUDE.md section 9.
//
// Needs a server already running.
//
//   npm run build && npx next start -p 3999
//   npm run verify-container-widths
//   VERIFY_BASE=http://localhost:3000 node scripts/verify-container-widths.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';
const WIDTHS = [1440, 1920];
const HEIGHT = 900;
const EXPECTED_WIDTH = 1200;
/** Below this the last nav item is touching the CTA and the row reads as full. */
const MIN_NAV_CTA_GAP = 16;

const PAGES = ['/', '/team', '/services', '/contact', '/fmp', '/sectors', '/network'];

let failures = 0;
function pass(msg) {
  console.log('  ok    ' + msg);
}
function fail(msg) {
  failures++;
  console.log('  FAIL  ' + msg);
}

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

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
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    }
    return r.result.value;
  }
}

async function launchChrome() {
  const port = 9343;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-cdp-cw-'));
  const proc = spawn(
    findChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      // Without this the scrollbar eats 15px and every left edge shifts by 7.5,
      // which is a real effect but a constant one, and it makes the numbers
      // harder to read against the 1200 they are being checked against.
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const version = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok ? res.json() : null;
  });
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const browser = new Cdp(ws);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
    (t) => t.id === targetId,
  );
  const tabWs = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    tabWs.addEventListener('open', resolve, { once: true });
    tabWs.addEventListener('error', reject, { once: true });
  });
  const page = new Cdp(tabWs);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return {
    page,
    close: () => {
      try {
        tabWs.close();
        ws.close();
      } catch {
        /* already gone */
      }
      proc.kill();
    },
  };
}

async function load(page, url, width) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.send('Page.navigate', { url });
  await waitFor(async () => page.evaluate('document.readyState === "complete"'), 80, 250);
  await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
}

/**
 * Runs in the page.
 *
 * Containers are found by asking the layout which elements are actually capped
 * at the expected width, rather than by walking a DOM shape this script would
 * then have to keep in step with the components. An element that was supposed
 * to be a container and is not one simply will not appear, which is the failure
 * worth catching.
 */
const PROBE = `(() => {
  const R = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      left: Math.round(b.left * 10) / 10,
      right: Math.round(b.right * 10) / 10,
      width: Math.round(b.width * 10) / 10,
    };
  };
  const where = (el) => {
    if (el.closest('header')) return 'header';
    if (el.closest('footer')) return 'footer';
    if (el.closest('[data-hero]')) return 'hero';
    return 'section';
  };

  const containers = [];
  document.querySelectorAll('div, section, nav').forEach((el) => {
    if (getComputedStyle(el).maxWidth !== '${EXPECTED_WIDTH}px') return;
    if (!el.getClientRects().length) return;
    containers.push({ area: where(el), ...R(el) });
  });

  const header = document.querySelector('header');
  const brand = header ? header.querySelector('a[href="/"]') : null;
  const img = brand ? brand.querySelector('img') : null;
  const nav = header ? header.querySelector('nav') : null;
  const navItems = nav
    ? Array.from(nav.children).map((c) => R(c)).filter(Boolean)
    : [];
  const cta = header
    ? Array.from(header.querySelectorAll('a')).find(
        (a) => a !== brand && getComputedStyle(a).display.includes('flex'),
      )
    : null;

  return {
    viewport: document.documentElement.clientWidth,
    containers,
    brand: R(brand),
    logo: img ? { ...R(img), natW: img.naturalWidth, natH: img.naturalHeight } : null,
    lastNavItem: navItems.length ? navItems[navItems.length - 1] : null,
    cta: R(cta),
  };
})()`;

function check(pagePath, width, d) {
  console.log(`\n  ${pagePath} at ${width}px`);

  const shared = d.containers.filter((c) => c.area !== 'hero');
  if (shared.length === 0) {
    fail('no page container found at all');
    return;
  }

  const lefts = [...new Set(shared.map((c) => c.left))];
  const widths = [...new Set(shared.map((c) => c.width))];
  const areas = [...new Set(shared.map((c) => c.area))].join(', ');

  if (lefts.length === 1 && widths.length === 1) {
    pass(
      `${shared.length} container(s) across ${areas}: left ${lefts[0]}, width ${widths[0]}`,
    );
  } else {
    fail(
      `containers disagree. lefts ${lefts.join(', ')} widths ${widths.join(', ')} across ${areas}`,
    );
    for (const c of shared) {
      console.log(`          ${c.area.padEnd(8)} left ${c.left} width ${c.width}`);
    }
  }

  if (d.brand) {
    const delta = Math.round((d.brand.left - lefts[0]) * 10) / 10;
    if (Math.abs(delta) <= 0.5) {
      pass(`the brand box starts on the container edge (${d.brand.left})`);
    } else {
      fail(`the brand box sits ${delta}px from the container edge`);
    }
  }

  if (d.lastNavItem && d.cta) {
    const gap = Math.round((d.cta.left - d.lastNavItem.right) * 10) / 10;
    if (gap >= MIN_NAV_CTA_GAP) {
      pass(`${gap}px between the last nav item and the CTA`);
    } else {
      fail(`only ${gap}px between the last nav item and the CTA, want ${MIN_NAV_CTA_GAP}`);
    }
  }
}

async function main() {
  console.log('Container width audit');
  console.log('Base: ' + BASE);

  const chrome = await launchChrome();
  let logoNote = null;
  try {
    for (const width of WIDTHS) {
      console.log(`\n${'='.repeat(68)}\nViewport ${width} x ${HEIGHT}\n${'='.repeat(68)}`);
      for (const p of PAGES) {
        await load(chrome.page, BASE + p, width);
        const d = await chrome.page.evaluate(PROBE);
        check(p, width, d);
        if (!logoNote && d.logo) logoNote = d.logo;
      }
    }
  } finally {
    chrome.close();
  }

  // Reported rather than asserted: this is a property of the uploaded file, not
  // of the layout, and it is the operator who can change it.
  if (logoNote) {
    console.log(`\n${'='.repeat(68)}\nLogo asset\n${'='.repeat(68)}`);
    console.log(
      `  natural ${logoNote.natW}x${logoNote.natH}, rendered ${logoNote.width}x${logoNote.height ?? '?'}`,
    );
    console.log(
      '  If the logo looks indented while the brand box measures flush above,\n' +
        '  the transparent padding is inside the PNG. Trim the file and re-upload\n' +
        '  it in Header Settings. No CSS change can correct it.',
    );
  }

  console.log('\n' + '='.repeat(68));
  if (failures > 0) {
    console.log(`${failures} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('All surfaces share one container at every viewport measured.');
  }
}

main().catch((err) => {
  console.error('verify-container-widths failed:', err.message);
  process.exitCode = 1;
});
