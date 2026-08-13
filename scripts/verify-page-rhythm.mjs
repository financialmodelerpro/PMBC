// scripts/verify-page-rhythm.mjs
//
// Verifies hero height parity, the section background rhythm, the home page
// sequence, and the audience carousel, by measuring a real layout in headless
// Chrome over the DevTools protocol.
//
// Backgrounds and heights are computed-style and bounding-box facts. A class
// name in the source proves nothing: Tailwind has to have emitted the rule, the
// variant resolver has to have chosen it, and the element has to have laid out.
// Every assertion below reads getComputedStyle or getBoundingClientRect.
//
// What it covers:
//   * every page-leading hero is the same height as the home hero
//   * the band after each hero is cream, then white, then cream, alternating,
//     on every public page, including the two sections that are hardcoded in
//     page files rather than driven by the CMS
//   * navy appears only on the hero
//   * home carries the new sequence: no six-card services grid, "What we do"
//     below the firm track record and linking to /services, no firm
//     credentials block, and the carousel where the audience grid was
//   * the carousel shows exactly one card, advances on its own right to left,
//     goes both ways on the arrows, pauses on hover, and neither advances nor
//     animates when reduced motion is requested
//   * home is materially shorter than the 10.2 screens it was before
//
// Needs a server already running.
//
//   npm run build && npx next start -p 3999
//   node scripts/verify-page-rhythm.mjs
//   VERIFY_BASE=http://localhost:3000 node scripts/verify-page-rhythm.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';
const WIDTH = 1440;
const HEIGHT = 900;

/** Live token values from globals.css, as the browser reports them. */
const CREAM = 'rgb(250, 247, 242)';
const WHITE = 'rgb(255, 255, 255)';
const NAVY = 'rgb(20, 48, 79)';

/**
 * Pages whose sections are all CMS rows, plus the three whose body band is
 * hardcoded in the page file. Both kinds are measured the same way, which is
 * the point: a hardcoded band that drifts from the rhythm is exactly the bug
 * this catches.
 */
const PAGES = [
  '/',
  '/services',
  '/sectors',
  '/approach',
  '/network',
  '/fmp',
  '/contact',
  '/book',
  '/about/ahmad-din',
  // The six routes this list used to omit, which is exactly why their heroes
  // were allowed to drift. /team, /case-studies and /insights each carried a
  // hand-rolled 380px band, /privacy and /terms had no opening band at all, and
  // a service detail page opened straight into its body block.
  '/team',
  '/case-studies',
  '/insights',
  '/privacy',
  '/terms',
  '/services/financial-modeling',
  '/confidentiality',
];

/** The page height home used to have, in viewports, before this pass. */
const HOME_SCREENS_BEFORE = 10.2;

/** Footer height before it was tightened, measured at 1440x900. */
const FOOTER_HEIGHT_BEFORE = 785;

/**
 * Footer height after that tightening but before the nine service links became
 * one, measured the same way. The column of nine was the tallest thing left in
 * the footer, so dropping it has to show up here.
 */
const FOOTER_HEIGHT_WITH_SERVICE_LIST = 453;

/**
 * Routes that still render but are deliberately out of the site's structure:
 * absent from the navbar, the footer and the sitemap, and linked from nothing.
 *
 * /approach was hidden in Pages & Nav. The page and its route are untouched, so
 * nothing 404s and restoring the nav item brings it straight back, but a page
 * reachable only through links scattered across other pages is neither
 * published nor retired. This list is checked on every page below, including
 * the unlinked page itself, since a self-referential link would be just as
 * effective at keeping it half alive.
 */
const UNLINKED_ROUTES = ['/approach'];

/**
 * Routes that are out of the sitemap while their collection is empty.
 *
 * Different from UNLINKED_ROUTES in one way that matters: these are expected to
 * come back on their own. The sitemap derives them from the content rather than
 * from a hardcoded list, so adding the first case study puts /case-studies back
 * with no code change, and this check turns from "absent" into "present"
 * automatically. That is why it asks the collection first rather than asserting
 * a fixed answer.
 */
