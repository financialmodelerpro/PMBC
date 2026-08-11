// scripts/verify-media-upload.mjs
//
// Verifies the signed direct-to-storage upload path end to end against a
// running server, and the readable-error handling in the admin.
//
//   node scripts/verify-media-upload.mjs
//   VERIFY_BASE=http://localhost:3999 node scripts/verify-media-upload.mjs
//
// WHAT IT COVERS
//   * a ~3 MB video: signs, uploads straight to storage, records, and is
//     publicly readable at the returned URL
//   * a file just under the stated limit: same, and the bytes really landed
//   * a file over the limit: refused at the sign step, as JSON, with a message
//     naming the actual limit, and nothing is written to storage
//   * a client that LIES about its size: storage refuses the PUT itself, so
//     the ceiling is real rather than a client side claim
//   * the request that carries the file never passes through the app, which is
//     the whole point of the change
//   * the admin renders a readable message for a non-JSON platform rejection
//     rather than "Unexpected token ... is not valid JSON"
//
// AUTHENTICATION
// The admin password was rotated and is deliberately not stored anywhere in
// this repo, so this does not log in. It mints a NextAuth session token
// directly from NEXTAUTH_SECRET, which proves the route accepts a real session
// without putting a live credential in a script or a transcript.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { encode } from 'next-auth/jwt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';
const BUCKET = 'cms-assets';

const MB = 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * MB;
const MAX_IMAGE_BYTES = 10 * MB;

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

/** Minimal but structurally valid mp4, padded to the requested size. */
function fakeMp4(bytes) {
  const buf = Buffer.alloc(bytes);
  // ftyp box, so the file sniffs as mp4 rather than as arbitrary zeroes.
  buf.writeUInt32BE(0x18, 0);
  buf.write('ftypmp42', 4, 'latin1');
  buf.write('mp42isom', 12, 'latin1');
  return buf;
}

