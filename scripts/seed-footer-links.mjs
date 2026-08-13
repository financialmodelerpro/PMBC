// scripts/seed-footer-links.mjs
//
// Applies migration 054_footer_links.sql through supabase-js.
//
//   node scripts/seed-footer-links.mjs           apply
//   node scripts/seed-footer-links.mjs --dry-run report only
//   npm run seed-footer-links
//
// Seeds (footer_settings, links), the footer's link list, with Case Studies,
// Insights and Team hidden because those collections are empty.
//
// Idempotent and non-destructive: the row is written only when it is absent, so
// a re-run never discards edits made in /admin/footer-links.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SECTION = 'footer_settings';
const KEY = 'links';

/** Must stay identical to DEFAULT_FOOTER_LINKS in src/lib/cms/footerLinks.ts. */
const LINKS = [
  { id: 'services', label: 'Services', href: '/services', column: 'firm', visible: true },
  { id: 'network', label: 'Network', href: '/network', column: 'firm', visible: true },
  { id: 'sectors', label: 'Sectors', href: '/sectors', column: 'firm', visible: true },
  { id: 'case-studies', label: 'Case Studies', href: '/case-studies', column: 'firm', visible: false },
  { id: 'insights', label: 'Insights', href: '/insights', column: 'firm', visible: false },
  { id: 'team', label: 'Team', href: '/team', column: 'firm', visible: false },
  { id: 'fmp', label: 'Financial Modeler Pro', href: '/fmp', column: 'firm', visible: true },
  { id: 'contact', label: 'Contact', href: '/contact', column: 'firm', visible: true },
  { id: 'book', label: 'Book a Meeting', href: '/book', column: 'contact', visible: true },
];

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

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing, error } = await db
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();
  if (error) throw new Error('read: ' + error.message);

  if (existing) {
    console.log(`  skip  (${SECTION}, ${KEY}) already exists, leaving it alone`);
    let parsed = [];
    try {
      parsed = JSON.parse(existing.value ?? '[]');
    } catch {
      console.error('  FAIL  the stored value is not valid JSON. Fix it in /admin/content.');
      process.exitCode = 1;
      return;
    }
    console.log(`        ${parsed.length} link(s), ${parsed.filter((l) => l.visible === false).length} hidden`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  would write (${SECTION}, ${KEY}) with ${LINKS.length} links`);
    for (const l of LINKS) {
      console.log(`          ${l.visible ? 'show' : 'hide'}  ${l.column.padEnd(7)} ${l.label} -> ${l.href}`);
    }
    console.log('\nDry run, nothing written.');
    return;
  }

  const { error: writeError } = await db
    .from('cms_content')
    .insert({ section: SECTION, key: KEY, value: JSON.stringify(LINKS) });
  if (writeError) throw new Error('write: ' + writeError.message);

  console.log(`  wrote (${SECTION}, ${KEY}) with ${LINKS.length} links`);

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: after } = await db
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', KEY)
    .maybeSingle();

  let stored = null;
  try {
    stored = JSON.parse(after?.value ?? 'null');
  } catch {
    failures.push('the stored value did not parse as JSON');
  }

  if (!Array.isArray(stored)) {
    failures.push('the stored value is not an array');
  } else {
    if (stored.length !== LINKS.length) {
      failures.push(`expected ${LINKS.length} links, found ${stored.length}`);
    }
    for (const want of LINKS) {
      const got = stored.find((l) => l.id === want.id);
      if (!got) {
        failures.push(`missing link ${want.id}`);
        continue;
      }
      for (const field of ['label', 'href', 'column', 'visible']) {
        if (got[field] !== want[field]) {
          failures.push(`${want.id}.${field} is ${JSON.stringify(got[field])}, expected ${JSON.stringify(want[field])}`);
        }
      }
    }
    // The whole point of the seed: three links present but off.
    for (const hidden of ['case-studies', 'insights', 'team']) {
      const got = stored.find((l) => l.id === hidden);
      if (got && got.visible !== false) failures.push(`${hidden} should ship hidden`);
    }
    if (stored.filter((l) => l.href.startsWith('/services/')).length > 0) {
      failures.push('the nine individual service links are back in the footer list');
    }
    const book = stored.find((l) => l.href === '/book');
    if (!book || book.column !== 'contact') {
      failures.push('Book a Meeting is not in the Contact column');
    }
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  ok    9 links stored, 3 hidden, booking in the Contact column. COMPLETE');
}

main().catch((err) => {
  console.error('seed-footer-links failed:', err.message);
  process.exitCode = 1;
});