const COLLECTION_INDEX_ROUTES = ['/team', '/case-studies', '/insights'];

let passed = 0;
const failures = [];
function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
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
  const port = 9336;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-cdp-rh-'));
  const proc = spawn(
    findChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
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

async function load(page, url, { reducedMotion = false } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Emulating the media feature rather than trusting a class name: the
  // component reads it through matchMedia, so the only honest test is to make
  // matchMedia answer differently.
  await page.send('Emulation.setEmulatedMedia', {
    features: reducedMotion ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
  });
  await page.send('Page.navigate', { url });
  await waitFor(async () => page.evaluate("document.readyState === 'complete'"), 80, 250);
  await page.evaluate(
    `new Promise(r => { const imgs=[...document.images].filter(i=>!i.complete);
       if(!imgs.length) return r(true);
       let n=imgs.length; const done=()=>{ if(--n<=0) r(true); };
       imgs.forEach(i=>{ i.addEventListener('load',done,{once:true}); i.addEventListener('error',done,{once:true}); });
       setTimeout(()=>r(true), 4000); })`,
  );
  // One more frame, so the hydrated client components have settled.
  await new Promise((r) => setTimeout(r, 500));
}

/** Every top-level band on the page, in document order. */
const BANDS = `
(() => {
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width) }; };
  const bands = [...document.querySelectorAll('main > section, main > div > section')];
  const footer = document.querySelector('footer');
  return {
    total: Math.round(document.body.scrollHeight),
    viewport: window.innerHeight,
    footerHeight: footer ? Math.round(footer.getBoundingClientRect().height) : null,
    footerLinks: [...document.querySelectorAll('footer a[href]')]
      .map((a) => a.getAttribute('href')),
    bands: bands.map((s) => {
      const cs = getComputedStyle(s);
      const h = s.querySelector('h1, h2');
      return {
        height: rect(s).h,
        background: cs.backgroundColor,
        hasGradient: cs.backgroundImage !== 'none',
        heading: (h ? h.textContent : '').trim().slice(0, 46),
      };
    }),
  };
})()
`;

/** The carousel's state as the DOM actually reports it. */
const CAROUSEL = `
(() => {
  const root = document.querySelector('[aria-roledescription="carousel"]');
  if (!root) return null;
  const track = root.querySelector('[data-carousel-track]');
  if (!track) return null;
  const slides = [...track.querySelectorAll('[data-carousel-slide]')];
  const box = root.getBoundingClientRect();
  const visible = slides.filter((s) => {
    const r = s.getBoundingClientRect();
    return r.right > box.left + 1 && r.left < box.right - 1;
  });
  const cs = getComputedStyle(track);
  return {
    slideCount: slides.length,
    visibleCount: visible.length,
    slideWidth: Math.round(slides[0].getBoundingClientRect().width),
    trackWidth: Math.round(track.getBoundingClientRect().width),
    transform: cs.transform,
    transition: cs.transitionDuration,
    activeIndex: slides.findIndex((s) => !s.hasAttribute('inert')),
    activeTitle: (visible[0]?.querySelector('h3')?.textContent || '').trim(),
    arrows: [...root.querySelectorAll('button[aria-label]')].map((b) =>
      b.getAttribute('aria-label'),
    ),
  };
})()
`;

/** Puts the carousel on screen, which is what lets its timer run. */
const BRING_INTO_VIEW = `document.querySelector('[aria-roledescription="carousel"]')
  .scrollIntoView({ block: 'center' })`;

const clickArrow = (label) => `
(() => {
  const root = document.querySelector('[aria-roledescription="carousel"]');
  const btn = [...root.querySelectorAll('button[aria-label]')]
    .find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)});
  btn.click();
  return true;
})()
`;

/** Puts the pointer over the carousel, which is what pauses it. */
const HOVER = `
(() => {
  const root = document.querySelector('[aria-roledescription="carousel"]');
  root.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  root.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return true;
})()
`;

async function main() {
  const chrome = await launchChrome();
  const { page } = chrome;

  try {
    // ---- heroes and rhythm, every page ------------------------------------
    let homeHero = null;
    let homeTotal = 0;

    for (const p of PAGES) {
      console.log(`\n=== ${p}`);
      await load(page, BASE + p);
      const data = await page.evaluate(BANDS);
      const bands = data.bands;
      ok(`${p}: renders bands`, bands.length > 0, String(bands.length));
      if (!bands.length) continue;

      const hero = bands[0];
      if (p === '/') {
        homeHero = hero.height;
        homeTotal = data.total;
        ok('home hero is 70vh', Math.abs(hero.height - HEIGHT * 0.7) <= 2, String(hero.height));
      } else {
        // Within 2px of home. The one page that lands a pixel over is /fmp,
        // whose hero content (eight capability tags) genuinely exceeds 70vh;
        // the padding is what keeps that to a rounding difference rather than
        // the 97px it was.
        ok(
          `${p}: hero matches the home hero height`,
          Math.abs(hero.height - homeHero) <= 2,
          `${hero.height} vs ${homeHero}`,
        );
      }

      // The rhythm: cream, white, cream, alternating from the band after the
      // hero, and navy nowhere but the hero.
      const expected = (i) => (i % 2 === 1 ? CREAM : WHITE);
      for (let i = 1; i < bands.length; i++) {
        ok(
          `${p}: band ${i} is ${expected(i) === CREAM ? 'cream' : 'white'}`,
          bands[i].background === expected(i),
          `${bands[i].background} on "${bands[i].heading}"`,
        );
      }
      ok(
        `${p}: navy appears only on the hero`,
        !bands.slice(1).some((b) => b.background === NAVY),
        bands
          .slice(1)
          .filter((b) => b.background === NAVY)
          .map((b) => b.heading)
          .join(', '),
      );

      // Nothing anywhere on the page, header and footer included, may link to
      // a route that has been taken out of the navigation. Checked per page
      // rather than once, since a stray link in one section's rich text is
      // exactly what this is for.
      for (const route of UNLINKED_ROUTES) {
        const hits = await page.evaluate(
          `[...document.querySelectorAll('a[href]')]
             .map(a => a.getAttribute('href'))
             .filter(h => h === ${JSON.stringify(route)} || h.startsWith(${JSON.stringify(route + '?')}) || h.startsWith(${JSON.stringify(route + '#')}))`,
        );
        ok(`${p}: nothing links to ${route}`, hits.length === 0, hits.join(', '));
      }
    }

    // ---- the unlinked route still works ------------------------------------
    // ---- footer ------------------------------------------------------------
    console.log('\n=== footer');
    await load(page, BASE + '/');
    const footerData = await page.evaluate(BANDS);
    console.log(`  measured ${footerData.footerHeight}px at 1440x900`);
    ok(
      'the footer is shorter than it was',
      footerData.footerHeight !== null && footerData.footerHeight < FOOTER_HEIGHT_BEFORE,
      `${footerData.footerHeight}px, was ${FOOTER_HEIGHT_BEFORE}px`,
    );
    ok(
      'the footer is shorter again without the service list',
      footerData.footerHeight !== null &&
        footerData.footerHeight < FOOTER_HEIGHT_WITH_SERVICE_LIST,
      `${footerData.footerHeight}px, was ${FOOTER_HEIGHT_WITH_SERVICE_LIST}px`,
    );
    // The nine service pages are listed in full, with a summary each, on
    // /services. Repeating them here made the footer long and told the reader
    // nothing that page does not tell them better.
    ok(
      'the footer lists no individual service pages',
      footerData.footerLinks.filter((h) => h.startsWith('/services/')).length === 0,
      footerData.footerLinks.filter((h) => h.startsWith('/services/')).join(', '),
    );
    ok(
      'the footer links to /services once',
      footerData.footerLinks.filter((h) => h === '/services').length === 1,
      String(footerData.footerLinks.filter((h) => h === '/services').length),
    );
    // Booking moved out of the Firm list and in with the other ways of reaching
    // the firm. Which column it renders in is now content, so this asserts the
    // link survives the move rather than asserting where a given operator has
    // since put it.
    ok(
      'the footer still offers a booking link',
      footerData.footerLinks.includes('/book'),
      'no /book link',
    );
    // The nav rows an operator hid must not be reachable from the footer
    // either, which is the whole point of hiding them.
    for (const gone of ['/approach', '/about/ahmad-din']) {
      ok(
        `the footer does not link to ${gone}`,
        !footerData.footerLinks.includes(gone),
        'still linked',
      );
    }

    // ---- services dropdown -------------------------------------------------
    console.log('\n=== services dropdown');
    const closed = await page.evaluate(
      `!!document.querySelector('[data-nav-dropdown] [data-dropdown-panel]')`,
    );
    ok('the panel is closed to begin with', !closed, 'panel already open');
    ok(
      'the parent still links to /services',
      await page.evaluate(
        `document.querySelector('[data-nav-dropdown] a')?.getAttribute('href') === '/services'`,
      ),
      'parent is not a link to /services',
    );

    const openPanel = `
      (() => {
        const btn = document.querySelector('[data-nav-dropdown] button');
        btn.click();
        return true;
      })()`;
    await page.evaluate(openPanel);
    await new Promise((r) => setTimeout(r, 120));
    const panel = await page.evaluate(`
      (() => {
        const p = document.querySelector('[data-dropdown-panel]');
        if (!p) return null;
        const grid = p.firstElementChild;
        const items = [...p.querySelectorAll('[data-dropdown-item]')];
        const cols = new Set(items.map((i) => Math.round(i.getBoundingClientRect().x)));
        return {
          count: items.length,
          columns: cols.size,
          hrefs: items.map((i) => i.getAttribute('href')),
          gridCols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          expanded: document.querySelector('[data-nav-dropdown] button')
            .getAttribute('aria-expanded'),
        };
      })()`);
    ok('the panel opens on the toggle', !!panel, 'no panel');
    if (panel) {
      ok('it lists all nine services', panel.count === 9, String(panel.count));
      ok('laid out in two columns', panel.columns === 2 && panel.gridCols === 2,
        `x positions ${panel.columns}, grid ${panel.gridCols}`);
      ok(
        'every item links to its own service page',
        panel.hrefs.length === 9 && panel.hrefs.every((h) => /^\/services\/[a-z-]+$/.test(h)),
        panel.hrefs.join(', '),
      );
      ok('the toggle reports expanded', panel.expanded === 'true', String(panel.expanded));
    }

    // Row alignment. The panel fills left to right, so an item that wraps onto
    // a second line used to make its row taller and leave the item beside it
    // sitting in a gap. Measured twice: as it renders today, then again with an
    // item forced to wrap, since a fix that only holds for the nine titles that
    // happen to exist now is not a fix.
    const ROWS = `
      (() => {
        const items = [...document.querySelectorAll('[data-dropdown-item]')];
        if (!items.length) return null;
        const rows = new Map();
        for (const it of items) {
          const r = it.getBoundingClientRect();
          const key = Math.round(r.y);
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key).push(Math.round(r.height));
        }
        const heights = [...rows.values()];
        return {
          rowCount: rows.size,
          // Items sharing a row must be the same height as each other, and
          // every row must be the same height as every other row.
          evenWithinRows: heights.every((h) => new Set(h).size === 1),
          rowHeights: heights.map((h) => h[0]),
          tallest: Math.max(...items.map((i) => Math.round(i.getBoundingClientRect().height))),
        };
      })()`;

    const beforeWrap = await page.evaluate(ROWS);
    ok('the panel rows measure', !!beforeWrap, 'no items');
    if (beforeWrap) {
      ok(
        'items sharing a row have the same height',
        beforeWrap.evenWithinRows,
        JSON.stringify(beforeWrap.rowHeights),
      );
      ok(
        'every row is the same height',
        new Set(beforeWrap.rowHeights).size === 1,
        JSON.stringify(beforeWrap.rowHeights),
      );
    }

    // Force a wrap by lengthening one label in place. This is the case the fix
    // exists for: FMP-length service names, or any title added later.
    await page.evaluate(`
      (() => {
        const items = [...document.querySelectorAll('[data-dropdown-item]')];
        const last = items[items.length - 1];
        const span = last.querySelector('span:last-child');
        span.textContent = 'A Deliberately Long Service Title That Has To Wrap Onto Several Lines';
        return true;
      })()`);
    await new Promise((r) => setTimeout(r, 120));
    const afterWrap = await page.evaluate(ROWS);
    if (afterWrap && beforeWrap) {
      ok(
        'a wrapping item still leaves every row the same height',
        new Set(afterWrap.rowHeights).size === 1,
        JSON.stringify(afterWrap.rowHeights),
      );
      ok(
        'a wrapping item still leaves its neighbour the same height',
        afterWrap.evenWithinRows,
        JSON.stringify(afterWrap.rowHeights),
      );
      ok(
        'the wrap really did make the item taller',
        afterWrap.tallest > beforeWrap.tallest,
        `${afterWrap.tallest}px vs ${beforeWrap.tallest}px`,
      );
      ok(
        'nothing wraps at the shipped titles',
        beforeWrap.rowHeights[0] < afterWrap.rowHeights[0],
        `${beforeWrap.rowHeights[0]}px, wrapped ${afterWrap.rowHeights[0]}px`,
      );
    }

    // Escape closes it and returns focus to the toggle, which is what makes it
    // usable without a mouse.
    await page.evaluate(
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
    );
    await new Promise((r) => setTimeout(r, 120));
    ok(
      'Escape closes the panel',
      !(await page.evaluate(`!!document.querySelector('[data-dropdown-panel]')`)),
      'still open',
    );
    ok(
      'Escape returns focus to the toggle',
      await page.evaluate(
        `document.activeElement === document.querySelector('[data-nav-dropdown] button')`,
      ),
      'focus went elsewhere',
    );

    await page.evaluate(openPanel);
    await new Promise((r) => setTimeout(r, 120));
    await page.evaluate(
      `document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`,
    );
    await new Promise((r) => setTimeout(r, 120));
    ok(
      'a click outside closes the panel',
      !(await page.evaluate(`!!document.querySelector('[data-dropdown-panel]')`)),
      'still open',
    );

    // Below the breakpoint the panel is gone and the children are listed inside
    // the existing mobile menu instead.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.send('Page.navigate', { url: BASE + '/' });
    await waitFor(async () => page.evaluate("document.readyState === 'complete'"), 80, 250);
    await new Promise((r) => setTimeout(r, 400));
    const mobile = await page.evaluate(`
      (() => {
        const toggle = [...document.querySelectorAll('header button[aria-label]')]
          .find((b) => /menu$/i.test(b.getAttribute('aria-label') || '')
            && !b.closest('[data-nav-dropdown]'));
        if (!toggle) return null;
        toggle.click();
        return new Promise((res) => setTimeout(() => res({
          serviceLinks: [...document.querySelectorAll('header a[href^="/services/"]')].length,
          // A panel that exists but is display:none below the breakpoint is
          // still not shown to anyone, so this asks the layout rather than the
          // DOM.
          desktopPanel: [...document.querySelectorAll('[data-dropdown-panel]')]
            .some((p) => p.getBoundingClientRect().height > 0),
        }), 200));
      })()`);
    ok('the mobile menu opens', !!mobile, 'no toggle found');
    if (mobile) {
      ok(
        'the nine services are listed in the mobile menu',
        mobile.serviceLinks === 9,
        String(mobile.serviceLinks),
      );
      ok('no floating panel on mobile', !mobile.desktopPanel, 'panel rendered');
    }

    console.log('\n=== unlinked routes still resolve');
    for (const route of UNLINKED_ROUTES) {
      // Unreferenced, not deleted. A visitor with the URL, and anyone holding
      // an old bookmark or an indexed result, still gets the page.
      const res = await fetch(BASE + route);
      ok(`${route} still returns 200`, res.status === 200, String(res.status));
      const html = await res.text();
      ok(
        `${route} still renders its own content`,
        html.includes('How we engage') || html.includes('four-step'),
        'page body did not contain its headline',
      );
      const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
      ok(`${route} is not in the sitemap`, !sitemap.includes(route), 'still listed');
    }

    // ---- collection index pages follow their own content -------------------
    // An index page with nothing on it is not offered to crawlers, and one with
    // content is. The assertion asks the page for its row count rather than
    // hardcoding today's answer, so populating a collection flips this check
    // from "absent" to "present" without an edit here.
    // ---- the contact form's phone default ----------------------------------
    // Read from the live control rather than the markup. The value is applied by
    // react-hook-form after hydration, so the server HTML carries no `selected`
    // attribute and a source check would prove nothing about what the form
    // actually submits.
    console.log('\n=== contact form phone default');
    await load(page, BASE + '/contact');
    const phoneDefault = await page.evaluate(`
      (() => {
        const s = document.querySelector('select[aria-label="Phone country code"]');
        if (!s) return null;
        return {
          value: s.value,
          optionCount: s.options.length,
          firstThree: [...s.options].slice(0, 3).map((o) => o.value),
        };
      })()`);
    ok('the phone country select is on the form', !!phoneDefault, 'not found');
    if (phoneDefault) {
      ok('it is set to Saudi Arabia', phoneDefault.value === 'SA', phoneDefault.value);
      ok('it offers the full country list', phoneDefault.optionCount > 190,
        String(phoneDefault.optionCount));
      ok('the GCC leads the list',
        phoneDefault.firstThree.join(',') === 'SA,AE,QA', phoneDefault.firstThree.join(','));
    }

    console.log('\n=== collection index pages in the sitemap');
    const sitemapXml = await (await fetch(BASE + '/sitemap.xml')).text();
    for (const route of COLLECTION_INDEX_ROUTES) {
      const res = await fetch(BASE + route);
      ok(`${route} still returns 200`, res.status === 200, String(res.status));
      const html = await res.text();
      const match = html.match(/data-collection-count="(\d+)"/);
      ok(`${route} publishes its row count`, !!match, 'marker missing');
      if (!match) continue;

      const count = Number(match[1]);
      // The trailing quote pins the match to the index URL: without it,
      // /case-studies/<slug> in the sitemap would read as the index being there.
      const listed = sitemapXml.includes(`${route}</loc>`);
      ok(
        count === 0
          ? `${route} is empty, so it is out of the sitemap`
          : `${route} has ${count} entries, so it is in the sitemap`,
        count === 0 ? !listed : listed,
        `count ${count}, listed ${listed}`,
      );
    }

    // ---- home sequence -----------------------------------------------------
    console.log('\n=== home sequence');
    await load(page, BASE + '/');
    const home = await page.evaluate(BANDS);
    const headings = home.bands.map((b) => b.heading);

    ok(
      'home no longer lists the service catalogue',
      !(await page.evaluate(
        `[...document.querySelectorAll('main a[href^="/services/"]')].length`,
      )),
      'links to individual service pages remain on home',
    );

    const iStats = headings.findIndex((h) => /track record|30\+|mandates/i.test(h));
    const iWhat = headings.findIndex((h) => /Corporate finance, end to end/i.test(h));
    ok('home carries the "What we do" highlight', iWhat >= 0, headings.join(' | '));
    ok(
      '"What we do" sits after the firm track record',
      iWhat > 0 && (iStats === -1 || iWhat > iStats),
      `what=${iWhat} stats=${iStats}`,
    );
    ok(
      '"What we do" links to /services',
      await page.evaluate(
        `!!document.querySelector('main a[href="/services"]')`,
      ),
      'no /services CTA on home',
    );
    ok(
      'the firm credentials block is gone',
      !headings.some((h) => /Firm credentials/i.test(h)),
      headings.join(' | '),
    );
    ok(
      'home is materially shorter than before',
      home.total / home.viewport < HOME_SCREENS_BEFORE - 2,
      `${(home.total / home.viewport).toFixed(1)} screens, was ${HOME_SCREENS_BEFORE}`,
    );

    // ---- carousel ----------------------------------------------------------
    console.log('\n=== audience carousel');
    const c0 = await page.evaluate(CAROUSEL);
    ok('carousel is on the home page', !!c0, 'not found');
    if (c0) {
      ok('carousel has four cards', c0.slideCount === 4, String(c0.slideCount));
      ok('exactly one card is visible', c0.visibleCount === 1, String(c0.visibleCount));
      ok(
        'the card is wider than the three-across grid it replaced',
        c0.slideWidth > 1100,
        `${c0.slideWidth}px`,
      );
      ok(
        'both arrows are present',
        c0.arrows.includes('Previous') && c0.arrows.includes('Next'),
        c0.arrows.join(', '),
      );
      ok('it opens on the first card', c0.activeIndex === 0, String(c0.activeIndex));
      ok('the slide has a transition', c0.transition !== '0s', c0.transition);

      // Advances on its own, right to left: the track's translateX goes
      // negative, which pulls the next card in from the right edge. Scrolled
      // into view first, because a carousel below the fold deliberately holds.
      await page.evaluate(BRING_INTO_VIEW);
      const advanced = await waitFor(
        async () => {
          const c = await page.evaluate(CAROUSEL);
          return c.activeIndex !== 0 ? c : null;
        },
        40,
        500,
      );
      ok(
        'it advances on its own',
        advanced.activeIndex === 1,
        `landed on ${advanced.activeIndex}`,
      );
      const tx = Number((advanced.transform.match(/matrix\(.*?,\s*(-?[\d.]+),\s*[\d.]+\)$/) || [])[1] ?? NaN);
      ok(
        'it moves right to left',
        Number.isFinite(tx) ? tx < 0 : advanced.transform !== 'none',
        advanced.transform,
      );

      await page.evaluate(clickArrow('Next'));
      const afterNext = await page.evaluate(CAROUSEL);
      ok(
        'the Next arrow moves forward',
        afterNext.activeIndex === (advanced.activeIndex + 1) % 4,
        String(afterNext.activeIndex),
      );

      await page.evaluate(clickArrow('Previous'));
      const afterPrev = await page.evaluate(CAROUSEL);
      ok(
        'the Previous arrow moves back',
        afterPrev.activeIndex === advanced.activeIndex,
        String(afterPrev.activeIndex),
      );

      // Hovered, it should hold. Waiting two full intervals is the only way to
      // tell a pause from a slow advance.
      await page.evaluate(HOVER);
      const held = afterPrev.activeIndex;
      await new Promise((r) => setTimeout(r, 13000));
      const afterHover = await page.evaluate(CAROUSEL);
      ok(
        'it pauses while hovered',
        afterHover.activeIndex === held,
        `moved ${held} to ${afterHover.activeIndex} over two intervals`,
      );

      // Off-screen cards are out of the tab order, so a keyboard user cannot
      // land inside a card nobody can see.
      ok(
        'only the visible card is in the tab order',
        await page.evaluate(
          `[...document.querySelectorAll('[data-carousel-slide]')]
             .filter(s => !s.hasAttribute('inert')).length === 1`,
        ),
        'more than one slide is not inert',
      );
    }

    // ---- the same carousel on /fmp -----------------------------------------
    console.log('\n=== fmp carousel');
    await load(page, BASE + '/fmp');
    const f0 = await page.evaluate(CAROUSEL);
    ok('the /fmp audience block is a carousel', !!f0, 'not found');
    if (f0) {
      ok('it has six cards', f0.slideCount === 6, String(f0.slideCount));
      ok('exactly one card is visible', f0.visibleCount === 1, String(f0.visibleCount));
      ok(
        'both arrows are present',
        f0.arrows.includes('Previous') && f0.arrows.includes('Next'),
        f0.arrows.join(', '),
      );
      await page.evaluate(BRING_INTO_VIEW);
      const fAdvanced = await waitFor(
        async () => {
          const c = await page.evaluate(CAROUSEL);
          return c.activeIndex !== 0 ? c : null;
        },
        40,
        500,
      );
      ok('it advances on its own', fAdvanced.activeIndex === 1, String(fAdvanced.activeIndex));
      await page.evaluate(clickArrow('Next'));
      const fNext = await page.evaluate(CAROUSEL);
      ok(
        'the arrows work',
        fNext.activeIndex === (fAdvanced.activeIndex + 1) % 6,
        String(fNext.activeIndex),
      );
    }

    // ---- off screen means paused -------------------------------------------
    //
    // The point is not the saved work, it is what a visitor sees: scrolling
    // down to a carousel that has been cycling since the page loaded means
    // arriving mid-sequence at a card chosen by a timer rather than at the
    // first one. This asserts the card is still the first after two full
    // intervals spent above it.
    console.log('\n=== off screen');
    await load(page, BASE + '/');
    const offScreen = await page.evaluate(`
      (() => {
        const root = document.querySelector('[aria-roledescription="carousel"]');
        window.scrollTo(0, 0);
        const r = root.getBoundingClientRect();
        return { top: Math.round(r.top), viewport: window.innerHeight };
      })()`);
    ok(
      'the carousel starts below the fold',
      offScreen.top > offScreen.viewport,
      `top ${offScreen.top}, viewport ${offScreen.viewport}`,
    );
    if (offScreen.top > offScreen.viewport) {
      await new Promise((r) => setTimeout(r, 13000));
      const held = await page.evaluate(CAROUSEL);
      ok(
        'it did not advance while off screen',
        held.activeIndex === 0,
        `advanced to ${held.activeIndex} over two intervals`,
      );
      // Scrolling to it starts the timer, so the behaviour is a hold rather
      // than a permanent stop.
      await page.evaluate(
        `document.querySelector('[aria-roledescription="carousel"]')
           .scrollIntoView({ block: 'center' })`,
      );
      const woke = await waitFor(
        async () => {
          const c = await page.evaluate(CAROUSEL);
          return c.activeIndex !== 0 ? c : null;
        },
        40,
        500,
      );
      ok('it starts once scrolled into view', woke.activeIndex === 1, String(woke.activeIndex));
    }

    // ---- reduced motion ----------------------------------------------------
    console.log('\n=== reduced motion');
    await load(page, BASE + '/', { reducedMotion: true });
    await page.evaluate(BRING_INTO_VIEW);
    const r0 = await page.evaluate(CAROUSEL);
    ok('carousel still renders with motion reduced', !!r0, 'not found');
    if (r0) {
      ok('the slide transition is off', r0.transition === '0s', r0.transition);
      await new Promise((r) => setTimeout(r, 13000));
      const r1 = await page.evaluate(CAROUSEL);
      ok(
        'it does not advance on its own',
        r1.activeIndex === r0.activeIndex,
        `moved ${r0.activeIndex} to ${r1.activeIndex} over two intervals`,
      );
      await page.evaluate(clickArrow('Next'));
      const r2 = await page.evaluate(CAROUSEL);
      ok(
        'the arrows still work',
        r2.activeIndex === (r0.activeIndex + 1) % 4,
        String(r2.activeIndex),
      );
    }
  } finally {
    chrome.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-page-rhythm failed:', err.message);
  process.exitCode = 1;
});
