// scripts/smoke-builder.mjs
// Logs in via NextAuth credentials, then GETs several /admin/page-builder/<slug>
// routes and reports HTTP status. Used to verify Phase 4 fix end-to-end.

const BASE = 'http://localhost:3000';
const EMAIL = 'meetahmadch@gmail.com';
const PASSWORD = 'Admin@2026';

const SLUGS = [
  'home',
  'about',
  'services',
  'sectors',
  'contact',
  'financial-modeler-pro',
  'service-business-valuation',
];

class CookieJar {
  constructor() { this.jar = new Map(); }
  ingestSetCookieList(list) {
    for (const raw of list) {
      const first = raw.split(';')[0];
      const eq = first.indexOf('=');
      if (eq === -1) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      this.jar.set(name, value);
    }
  }
  ingestResponse(res) {
    const list = res.headers.getSetCookie?.() ?? [];
    this.ingestSetCookieList(list);
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function main() {
  const jar = new CookieJar();

  // 1. CSRF
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.ingestResponse(csrfRes);
  const { csrfToken } = await csrfRes.json();

  // 2. Sign in
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}/admin`,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });
  jar.ingestResponse(loginRes);

  if (![200, 302].includes(loginRes.status)) {
    console.error('Login failed: HTTP', loginRes.status);
    process.exit(1);
  }
  if (!jar.jar.has('next-auth.session-token') && !jar.jar.has('__Secure-next-auth.session-token')) {
    console.error('Login did not set session-token cookie');
    process.exit(1);
  }
  console.log('Login OK');

  // 3. Hit each page-builder route, follow redirects manually so we can see status.
  let allOk = true;
  for (const slug of SLUGS) {
    const url = `${BASE}/admin/page-builder/${slug}`;
    const res = await fetch(url, {
      headers: { cookie: jar.header() },
      redirect: 'manual',
    });
    let firstChunk = '';
    try {
      const text = await res.text();
      firstChunk = text.slice(0, 200).replace(/\s+/g, ' ');
    } catch {}
    const ok = res.status === 200;
    if (!ok) allOk = false;
    console.log(
      `${ok ? '✓' : '✗'} ${slug.padEnd(34)} HTTP ${res.status}` +
        (ok ? '' : ' — ' + firstChunk),
    );
  }

  // 4. Also hit /admin/pages while we're here.
  const pagesRes = await fetch(`${BASE}/admin/pages`, {
    headers: { cookie: jar.header() },
    redirect: 'manual',
  });
  console.log(
    `${pagesRes.status === 200 ? '✓' : '✗'} ${'/admin/pages'.padEnd(34)} HTTP ${pagesRes.status}`,
  );

  process.exit(allOk && pagesRes.status === 200 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
