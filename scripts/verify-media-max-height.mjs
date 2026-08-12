// scripts/verify-media-max-height.mjs
//
// Verifies the media max-height ceiling against a running server, measuring
// real geometry in headless Chrome over the DevTools protocol.
//
// Markup cannot answer this one. "Scales down to fit while keeping its aspect
// ratio, letterboxed rather than cropped" is four separate facts about a laid
// out box: its height, its width, the ratio of the picture painted inside it,
// and whether any of that picture falls outside the box. Every assertion below
// reads getBoundingClientRect, getComputedStyle, or the element's own intrinsic
// dimensions from a real layout.
//
// What it covers:
//   * with no value set, the frame renders exactly as it did before, on both
//     the standalone media section and the shared panel
//   * a ceiling below the natural height clamps the box to precisely that
//     height, and the frame on the page gets shorter by the same amount
//   * the box keeps its full column width, so the picture is letterboxed
//     against the frame surface instead of being cropped
//   * the painted picture keeps the asset's own aspect ratio to within 1%
//   * a ceiling above the natural height changes nothing, rather than upscaling
//   * out of range values are clamped, not obeyed and not discarded
//   * clearing the value returns the geometry to the baseline exactly
//   * all of it holds for a still image, an animated GIF and a video
//
// Needs a server already running, and writes to the live database, restoring
// every row it touches including on failure.
//
//   npm run dev -- -p 3999
//   node scripts/verify-media-max-height.mjs
//   VERIFY_BASE=http://localhost:3000 node scripts/verify-media-max-height.mjs

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

// Mirrors src/lib/cms/sectionMedia.ts. Restated rather than imported because
// that module is TypeScript and this script runs on bare node; a drift between
// the two shows up as a failing assertion, which is the point.
const MIN_MEDIA_MAX_HEIGHT = 80;
const MAX_MEDIA_MAX_HEIGHT = 1600;

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
  const port = 9334;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-cdp-mh-'));
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

async function load(page, url, width = DESKTOP) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  // Cache-bust, so a second measurement of the same URL after a database write
  // cannot be answered from the browser's own cache.
  const bust = url + (url.includes('?') ? '&' : '?') + 'mh=' + Date.now();
  await page.send('Page.navigate', { url: bust });
  await waitFor(async () => page.evaluate("document.readyState === 'complete'"), 80, 250);
  // Both intrinsic sizes below are only readable once the asset has metadata:
  // naturalWidth is 0 before an image decodes, and videoWidth is 0 before a
  // video reaches HAVE_METADATA. Measuring earlier would compare a real box
  // against a zero ratio.
  await page.evaluate(
    `new Promise(r => {
       const pend = [...document.images].filter(i => !i.complete)
         .concat([...document.querySelectorAll('video')].filter(v => v.readyState < 1));
       if (!pend.length) return r(true);
       let n = pend.length; const done = () => { if (--n <= 0) r(true); };
       pend.forEach(el => {
         el.addEventListener('load', done, { once: true });
         el.addEventListener('loadedmetadata', done, { once: true });
         el.addEventListener('error', done, { once: true });
       });
       setTimeout(() => r(true), 6000); })`,
  );
}

/** Every media frame with the laid out geometry of the asset inside it. */
const PROBE = `
(() => {
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) }; };
  return [...document.querySelectorAll('[data-section-media]')].map((f) => {
    const el = f.querySelector('img, video');
    const cs = el ? getComputedStyle(el) : null;
    const natural = !el ? null : el.tagName === 'VIDEO'
      ? { w: el.videoWidth, h: el.videoHeight }
      : { w: el.naturalWidth, h: el.naturalHeight };
    return {
      position: f.dataset.sectionMedia,
      frame: rect(f),
      box: el ? rect(el) : null,
      tag: el ? el.tagName : null,
      objectFit: cs ? cs.objectFit : '',
      maxHeight: cs ? cs.maxHeight : '',
      natural,
    };
  });
})()
`;

/**
 * The picture actually painted inside a box under object-fit: contain, from the
 * asset's own intrinsic ratio. This is what "letterboxed rather than cropped"
 * has to be checked against: the box can be any shape, and the question is
 * whether the picture inside it is whole and undistorted.
 */
