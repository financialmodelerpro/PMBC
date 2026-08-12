// scripts/verify-section-media-layout.mjs
//
// Verifies the shared section media layout and the justify alignment option
// against a running server, measuring real geometry in headless Chrome over the
// DevTools protocol rather than reading markup.
//
// Markup alone cannot answer the question this checks. Two columns is a
// computed-style and bounding-box fact: the classes can be right while the CSS
// never reaches the page, and a grid can emit two cells that still render
// stacked. Every assertion below reads getBoundingClientRect or
// getComputedStyle from a real layout.
//
// What it covers, per the Phase 31 brief:
//   * left and right produce two columns on desktop, roughly 55/45 text to
//     media, vertically overlapping, media on the correct side
//   * the media frame sizes to its column, not the full content width, and
//     carries no fixed aspect ratio
//   * every position stacks on mobile, with the media after the text
//   * above and below stay full width and stacked
//   * an image, an animated GIF and a video all render, each through its own
//     element and optimizer path
//   * this holds across several section types, not just one
//   * sections with no media render no frame and no wrapper
//   * justified copy sets hyphens auto, both as a whole block and as a single
//     paragraph justified from the toolbar
//
//   node scripts/verify-section-media-layout.mjs
//   VERIFY_BASE=http://localhost:3999 node scripts/verify-section-media-layout.mjs
//
// Restores every section it touches, including on failure.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { buildAnimatedGif } from './lib/animatedGif.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';
const DESKTOP = 1440;
const MOBILE = 390;

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found at ' + envPath);
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// chrome over CDP, no browser automation dependency
// ---------------------------------------------------------------------------
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('Chrome not found. Set CHROME_PATH.');
}

async function waitFor(fn, tries = 60, delay = 250) {
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
  const port = 9333;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-cdp-'));
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
  const tabRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const tab = (await tabRes.json()).find((t) => t.id === targetId);
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
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await page.send('Page.navigate', { url });
  // Settle on the document being interactive plus the images having laid out.
  await waitFor(async () => page.evaluate("document.readyState === 'complete'"), 80, 250);
  await page.evaluate(
    `new Promise(r => { const imgs=[...document.images].filter(i=>!i.complete);
       if(!imgs.length) return r(true);
       let n=imgs.length; const done=()=>{ if(--n<=0) r(true); };
       imgs.forEach(i=>{ i.addEventListener('load',done,{once:true}); i.addEventListener('error',done,{once:true}); });
       setTimeout(()=>r(true), 4000); })`,
  );
}

