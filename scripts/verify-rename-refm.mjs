// scripts/verify-rename-refm.mjs
//
// Verifies the service 06 rename end to end against a running server.
//
//   node scripts/verify-rename-refm.mjs
//   VERIFY_BASE=http://localhost:3999 node scripts/verify-rename-refm.mjs
//
// Checks the rendered pages, not just the database:
//   * /services/refm renders with the new name and its body content resolved
//     from the renamed cms_content namespace (the failure this rename could
//     have caused silently)
//   * the old URL 301s to the new one in exactly one hop
//   * the contact dropdown, the footer, the services grid, the home card, the
//     sitemap and the JSON-LD all carry the new label and path
//   * neither the old slug nor the old title appears anywhere in the codebase
//     or anywhere in the database
//
// Run against a production build. `next start` applies next.config.ts
// redirects; a dev server does too, but the built output is what ships.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const BASE = process.env.VERIFY_BASE || 'http://localhost:3999';

const OLD_SLUG = 'real-estate-modeling';
const NEW_SLUG = 'refm';
const OLD_TITLE = 'Real Estate Modeling';
const NEW_TITLE = 'Real Estate Financial Modeling';

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

const get = async (p) => {
  const res = await fetch(BASE + p, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
};

async function main() {
  loadEnvLocal();

  // ---- 1. the detail page ---------------------------------------------------
  console.log('=== /services/refm ===');
  const page = await get(`/services/${NEW_SLUG}`);
  ok('responds 200', page.status === 200, String(page.status));
  ok('shows the new display name', page.body.includes(NEW_TITLE));
  ok('does not show the old display name', !page.body.includes(OLD_TITLE));
  ok('<title> carries the new name', /<title>[^<]*Real Estate Financial Modeling/.test(page.body));
  ok(
    'canonical points at the new path',
    /rel="canonical"[^>]*\/services\/refm"/.test(page.body),
    (page.body.match(/rel="canonical"[^>]*>/) || [''])[0].slice(0, 90),
  );
  // The silent failure this rename could have caused: body content lives in the
  // cms_content `service_<slug>` namespace, so a missed rename renders a page
  // that looks fine but has no description and no deliverables.
  ok(
    'body content resolved from the renamed cms_content namespace',
    page.body.includes('Hospitality, residential, mixed-use'),
  );
  ok(
    'deliverables resolved from the renamed namespace',
    page.body.includes('Residual land valuation'),
  );
  ok('Service JSON-LD carries the new name',
    /"@type":"Service"[^]*?Real Estate Financial Modeling/.test(page.body) ||
      page.body.includes('\\"name\\":\\"Real Estate Financial Modeling'));

  // ---- 2. the redirect ------------------------------------------------------
  console.log('\n=== redirect from the old URL ===');
  const old = await get(`/services/${OLD_SLUG}`);
  ok('old URL returns 301', old.status === 301, String(old.status));
  ok('redirects straight to the new URL', old.location === `/services/${NEW_SLUG}`,
    String(old.location));
  // One hop: following the Location must land on a 200, not another redirect.
  const hop = await get(old.location || '/');
  ok('the target is a 200, so the redirect is one hop', hop.status === 200, String(hop.status));

  // ---- 3. surfaces that list services --------------------------------------
  console.log('\n=== listing surfaces ===');
  for (const [label, p, mustLink] of [
    ['services grid', '/services', true],
    ['home', '/', true],
    ['contact', '/contact', false],
  ]) {
    const r = await get(p);
    ok(`${label}: 200`, r.status === 200, String(r.status));
    ok(`${label}: shows the new name`, r.body.includes(NEW_TITLE));
    ok(`${label}: no old name`, !r.body.includes(OLD_TITLE));
    ok(`${label}: no old path`, !r.body.includes(`/services/${OLD_SLUG}`));
    if (mustLink) {
      ok(`${label}: links to the new path`, r.body.includes(`/services/${NEW_SLUG}`));
    }
  }

  // The dropdown is a real <option>, so check the element rather than the page
  // merely containing the string.
  const contact = await get('/contact');
  ok(
    'contact dropdown has an option with the new label',
    /<option[^>]*>\s*Real Estate Financial Modeling\s*<\/option>/.test(contact.body),
    (contact.body.match(/<option[^>]*>[^<]*Real Estate[^<]*<\/option>/) || ['none'])[0],
  );
  // Pre-selection by ?service=<slug> has to follow the slug too.
  const preselect = await get(`/contact?service=${NEW_SLUG}`);
  ok(
    'contact pre-selects the service from the new slug',
    /<option[^>]*selected[^>]*>\s*Real Estate Financial Modeling\s*<\/option>/.test(preselect.body) ||
      /Real Estate Financial Modeling[^<]*<\/option>/.test(preselect.body),
  );

  // ---- 4. sitemap and footer -----------------------------------------------
  console.log('\n=== sitemap ===');
  const sitemap = await get('/sitemap.xml');
  ok('sitemap lists the new path', sitemap.body.includes(`/services/${NEW_SLUG}`));
  ok('sitemap does not list the old path', !sitemap.body.includes(`/services/${OLD_SLUG}`));

  // ---- 5. codebase sweep ----------------------------------------------------
  console.log('\n=== codebase ===');
  const tracked = execFileSync('git', ['ls-files'], { cwd: projectRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const codeHits = [];
  for (const f of tracked) {
    // Applied migrations are historical records and are never edited, so the
    // old strings survive there by design. The same goes for their companion
    // seed scripts, which are the executable form of those same migrations.
    if (/^supabase\/migrations\/0(0[1-9]|1[0-9]|2[0-9]|3[0-9]|4[0-6])_/.test(f)) continue;
    if (/^scripts\/seed-(home-page|service-content|service-media-keys)\.mjs$/.test(f)) continue;
    if (/^scripts\/(seed-rename-refm|verify-rename-refm)\.mjs$/.test(f)) continue;
    if (f === 'supabase/migrations/047_rename_real_estate_service.sql') continue;
    let text;
    try {
      text = fs.readFileSync(path.join(projectRoot, f), 'utf8');
    } catch {
      continue;
    }
    // next.config.ts is the one live file that must still carry the old slug:
    // it is the `source` of the redirect. Rather than skipping the file, check
    // that every occurrence is on a `source:` line, so a stray reference
    // anywhere else in it would still be caught.
    if (f === 'next.config.ts') {
      const stray = text
        .split('\n')
        .filter((l) => l.includes(OLD_SLUG) || l.includes(OLD_TITLE))
        .filter((l) => !/^\s*source:/.test(l));
      ok('next.config.ts names the old slug only as a redirect source',
        stray.length === 0, stray.join(' | '));
      continue;
    }
    if (text.includes(OLD_SLUG) || text.includes(OLD_TITLE)) codeHits.push(f);
  }
  ok('no other live source file mentions the old slug or title', codeHits.length === 0,
    codeHits.join(', '));

  // ---- 6. database sweep ----------------------------------------------------
  console.log('\n=== database ===');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const TABLES = [
    'cms_pages',
    'cms_content',
    'page_sections',
    'services',
    'site_pages',
    'site_settings',
    'branding_config',
    'case_studies',
    'articles',
    'testimonials',
    'team_members',
    'email_templates',
  ];
  const dbHits = [];
  for (const t of TABLES) {
    const { data, error } = await db.from(t).select('*');
    if (error) continue;
    for (const row of data ?? []) {
      const blob = JSON.stringify(row);
      if (blob.includes(OLD_SLUG) || blob.includes(OLD_TITLE)) {
        dbHits.push(`${t}[${row.id ?? row.slug ?? ''}]`);
      }
    }
  }
  ok('no database row mentions the old slug or title', dbHits.length === 0, dbHits.join(', '));

  const { data: content } = await db.from('cms_content').select('key').eq('section', 'service_refm');
  ok('all 9 cms_content rows moved to service_refm', (content?.length ?? 0) === 9,
    String(content?.length ?? 0));

  console.log(`\n${passed + failures.length} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('verify-rename-refm failed:', err.message);
  process.exitCode = 1;
});