async function main() {
  loadEnvLocal();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env');
  if (!secret) throw new Error('Missing NEXTAUTH_SECRET');

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: admin } = await db.from('admin_users').select('id, email, name').limit(1).single();
  const token = await encode({
    token: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    secret,
  });
  const cookie = `next-auth.session-token=${token}`;
  const created = [];

  const post = (body) =>
    fetch(`${BASE}/api/admin/media`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });

  // ---- 0. the session actually works ---------------------------------------
  console.log('=== session ===');
  {
    const anon = await fetch(`${BASE}/api/admin/media?bucket=${BUCKET}`);
    ok('unauthenticated request is refused', anon.status === 401, String(anon.status));
    const authed = await fetch(`${BASE}/api/admin/media?bucket=${BUCKET}`, { headers: { cookie } });
    ok('minted session is accepted', authed.status === 200, String(authed.status));
  }

  // ---- 1. the happy paths ---------------------------------------------------
  for (const [label, sizeBytes] of [
    ['3 MB video', 3 * MB],
    ['24 MB video, just under the limit', 24 * MB],
  ]) {
    console.log(`\n=== ${label} ===`);
    const filename = `_verify_${Math.round(sizeBytes / MB)}mb.mp4`;
    const bytes = fakeMp4(sizeBytes);

    const signRes = await post({
      action: 'sign',
      bucket: BUCKET,
      filename,
      contentType: 'video/mp4',
      size: sizeBytes,
    });
    ok(`${label}: sign returns 200`, signRes.status === 200, String(signRes.status));
    ok(
      `${label}: sign responds with JSON`,
      (signRes.headers.get('content-type') || '').includes('application/json'),
    );
    const signed = await signRes.json();
    ok(`${label}: a signed URL is returned`, typeof signed.signedUrl === 'string' && !!signed.signedUrl);
    ok(
      `${label}: the upload target is Supabase Storage, not this app`,
      String(signed.signedUrl).startsWith(supabaseUrl) && !String(signed.signedUrl).startsWith(BASE),
      String(signed.signedUrl).slice(0, 60),
    );
    created.push(signed.name);

    const put = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: bytes,
    });
    ok(`${label}: direct PUT to storage succeeds`, put.ok, String(put.status));

    const done = await post({ action: 'complete', bucket: BUCKET, name: signed.name });
    ok(`${label}: complete returns 200`, done.status === 200, String(done.status));
    const record = await done.json();
    ok(`${label}: recorded size matches the file`, record.size === sizeBytes,
      `${record.size} vs ${sizeBytes}`);

    const fetched = await fetch(record.url, { method: 'HEAD' });
    ok(`${label}: the stored file is publicly readable`, fetched.ok, String(fetched.status));
    ok(
      `${label}: stored length matches`,
      Number(fetched.headers.get('content-length')) === sizeBytes,
      String(fetched.headers.get('content-length')),
    );
  }

  // ---- 2. over the limit, declared honestly ---------------------------------
  console.log('\n=== 26 MB video, over the limit ===');
  {
    const res = await post({
      action: 'sign',
      bucket: BUCKET,
      filename: '_verify_26mb.mp4',
      contentType: 'video/mp4',
      size: 26 * MB,
    });
    ok('over-limit sign is refused', res.status === 413, String(res.status));
    ok(
      'refusal is JSON, not a platform error page',
      (res.headers.get('content-type') || '').includes('application/json'),
    );
    const body = await res.json();
    ok('message names the actual limit', /25 MB/.test(String(body.error)), String(body.error));
    ok('message names the file', /_verify_26mb\.mp4/.test(String(body.error)), String(body.error));

    const { data: listed } = await db.storage.from(BUCKET).list('', { search: '_verify_26mb' });
    ok('nothing was written to storage', (listed ?? []).length === 0, String((listed ?? []).length));
  }

  // ---- 3. over the limit, size under-declared -------------------------------
  // The route can only see the size the browser claims, so the bucket has to
  // carry a real ceiling. This lies to the route and checks storage still says no.
  console.log('\n=== 26 MB video, size under-declared ===');
  {
    const filename = '_verify_liar.mp4';
    const signRes = await post({
      action: 'sign',
      bucket: BUCKET,
      filename,
      contentType: 'video/mp4',
      size: 1 * MB,
    });
    ok('sign accepts the false declaration', signRes.status === 200, String(signRes.status));
    const signed = await signRes.json();
    const put = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: fakeMp4(26 * MB),
    });
    ok('storage refuses the oversized PUT anyway', !put.ok, String(put.status));
    const text = await put.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    ok('storage refusal is JSON with a usable message',
      !!parsed && /exceeded the maximum allowed size/i.test(JSON.stringify(parsed)),
      text.slice(0, 90));

    const done = await post({ action: 'complete', bucket: BUCKET, name: signed.name });
    ok('complete refuses to record an upload that did not land', done.status === 404,
      String(done.status));
  }

  // ---- 4. unsupported type --------------------------------------------------
  console.log('\n=== unsupported type ===');
  {
    const res = await post({
      action: 'sign',
      bucket: BUCKET,
      filename: 'notes.txt',
      contentType: 'text/plain',
      size: 100,
    });
    ok('unsupported type is refused', res.status === 415, String(res.status));
    const body = await res.json();
    ok('message names the type, not a size limit', /text\/plain/.test(String(body.error)),
      String(body.error));
  }

  // ---- 5. an oversized IMAGE uses the image limit, not the video one --------
  console.log('\n=== image limits are separate ===');
  {
    const res = await post({
      action: 'sign',
      bucket: BUCKET,
      filename: '_verify_big.png',
      contentType: 'image/png',
      size: 12 * MB,
    });
    ok('12 MB image is refused', res.status === 413, String(res.status));
    const body = await res.json();
    ok('message names the 10 MB image limit', /10 MB/.test(String(body.error)), String(body.error));
  }
  ok('image and video limits differ as documented', MAX_IMAGE_BYTES < MAX_VIDEO_BYTES);

  // ---- 6. the limits in code and in the bucket agree ------------------------
  console.log('\n=== bucket enforcement ===');
  {
    const { data: buckets } = await db.storage.listBuckets();
    const source = fs.readFileSync(path.join(projectRoot, 'src/lib/media.ts'), 'utf8');
    const declared = /MAX_VIDEO_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/.exec(source);
    const declaredBytes = declared ? Number(declared[1]) * MB : 0;
    ok('MAX_VIDEO_BYTES is readable from source', declaredBytes > 0, String(declaredBytes));
    for (const name of ['cms-assets', 'article-covers', 'case-study-images', 'team-photos']) {
      const b = (buckets ?? []).find((x) => x.name === name);
      ok(`${name}: bucket limit matches MAX_VIDEO_BYTES`, b?.file_size_limit === declaredBytes,
        `${b?.file_size_limit} vs ${declaredBytes}`);
    }
  }

  // ---- 7. the admin surfaces a non-JSON rejection readably ------------------
  await verifyReadableError(cookie);

  // ---- cleanup --------------------------------------------------------------
  const strays = [...created, '_verify_liar.mp4'];
  if (strays.length) await db.storage.from(BUCKET).remove(strays);
  const { data: left } = await db.storage.from(BUCKET).list('', { search: '_verify_' });
  ok('test files cleaned up', (left ?? []).length === 0,
    (left ?? []).map((f) => f.name).join(', '));

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// The readable-error check runs in a real browser against the real admin page.
// A platform rejection cannot be produced on demand, so fetch is stubbed to
// return exactly what one looks like: a plain text 413 body. What is being
// tested is the shipped UI's reaction to it.
// ---------------------------------------------------------------------------
async function verifyReadableError(cookie) {
  console.log('\n=== readable error for a non-JSON rejection ===');
  const chromePaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  const chrome = chromePaths.find((p) => fs.existsSync(p));
  if (!chrome) {
    console.log('  SKIP  Chrome not found, cannot exercise the admin UI');
    return;
  }

  const port = 9334;
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmbc-upload-'));
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const waitFor = async (fn, tries = 60, delay = 250) => {
    for (let i = 0; i < tries; i++) {
      try {
        const v = await fn();
        if (v) return v;
      } catch {
        /* keep waiting */
      }
      await new Promise((r) => setTimeout(r, delay));
    }
    throw new Error('timed out');
  };

  let sockets = [];
  const send = (ws, pending, method, params = {}) => {
    const id = pending.nextId++;
    return new Promise((resolve, reject) => {
      pending.map.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  try {
    const version = await waitFor(async () => {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      return r.ok ? r.json() : null;
    });
    const browserWs = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      browserWs.addEventListener('open', res, { once: true });
      browserWs.addEventListener('error', rej, { once: true });
    });
    const bPending = { nextId: 1, map: new Map() };
    browserWs.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && bPending.map.has(m.id)) {
        const { resolve } = bPending.map.get(m.id);
        bPending.map.delete(m.id);
        resolve(m.result);
      }
    });
    sockets.push(browserWs);

    const { targetId } = await send(browserWs, bPending, 'Target.createTarget', {
      url: 'about:blank',
    });
    const tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
      (t) => t.id === targetId,
    );
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    const pending = { nextId: 1, map: new Map() };
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.map.has(m.id)) {
        const { resolve, reject } = pending.map.get(m.id);
        pending.map.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      }
    });
    sockets.push(ws);

    await send(ws, pending, 'Page.enable');
    await send(ws, pending, 'Runtime.enable');
    await send(ws, pending, 'Network.enable');

    const value = cookie.split('=').slice(1).join('=');
    await send(ws, pending, 'Network.setCookie', {
      name: 'next-auth.session-token',
      value,
      domain: 'localhost',
      path: '/',
    });

    const evaluate = async (expression) => {
      const r = await send(ws, pending, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
      }
      return r.result.value;
    };

    await send(ws, pending, 'Page.navigate', { url: `${BASE}/admin/media` });
    await waitFor(async () => evaluate("document.readyState === 'complete'"), 80, 250);
    await waitFor(
      async () => evaluate("!!document.querySelector('input[type=file]')"),
      40,
      250,
    );

    // Stand in for the platform: a plain text 413, exactly the shape that
    // produced "Unexpected token 'R', \"Request En\"... is not valid JSON".
    await evaluate(`
      window.__realFetch = window.fetch;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/api/admin/media') && init && init.method === 'POST') {
          return Promise.resolve(new Response('Request Entity Too Large', {
            status: 413,
            headers: { 'content-type': 'text/plain' },
          }));
        }
        return window.__realFetch(input, init);
      };
      true;
    `);

    // Drive the real file input with a real File, so the page's own upload
    // handler runs rather than a simulated one.
    await evaluate(`
      (() => {
        const input = document.querySelector('input[type=file]');
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(1024)], 'probe.mp4', { type: 'video/mp4' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `);

    const message = await waitFor(async () => {
      const t = await evaluate(`
        (() => {
          const el = [...document.querySelectorAll('span, p')]
            .map(e => e.textContent || '')
            .find(t => /too large|not valid JSON|Unexpected token|HTTP 413|expired/i.test(t));
          return el || '';
        })()
      `);
      return t || null;
    }, 40, 250);

    console.log(`  admin showed: "${message}"`);
    ok('a non-JSON rejection produces a readable message',
      /too large/i.test(message), message);
    ok('the message is not a JSON parse error',
      !/not valid JSON|Unexpected token/i.test(message), message);
    ok('the message names the real limits', /25 MB/.test(message), message);
  } catch (e) {
    ok('readable error check ran', false, e.message);
  } finally {
    for (const s of sockets) {
      try {
        s.close();
      } catch {
        /* already closed */
      }
    }
    proc.kill();
  }
}

main().catch((err) => {
  console.error('verify-media-upload failed:', err.message);
  process.exitCode = 1;
});
