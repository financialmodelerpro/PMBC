// scripts/smoke-admin.mjs
// Logs in via NextAuth credentials, then GETs every /admin/* page in the
// refactored sidebar. Reports HTTP status for each.

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const EMAIL = 'meetahmadch@gmail.com';
const PASSWORD = 'Admin@2026';

const ADMIN_ROUTES = [
  '/admin',
  '/admin/pages',
  '/admin/page-builder/home',
  '/admin/page-builder/services',
  '/admin/content',
  '/admin/branding',
  '/admin/header-settings',
  '/admin/contact-submissions',
  '/admin/email-branding',
  '/admin/email-templates',
  '/admin/settings',
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

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.ingestResponse(csrfRes);
  const { csrfToken } = await csrfRes.json();

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
  if (
    !jar.jar.has('next-auth.session-token') &&
    !jar.jar.has('__Secure-next-auth.session-token')
  ) {
    console.error('Login did not set session-token cookie');
    process.exit(1);
  }
  console.log('Login OK\n');

  let pass = 0;
  let fail = 0;
  let info = 0;
  for (const route of ADMIN_ROUTES) {
    const res = await fetch(`${BASE}${route}`, {
      headers: { cookie: jar.header() },
      redirect: 'manual',
    });
    let firstChunk = '';
    if (res.status >= 400) {
      try {
        const text = await res.text();
        firstChunk = text.slice(0, 160).replace(/\s+/g, ' ');
      } catch {}
    }
    const tag = res.status === 200 ? '✓' : res.status === 404 ? '·' : '✗';
    if (res.status === 200) pass++;
    else if (res.status === 404) info++;
    else fail++;
    console.log(
      `${tag} ${route.padEnd(36)} HTTP ${res.status}` +
        (firstChunk ? ' — ' + firstChunk : ''),
    );
  }
  console.log(`\n${pass} OK · ${info} 404 (placeholder) · ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  process.exit(1);
});