/** Reads every media frame with its grid geometry. */
const PROBE = `
(() => {
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
  return [...document.querySelectorAll('[data-section-media]')].map((f) => {
    const cell = f.parentElement;
    const parent = cell.parentElement;
    const cs = getComputedStyle(parent);
    const siblings = [...parent.children].filter((c) => c !== cell);
    const textCell = siblings[0] || null;
    const asset = f.querySelector('img, video');
    return {
      position: f.dataset.sectionMedia,
      parentDisplay: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      frame: rect(f),
      mediaCell: rect(cell),
      textCell: textCell ? rect(textCell) : null,
      container: rect(parent),
      assetTag: asset ? asset.tagName : null,
      assetSrc: asset ? (asset.currentSrc || asset.getAttribute('src') || '') : '',
      assetAspectRatio: asset ? getComputedStyle(asset).aspectRatio : '',
      frameAspectRatio: getComputedStyle(f).aspectRatio,
      sectionType: f.closest('section') ? (f.closest('section').getAttribute('data-probe-type') || '') : '',
    };
  });
})()
`;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
const PUBLIC_BASE = (u) => u;

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const storageBase = `${url}/storage/v1/object/public/cms-assets/`;
  const GIF_NAME = `verify_section_media_probe.gif`;

  // The GIF is generated rather than committed: an animated file is the case
  // that matters (the optimizer is bypassed precisely because re-encoding one
  // returns a frozen frame), and a binary fixture in the repo would be a
  // fixture nobody can read a diff of.
  const gifBytes = buildAnimatedGif();
  const upload = await db.storage
    .from('cms-assets')
    .upload(GIF_NAME, gifBytes, { contentType: 'image/gif', upsert: true });
  if (upload.error) throw new Error('gif upload: ' + upload.error.message);

  const ASSETS = {
    image: PUBLIC_BASE(storageBase + '1786359266066_icon-512.png'),
    gif: PUBLIC_BASE(storageBase + GIF_NAME),
    video: PUBLIC_BASE(storageBase + '1786369746725_scrutiny-video.mp4'),
  };

  // Three different section types, so the layout is proved shared rather than
  // implemented once. All three go through SectionContainer.
  const { data: homeRows, error: readErr } = await db
    .from('page_sections')
    .select('id, section_type, display_order, content')
    .eq('page_slug', 'home')
    .order('display_order');
  if (readErr) throw new Error('read home: ' + readErr.message);

  const targets = ['paragraphs', 'stats_block', 'service_cards']
    .map((t) => homeRows.find((r) => r.section_type === t))
    .filter(Boolean);
  if (targets.length < 3) throw new Error('expected three distinct section types on home');

  // Restore targets the LIVE content of every home section, not just the ones
  // under test. Home already carries a real media row, and leaving it in place
  // would put a second frame on the page: every geometry assertion below reads
  // the first frame it finds, so a stray one silently measures the wrong thing.
  const originals = new Map(homeRows.map((r) => [r.id, r.content]));
  const MEDIA_KEYS = [
    'media_url',
    'media_type',
    'media_poster_url',
    'media_position',
    'media_caption',
    'media_autoplay',
    'media_loop',
    'media_controls',
  ];
  /** The row's real content with every shared media key removed. */
  const stripped = (id) => {
    const out = { ...originals.get(id) };
    for (const k of MEDIA_KEYS) delete out[k];
    return out;
  };

  const restore = async () => {
    for (const [id, content] of originals) {
      await db.from('page_sections').update({ content }).eq('id', id);
    }
    await db.storage.from('cms-assets').remove([GIF_NAME]);
  };

  const setMedia = async (row, asset, position) => {
    const base = stripped(row.id);
    const next = { ...base, media_url: asset, media_position: position, media_caption: '' };
    // Video needs autoplay off so the probe measures a settled frame.
    if (asset.endsWith('.mp4')) {
      next.media_autoplay = false;
      next.media_controls = true;
    }
    const { error } = await db.from('page_sections').update({ content: next }).eq('id', row.id);
    if (error) throw new Error('set media: ' + error.message);
  };
  const clearMedia = async (row) => {
    await db.from('page_sections').update({ content: stripped(row.id) }).eq('id', row.id);
  };
  /** Strip media from every home section, so only the section under test has any. */
  const clearAll = async () => {
    for (const r of homeRows) {
      await db.from('page_sections').update({ content: stripped(r.id) }).eq('id', r.id);
    }
  };

  const browser = await launchChrome();
  try {
    // ---- 0. baseline: no media anywhere on home ---------------------------
    console.log('\n=== baseline, no media set ===');
    await clearAll();
    await load(browser.page, BASE + '/', DESKTOP);
    const baseline = await browser.page.evaluate(PROBE);
    ok('no section renders a media frame when no media is set', baseline.length === 0,
      `${baseline.length} frame(s) found`);
    const baselineHeights = await browser.page.evaluate(
      `[...document.querySelectorAll('main section')].map(s => Math.round(s.getBoundingClientRect().height))`,
    );

    // ---- 1. left and right, per media kind, per section type --------------
    for (const [kind, asset] of Object.entries(ASSETS)) {
      for (const position of ['left', 'right']) {
        const row = targets[Object.keys(ASSETS).indexOf(kind)];
        console.log(`\n=== ${kind} / ${position} / ${row.section_type} ===`);
        await setMedia(row, asset, position);

        // desktop
        await load(browser.page, BASE + '/', DESKTOP);
        const d = (await browser.page.evaluate(PROBE))[0];
        const label = `${kind} ${position} desktop`;
        if (!d) {
          ok(`${label}: frame rendered`, false, 'no frame found');
          await clearMedia(row);
          continue;
        }
        ok(`${label}: frame rendered`, true);
        ok(`${label}: stored position honoured`, d.position === position, d.position);
        ok(`${label}: parent is a grid`, d.parentDisplay === 'grid', d.parentDisplay);
        ok(
          `${label}: two column tracks`,
          d.gridTemplateColumns.trim().split(/\s+/).length === 2,
          d.gridTemplateColumns,
        );
        ok(
          `${label}: text and media overlap vertically (side by side)`,
          !!d.textCell && d.mediaCell.top < d.textCell.bottom && d.textCell.top < d.mediaCell.bottom,
          `media ${d.mediaCell.top}-${d.mediaCell.bottom}, text ${d.textCell?.top}-${d.textCell?.bottom}`,
        );
        if (position === 'right') {
          ok(
            `${label}: media sits to the right of the text`,
            !!d.textCell && d.mediaCell.left >= d.textCell.right - 2,
            `media.left=${d.mediaCell.left} text.right=${d.textCell?.right}`,
          );
        } else {
          ok(
            `${label}: media sits to the left of the text`,
            !!d.textCell && d.mediaCell.right <= d.textCell.left + 2,
            `media.right=${d.mediaCell.right} text.left=${d.textCell?.left}`,
          );
        }
        const share = d.textCell ? d.textCell.w / (d.textCell.w + d.mediaCell.w) : 0;
        ok(
          `${label}: split is roughly 55/45 text to media`,
          share > 0.52 && share < 0.58,
          `text share ${(share * 100).toFixed(1)}%`,
        );
        ok(
          `${label}: frame is narrower than the content container`,
          d.frame.w < d.container.w - 100,
          `frame ${d.frame.w} vs container ${d.container.w}`,
        );
        ok(
          `${label}: frame has no fixed aspect ratio`,
          d.frameAspectRatio === 'auto' && (d.assetAspectRatio === 'auto' || /\d/.test(d.assetAspectRatio)),
          `frame=${d.frameAspectRatio}`,
        );
        const expectTag = kind === 'video' ? 'VIDEO' : 'IMG';
        ok(`${label}: renders a <${expectTag.toLowerCase()}>`, d.assetTag === expectTag, String(d.assetTag));
        if (kind === 'gif') {
          ok(
            `${label}: optimizer bypassed, raw GIF served`,
            d.assetSrc.includes('.gif') && !d.assetSrc.includes('/_next/image'),
            d.assetSrc.slice(-70),
          );
        }
        if (kind === 'image') {
          ok(
            `${label}: still image goes through the optimizer`,
            d.assetSrc.includes('/_next/image'),
            d.assetSrc.slice(0, 70),
          );
        }

        // mobile
        await load(browser.page, BASE + '/', MOBILE);
        const m = (await browser.page.evaluate(PROBE))[0];
        const mlabel = `${kind} ${position} mobile`;
        ok(`${mlabel}: frame rendered`, !!m);
        if (m) {
          ok(
            `${mlabel}: single column, not a two-track grid`,
            m.parentDisplay !== 'grid' || m.gridTemplateColumns.trim().split(/\s+/).length === 1,
            `${m.parentDisplay} / ${m.gridTemplateColumns}`,
          );
          ok(
            `${mlabel}: media stacks after the text`,
            !!m.textCell && m.mediaCell.top >= m.textCell.bottom - 2,
            `media.top=${m.mediaCell.top} text.bottom=${m.textCell?.bottom}`,
          );
        }

        await clearMedia(row);
      }
    }

    // ---- 2. above and below keep the stacked full width behaviour ---------
    for (const position of ['above', 'below']) {
      const row = targets[0];
      console.log(`\n=== image / ${position} / ${row.section_type} ===`);
      await setMedia(row, ASSETS.image, position);
      await load(browser.page, BASE + '/', DESKTOP);
      const d = (await browser.page.evaluate(PROBE))[0];
      const label = `image ${position} desktop`;
      ok(`${label}: frame rendered`, !!d);
      if (d) {
        ok(`${label}: frame spans the content width`, d.frame.w > d.container.w - 40,
          `frame ${d.frame.w} vs container ${d.container.w}`);
        ok(`${label}: not a two column grid`,
          d.parentDisplay !== 'grid' || d.gridTemplateColumns.trim().split(/\s+/).length === 1,
          `${d.parentDisplay} / ${d.gridTemplateColumns}`);
      }
      await clearMedia(row);
    }

    // ---- 3. default position with no stored value -------------------------
    console.log('\n=== default position (media_url set, media_position absent) ===');
    {
      const row = targets[0];
      const base = stripped(row.id);
      await db
        .from('page_sections')
        .update({ content: { ...base, media_url: ASSETS.image } })
        .eq('id', row.id);
      await load(browser.page, BASE + '/', DESKTOP);
      const d = (await browser.page.evaluate(PROBE))[0];
      ok('unset position defaults to right', !!d && d.position === 'right', d?.position);
      ok(
        'unset position lays out in two columns',
        !!d && d.parentDisplay === 'grid' && d.gridTemplateColumns.trim().split(/\s+/).length === 2,
        `${d?.parentDisplay} / ${d?.gridTemplateColumns}`,
      );
      await clearMedia(row);
    }

    // ---- 4. sections without media are untouched --------------------------
    console.log('\n=== sections without media unchanged ===');
    {
      const row = targets[1];
      await setMedia(row, ASSETS.image, 'right');
      await load(browser.page, BASE + '/', DESKTOP);
      const after = await browser.page.evaluate(
        `[...document.querySelectorAll('main section')].map(s => Math.round(s.getBoundingClientRect().height))`,
      );
      ok('section count unchanged', after.length === baselineHeights.length,
        `${after.length} vs ${baselineHeights.length}`);
      const moved = after.filter((h, i) => Math.abs(h - baselineHeights[i]) > 2).length;
      ok('exactly one section changes height', moved === 1, `${moved} section(s) moved`);
      const frames = await browser.page.evaluate(PROBE);
      ok('exactly one media frame on the page', frames.length === 1, `${frames.length}`);
      await clearMedia(row);
    }

    // ---- 5. justify -------------------------------------------------------
    console.log('\n=== justify alignment ===');
    {
      const row = targets[0];
      const base = stripped(row.id);
      // Block level, set by the section editor's alignment control.
      await db
        .from('page_sections')
        .update({ content: { ...base, align: 'justify' } })
        .eq('id', row.id);
      await load(browser.page, BASE + '/', DESKTOP);
      const block = await browser.page.evaluate(`
        (() => {
          const el = document.querySelector('.pmbc-prose-justify p');
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { textAlign: cs.textAlign, hyphens: cs.hyphens || cs.webkitHyphens };
        })()
      `);
      ok('block justify sets text-align justify', block?.textAlign === 'justify', block?.textAlign);
      ok('block justify sets hyphens auto', block?.hyphens === 'auto', block?.hyphens);

      // Paragraph level, set from the rich-text toolbar, which stores an inline
      // style rather than a class on the wrapper.
      const html = typeof base.html === 'string' ? base.html : '<p>x</p>';
      const injected = html.replace('<p>', '<p style="text-align: justify">');
      await db
        .from('page_sections')
        .update({ content: { ...base, align: 'left', html: injected } })
        .eq('id', row.id);
      await load(browser.page, BASE + '/', DESKTOP);
      const inline = await browser.page.evaluate(`
        (() => {
          const el = [...document.querySelectorAll('.pmbc-prose p')]
            .find(p => getComputedStyle(p).textAlign === 'justify');
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { textAlign: cs.textAlign, hyphens: cs.hyphens || cs.webkitHyphens,
                   wrapperJustifyClass: el.closest('.pmbc-prose-justify') !== null };
        })()
      `);
      ok('toolbar justify survives the sanitiser', inline?.textAlign === 'justify', inline?.textAlign);
      ok('toolbar justify is not relying on the block class',
        inline?.wrapperJustifyClass === false, String(inline?.wrapperJustifyClass));
      ok('toolbar justify sets hyphens auto', inline?.hyphens === 'auto', inline?.hyphens);

      await clearMedia(row);
    }

    // ---- 6. the standalone media section ----------------------------------
    console.log('\n=== standalone media section ===');
    {
      await clearAll();
      const before = await browser.page.evaluate(
        `[...document.querySelectorAll('main section')].length`,
      );
      // Slot it between the firm introduction (20) and what we do (30).
      const insert = async (content) => {
        const { data, error } = await db
          .from('page_sections')
          .insert({
            page_slug: 'home',
            section_type: 'media',
            content,
            styles: {},
            display_order: 25,
            visible: true,
          })
          .select('id')
          .single();
        if (error) throw new Error('insert media section: ' + error.message);
        return data.id;
      };

      // 6a. empty renders nothing at all
      let id = await insert({ media_url: '', media_caption: '', heading: '', width: 'full' });
      await load(browser.page, BASE + '/', DESKTOP);
      const emptyFrames = await browser.page.evaluate(PROBE);
      const emptyCount = await browser.page.evaluate(
        `[...document.querySelectorAll('main section')].length`,
      );
      ok('empty media section renders no frame', emptyFrames.length === 0, `${emptyFrames.length}`);
      ok('empty media section renders no section element', emptyCount === before,
        `${emptyCount} vs ${before}`);
      await db.from('page_sections').delete().eq('id', id);

      // 6b. filled, at each width
      for (const [width, expect] of [
        ['full', 1200],
        ['wide', 960],
        ['narrow', 720],
      ]) {
        id = await insert({
          media_url: ASSETS.image,
          media_caption: 'STANDALONE PROBE',
          eyebrow: 'PROBE',
          heading: 'Standalone media',
          width,
        });
        await load(browser.page, BASE + '/', DESKTOP);
        const frames = await browser.page.evaluate(PROBE);
        const f = frames[0];
        const label = `standalone ${width}`;
        ok(`${label}: exactly one frame on the page`, frames.length === 1, `${frames.length}`);
        if (f) {
          ok(`${label}: marked standalone, not positioned against text`,
            f.position === 'standalone', f.position);
          // The optional eyebrow and heading are a sibling in the same inner
          // box, so the check is that nothing is laid out BESIDE the frame,
          // not that the frame is an only child.
          ok(`${label}: not a two column grid`, f.parentDisplay !== 'grid', f.parentDisplay);
          ok(`${label}: heading sits above the frame, not beside it`,
            !f.textCell || f.textCell.bottom <= f.frame.top + 2,
            f.textCell ? `heading.bottom=${f.textCell.bottom} frame.top=${f.frame.top}` : 'no heading');
          ok(`${label}: frame is ${expect}px wide`, Math.abs(f.frame.w - expect) <= 2,
            `${f.frame.w}`);
        }
        const order = await browser.page.evaluate(`
          (() => {
            const secs = [...document.querySelectorAll('main section')];
            const i = secs.findIndex(s => s.querySelector('[data-section-media]'));
            return { index: i, total: secs.length,
                     prevHasHeading: i > 0 ? secs[i-1].textContent.includes('A boutique by design') : false,
                     nextHasHeading: i >= 0 && i < secs.length - 1
                       ? secs[i+1].textContent.includes('WHAT WE DO') : false };
          })()
        `);
        ok(`${label}: is its own section element`, order.index >= 0 && order.total === before + 1,
          `index ${order.index}, ${order.total} sections`);
        ok(`${label}: sits between the firm introduction and what we do`,
          order.prevHasHeading && order.nextHasHeading,
          `prev=${order.prevHasHeading} next=${order.nextHasHeading}`);
        await db.from('page_sections').delete().eq('id', id);
      }

      // 6c. the standalone section carries video and GIF too
      for (const kind of ['gif', 'video']) {
        id = await insert({
          media_url: ASSETS[kind],
          media_caption: '',
          heading: '',
          width: 'wide',
          ...(kind === 'video' ? { media_autoplay: false, media_controls: true } : {}),
        });
        await load(browser.page, BASE + '/', DESKTOP);
        const f = (await browser.page.evaluate(PROBE))[0];
        const expectTag = kind === 'video' ? 'VIDEO' : 'IMG';
        ok(`standalone ${kind}: renders a <${expectTag.toLowerCase()}>`, f?.assetTag === expectTag,
          String(f?.assetTag));
        if (kind === 'gif') {
          ok('standalone gif: optimizer bypassed',
            !!f && f.assetSrc.includes('.gif') && !f.assetSrc.includes('/_next/image'),
            f?.assetSrc.slice(-60));
        }
        await db.from('page_sections').delete().eq('id', id);
      }

      // 6d. it stacks and fits on mobile
      id = await insert({ media_url: ASSETS.image, media_caption: '', heading: '', width: 'full' });
      await load(browser.page, BASE + '/', MOBILE);
      const m = (await browser.page.evaluate(PROBE))[0];
      ok('standalone mobile: frame rendered', !!m);
      ok('standalone mobile: frame fits the viewport', !!m && m.frame.w <= MOBILE, `${m?.frame.w}`);
      await db.from('page_sections').delete().eq('id', id);
    }
  } finally {
    browser.close();
    await restore();
    console.log('\nfixtures restored');
  }

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-section-media-layout failed:', err.message);
  process.exitCode = 1;
});