function containedPicture(box, natural) {
  const ratio = natural.w / natural.h;
  const w = Math.min(box.w, box.h * ratio);
  const h = Math.min(box.h, box.w / ratio);
  return { w, h, ratio };
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const storageBase = `${url}/storage/v1/object/public/cms-assets/`;
  const GIF_NAME = 'verify_media_max_height_probe.gif';
  const up = await db.storage
    .from('cms-assets')
    .upload(GIF_NAME, buildAnimatedGif(), { contentType: 'image/gif', upsert: true });
  if (up.error) throw new Error('gif upload: ' + up.error.message);

  // Read the two pages that carry media today. The standalone section on
  // /services is the one that prompted this control; the shared panel on home
  // proves the same ceiling reaches the other render path.
  const { data: rows, error: readErr } = await db
    .from('page_sections')
    .select('id, page_slug, section_type, display_order, content')
    .in('page_slug', ['services', 'home'])
    .order('display_order');
  if (readErr) throw new Error('read sections: ' + readErr.message);

  const originals = new Map(rows.map((r) => [r.id, r.content]));

  const standalone = rows.find(
    (r) => r.page_slug === 'services' && r.section_type === 'media',
  );
  const shared = rows.find(
    (r) =>
      r.page_slug === 'home' &&
      r.section_type !== 'media' &&
      typeof (r.content || {}).media_url === 'string' &&
      r.content.media_url.trim() !== '',
  );
  if (!standalone) throw new Error('no standalone media section on /services');
  if (!shared) throw new Error('no shared-media section on home');

  const ASSETS = {
    video: originals.get(standalone.id).media_url,
    image: storageBase + '1786359266066_icon-512.png',
    gif: storageBase + GIF_NAME,
  };

  // Every other section on both pages loses its shared media for the duration.
  // The probe reads frames in document order, so one stray frame elsewhere on
  // the page would silently be measured as the one under test.
  const MEDIA_KEYS = [
    'media_url',
    'media_type',
    'media_poster_url',
    'media_position',
    'media_caption',
    'media_max_height',
    'media_autoplay',
    'media_loop',
    'media_controls',
  ];
  const withoutMedia = (id) => {
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

  /** Sets one row's media, with a ceiling of `maxHeight` (null clears the key). */
  const setMedia = async (row, { asset, position, maxHeight }) => {
    const next = { ...withoutMedia(row.id), media_url: asset };
    if (position) next.media_position = position;
    if (asset.endsWith('.mp4') || asset.endsWith('.webm')) {
      // Autoplay off and controls on, so the probe measures a settled element
      // rather than whatever frame playback had reached.
      next.media_type = 'video';
      next.media_autoplay = false;
      next.media_controls = true;
    }
    if (maxHeight !== null && maxHeight !== undefined) next.media_max_height = maxHeight;
    const { error } = await db
      .from('page_sections')
      .update({ content: next })
      .eq('id', row.id);
    if (error) throw new Error('set media: ' + error.message);
  };

  const chrome = await launchChrome();
  const { page } = chrome;

  /** Loads a page and returns its single media frame. */
  const measure = async (pagePath) => {
    await load(page, BASE + pagePath);
    const frames = await page.evaluate(PROBE);
    return { frames, first: frames[0] || null };
  };

  try {
    // Clear every shared media key on both pages up front, so only the row
    // under test carries a frame at any point.
    for (const r of rows) {
      await db.from('page_sections').update({ content: withoutMedia(r.id) }).eq('id', r.id);
    }

    for (const [label, pagePath, row, position] of [
      ['standalone /services', '/services', standalone, null],
      ['shared panel home', '/', shared, 'right'],
    ]) {
      for (const [kind, asset] of Object.entries(ASSETS)) {
        console.log(`\n${label} :: ${kind}`);

        // ---- baseline, no ceiling ------------------------------------------
        await setMedia(row, { asset, position, maxHeight: null });
        const base = (await measure(pagePath)).first;
        ok(`${label} ${kind}: one frame with no ceiling`, !!base && !!base.box,
          JSON.stringify(base));
        if (!base || !base.box || !base.natural || !base.natural.h) {
          ok(`${label} ${kind}: asset reported intrinsic dimensions`, false,
            JSON.stringify(base));
          continue;
        }
        ok(`${label} ${kind}: no ceiling means no max-height`,
          base.maxHeight === 'none', base.maxHeight);

        // A ceiling only proves anything when the asset is taller than it.
        const ceiling = Math.max(
          MIN_MEDIA_MAX_HEIGHT,
          Math.round(base.box.h * 0.5),
        );
        const provesClamp = ceiling < base.box.h;
        ok(`${label} ${kind}: baseline is tall enough to clamp`, provesClamp,
          `box ${base.box.w}x${base.box.h}, ceiling ${ceiling}`);

        // ---- ceiling below the natural height ------------------------------
        await setMedia(row, { asset, position, maxHeight: ceiling });
        const capped = (await measure(pagePath)).first;
        ok(`${label} ${kind}: box height clamped to the ceiling`,
          Math.abs(capped.box.h - ceiling) <= 1,
          `${capped.box.h} vs ${ceiling}`);
        ok(`${label} ${kind}: computed max-height is the stored value`,
          capped.maxHeight === `${ceiling}px`, capped.maxHeight);
        ok(`${label} ${kind}: scaled down rather than cropped`,
          capped.objectFit === 'contain', capped.objectFit);
        ok(`${label} ${kind}: box keeps its full column width`,
          capped.box.w === base.box.w, `${capped.box.w} vs ${base.box.w}`);
        ok(`${label} ${kind}: the frame on the page got shorter`,
          capped.frame.h < base.frame.h,
          `${capped.frame.h} vs ${base.frame.h}`);

        const pic = containedPicture(capped.box, capped.natural);
        const natRatio = capped.natural.w / capped.natural.h;
        ok(`${label} ${kind}: picture keeps its aspect ratio`,
          Math.abs(pic.w / pic.h - natRatio) / natRatio < 0.01,
          `${(pic.w / pic.h).toFixed(3)} vs ${natRatio.toFixed(3)}`);
        ok(`${label} ${kind}: whole picture is inside the box`,
          pic.w <= capped.box.w + 1 && pic.h <= capped.box.h + 1,
          `${Math.round(pic.w)}x${Math.round(pic.h)} in ${capped.box.w}x${capped.box.h}`);
        ok(`${label} ${kind}: letterboxed, so the picture is narrower than the box`,
          pic.w < capped.box.w - 1,
          `${Math.round(pic.w)} vs ${capped.box.w}`);

        // ---- ceiling above the natural height ------------------------------
        const roomy = base.box.h + 400;
        await setMedia(row, { asset, position, maxHeight: roomy });
        const loose = (await measure(pagePath)).first;
        ok(`${label} ${kind}: a ceiling above the asset changes nothing`,
          Math.abs(loose.box.h - base.box.h) <= 1 && loose.box.w === base.box.w,
          `${loose.box.w}x${loose.box.h} vs ${base.box.w}x${base.box.h}`);

        // ---- out of range, both ends ---------------------------------------
        await setMedia(row, { asset, position, maxHeight: 5 });
        const tiny = (await measure(pagePath)).first;
        ok(`${label} ${kind}: below the floor clamps up to ${MIN_MEDIA_MAX_HEIGHT}`,
          tiny.maxHeight === `${MIN_MEDIA_MAX_HEIGHT}px`, tiny.maxHeight);

        await setMedia(row, { asset, position, maxHeight: 99999 });
        const huge = (await measure(pagePath)).first;
        ok(`${label} ${kind}: above the ceiling clamps down to ${MAX_MEDIA_MAX_HEIGHT}`,
          huge.maxHeight === `${MAX_MEDIA_MAX_HEIGHT}px`, huge.maxHeight);

        // A value stored as a string, which is what the number input and the
        // cms_content backed service pages both produce.
        await setMedia(row, { asset, position, maxHeight: String(ceiling) });
        const asString = (await measure(pagePath)).first;
        ok(`${label} ${kind}: a numeric string is read as a number`,
          asString.maxHeight === `${ceiling}px`, asString.maxHeight);

        // ---- cleared, back to the baseline ---------------------------------
        await setMedia(row, { asset, position, maxHeight: '' });
        const cleared = (await measure(pagePath)).first;
        ok(`${label} ${kind}: clearing returns the exact baseline geometry`,
          cleared.box.w === base.box.w &&
            cleared.box.h === base.box.h &&
            cleared.frame.h === base.frame.h &&
            cleared.maxHeight === 'none',
          `${cleared.box.w}x${cleared.box.h} h${cleared.frame.h} max ${cleared.maxHeight} vs ` +
            `${base.box.w}x${base.box.h} h${base.frame.h}`);
      }
    }

    // ---- a section with no media is untouched -----------------------------
    console.log('\nno media set');
    for (const r of rows) {
      await db.from('page_sections').update({ content: withoutMedia(r.id) }).eq('id', r.id);
    }
    const emptyServices = await measure('/services');
    ok('services with no media renders no frame', emptyServices.frames.length === 0,
      String(emptyServices.frames.length));
    const emptyHome = await measure('/');
    ok('home with no media renders no frame', emptyHome.frames.length === 0,
      String(emptyHome.frames.length));
  } finally {
    chrome.close();
    await restore();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-media-max-height failed:', err.message);
  process.exitCode = 1;
});
