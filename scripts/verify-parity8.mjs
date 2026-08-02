// scripts/verify-parity8.mjs
//
// End-to-end verification for parity 8: the testimonials approval workflow and
// the Pages and Nav inline-edit table.
//
// Drives the real admin APIs through a real NextAuth session, asserts the
// resulting database state, and checks that the public pages reflect it. Every
// row it creates is deleted again, so it is safe to run against the working
// database.
//
//   node scripts/verify-parity8.mjs           (expects a dev server on :3001)

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const EMAIL = 'meetahmadch@gmail.com';
// See the note in smoke-admin.mjs: env first, debug default as a fallback.
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

const TESTIMONIALS = '/api/admin/testimonials';
const SITE_PAGES = '/api/admin/site-pages';

// Marker used so a crashed run leaves rows that are obvious and findable.
const MARK = 'ZZ Parity8 Probe';

let pass = 0;
let fail = 0;

function check(ok, label, detail = '') {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ' : ' + detail : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

class CookieJar {
  constructor() {
    this.jar = new Map();
  }
  ingest(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const first = raw.split(';')[0];
      const eq = first.indexOf('=');
      if (eq === -1) continue;
      this.jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function login() {
  const jar = new CookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.ingest(csrfRes);
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
  jar.ingest(loginRes);
  if (
    !jar.jar.has('next-auth.session-token') &&
    !jar.jar.has('__Secure-next-auth.session-token')
  ) {
    throw new Error(`login did not set a session cookie (HTTP ${loginRes.status})`);
  }
  return jar;
}

function api(jar) {
  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        cookie: jar.header(),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'manual',
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body, e.g. a redirect */
    }
    return { status: res.status, json };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
    page: async (p) => {
      const res = await fetch(`${BASE}${p}`, {
        headers: { cookie: jar.header() },
        redirect: 'manual',
      });
      return { status: res.status, html: await res.text() };
    },
  };
}

async function publicHtml(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return { status: res.status, html: await res.text() };
}

async function main() {
  const jar = await login();
  const a = api(jar);
  console.log('Login OK');

  const createdTestimonials = [];
  const createdNav = [];

  try {
    // ---------------------------------------------------------------- pages
    section('Admin pages render');
    for (const route of ['/admin/testimonials', '/admin/pages']) {
      const r = await a.page(route);
      check(r.status === 200, `${route} renders`, `HTTP ${r.status}`);
    }

    // -------------------------------------------------------- testimonials
    section('Testimonials : approval workflow');

    const mk = async (name) => {
      const r = await a.post(TESTIMONIALS, {
        name: `${MARK} ${name}`,
        role: 'Managing Director',
        company: 'Probe Holdings',
        text: 'Placeholder quote written by the parity 8 verification script.',
        status: 'pending',
        testimonial_type: 'written',
        display_order: 900,
      });
      if (r.status !== 200 || !r.json?.row?.id) {
        throw new Error(`create failed: HTTP ${r.status} ${JSON.stringify(r.json)}`);
      }
      createdTestimonials.push(r.json.row.id);
      return r.json.row;
    };

    const t1 = await mk('One');
    check(t1.status === 'pending', 'new testimonial starts pending', t1.status);
    check(t1.approved_at === null, 'new testimonial has no approved_at', String(t1.approved_at));

    const approved = await a.patch(TESTIMONIALS, { id: t1.id, status: 'approved' });
    check(approved.json?.row?.status === 'approved', 'approve sets status=approved');
    check(
      typeof approved.json?.row?.approved_at === 'string',
      'approve stamps approved_at',
      String(approved.json?.row?.approved_at),
    );
    const firstApproval = approved.json?.row?.approved_at;

    // Re-saving an approved row must not move the original approval date.
    const resave = await a.patch(TESTIMONIALS, { id: t1.id, status: 'approved', is_featured: true });
    check(
      resave.json?.row?.approved_at === firstApproval,
      're-saving an approved row keeps the original approved_at',
    );
    check(resave.json?.row?.is_featured === true, 'featured toggle persists');

    const landing = await a.patch(TESTIMONIALS, { id: t1.id, show_on_landing: true });
    check(landing.json?.row?.show_on_landing === true, 'show_on_landing toggle persists');

    const revoked = await a.patch(TESTIMONIALS, { id: t1.id, status: 'pending' });
    check(revoked.json?.row?.status === 'pending', 'revoke returns the row to pending');
    check(revoked.json?.row?.approved_at === null, 'revoke clears approved_at');

    const rejected = await a.patch(TESTIMONIALS, { id: t1.id, status: 'rejected' });
    check(rejected.json?.row?.status === 'rejected', 'reject sets status=rejected');
    check(rejected.json?.row?.approved_at === null, 'reject leaves approved_at null');

    const reconsidered = await a.patch(TESTIMONIALS, { id: t1.id, status: 'pending' });
    check(reconsidered.json?.row?.status === 'pending', 'reconsider returns the row to pending');

    // Bulk approve / reject are N sequential PATCHes from the client, so the
    // API-level assertion is that N rows land on the requested status.
    const t2 = await mk('Two');
    const t3 = await mk('Three');
    for (const id of [t1.id, t2.id]) await a.patch(TESTIMONIALS, { id, status: 'approved' });
    await a.patch(TESTIMONIALS, { id: t3.id, status: 'rejected' });

    const listed = await a.get(TESTIMONIALS);
    const byId = new Map((listed.json?.rows ?? []).map((r) => [r.id, r]));
    check(
      byId.get(t1.id)?.status === 'approved' && byId.get(t2.id)?.status === 'approved',
      'bulk approve lands both rows on approved',
    );
    check(byId.get(t3.id)?.status === 'rejected', 'bulk reject lands the row on rejected');

    // Filter tabs are a client-side partition of this same list, so what has to
    // hold server side is that every row carries a status the tabs know about.
    const statuses = new Set((listed.json?.rows ?? []).map((r) => r.status));
    check(
      [...statuses].every((s) => ['pending', 'approved', 'rejected'].includes(s)),
      'every testimonial status is one of pending/approved/rejected',
      [...statuses].join(','),
    );

    section('Testimonials : public site still filters on approved');
    const about1 = await publicHtml('/about');
    check(about1.status === 200, '/about renders', `HTTP ${about1.status}`);
    check(
      about1.html.includes('Probe Holdings'),
      'an approved testimonial reaches /about',
    );

    await a.patch(TESTIMONIALS, { id: t1.id, status: 'pending' });
    await a.patch(TESTIMONIALS, { id: t2.id, status: 'pending' });
    const about2 = await publicHtml('/about');
    check(
      !about2.html.includes('Probe Holdings'),
      'a non-approved testimonial does NOT reach /about',
    );

    // --------------------------------------------------------- pages & nav
    section('Pages and Nav : inline edit');

    const navBefore = await a.get(SITE_PAGES);
    check(navBefore.status === 200, 'GET site-pages', `HTTP ${navBefore.status}`);
    const supportsPinning = (navBefore.json?.rows ?? []).some((r) =>
      Object.prototype.hasOwnProperty.call(r, 'can_toggle'),
    );
    console.log(
      `  note  migration 033 (can_toggle) ${supportsPinning ? 'IS applied' : 'is NOT applied'}`,
    );

    const created = await a.post(SITE_PAGES, {
      label: 'ZZProbeNav',
      href: '/zz-probe-nav',
      display_order: 990,
      visible: true,
    });
    check(created.status === 200 && created.json?.row?.id, 'create nav item', `HTTP ${created.status}`);
    const nav = created.json.row;
    createdNav.push(nav.id);

    const relabel = await a.patch(SITE_PAGES, { id: nav.id, label: 'ZZProbeRenamed' });
    check(relabel.json?.row?.label === 'ZZProbeRenamed', 'inline label edit saves');

    const rehref = await a.patch(SITE_PAGES, { id: nav.id, href: '/zz-probe-moved' });
    check(rehref.json?.row?.href === '/zz-probe-moved', 'inline href edit saves');

    const home1 = await publicHtml('/');
    check(
      home1.html.includes('ZZProbeRenamed') && home1.html.includes('/zz-probe-moved'),
      'public navbar reflects the inline edits',
    );

    const hidden = await a.patch(SITE_PAGES, { id: nav.id, visible: false });
    check(hidden.json?.row?.visible === false, 'visible toggle persists immediately');

    const home2 = await publicHtml('/');
    check(
      !home2.html.includes('ZZProbeRenamed'),
      'a hidden nav item disappears from the public navbar',
    );

    const shown = await a.patch(SITE_PAGES, { id: nav.id, visible: true });
    check(shown.json?.row?.visible === true, 'visible toggle flips back');

    const reordered = await a.patch(SITE_PAGES, { id: nav.id, display_order: 991 });
    check(reordered.json?.row?.display_order === 991, 'reorder persists');

    if (supportsPinning) {
      const pinned = await a.patch(SITE_PAGES, { id: nav.id, can_toggle: false });
      check(pinned.json?.row?.can_toggle === false, 'pin toggle persists');

      const refusedHide = await a.patch(SITE_PAGES, { id: nav.id, visible: false });
      check(refusedHide.status === 403, 'server refuses to hide a pinned item', `HTTP ${refusedHide.status}`);

      const refusedDelete = await a.del(`${SITE_PAGES}?id=${nav.id}`);
      check(refusedDelete.status === 403, 'server refuses to delete a pinned item', `HTTP ${refusedDelete.status}`);

      const unpinned = await a.patch(SITE_PAGES, { id: nav.id, can_toggle: true });
      check(unpinned.json?.row?.can_toggle === true, 'unpin restores the toggles');
    } else {
      // Without the migration, a write carrying can_toggle must still succeed:
      // the route strips the column and replays rather than failing the edit.
      const degraded = await a.patch(SITE_PAGES, { id: nav.id, can_toggle: false, label: 'ZZProbeDegraded' });
      check(
        degraded.status === 200 && degraded.json?.row?.label === 'ZZProbeDegraded',
        'write carrying can_toggle degrades gracefully on a pre-033 database',
        `HTTP ${degraded.status}`,
      );
    }
  } finally {
    section('Cleanup');
    for (const id of createdNav) {
      // Unpin first in case a failed run left it pinned.
      await a.patch(SITE_PAGES, { id, can_toggle: true }).catch(() => {});
      const r = await a.del(`${SITE_PAGES}?id=${id}`);
      check(r.status === 200, `deleted nav item ${id.slice(0, 8)}`, `HTTP ${r.status}`);
    }
    for (const id of createdTestimonials) {
      const r = await a.del(`${TESTIMONIALS}?id=${id}`);
      check(r.status === 200, `deleted testimonial ${id.slice(0, 8)}`, `HTTP ${r.status}`);
    }
    const leftover = await a.get(TESTIMONIALS);
    check(
      !(leftover.json?.rows ?? []).some((r) => String(r.name ?? '').startsWith(MARK)),
      'no probe testimonials left behind',
    );
    const leftoverNav = await a.get(SITE_PAGES);
    check(
      !(leftoverNav.json?.rows ?? []).some((r) => String(r.label ?? '').startsWith('ZZProbe')),
      'no probe nav items left behind',
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nVerification aborted:', err.message);
  process.exit(1);
});
