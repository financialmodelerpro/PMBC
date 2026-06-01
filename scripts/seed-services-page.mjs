// scripts/seed-services-page.mjs
// JS-side equivalent of supabase/migrations/019_seed_services_page_content.sql.
// Seeds the /services overview intro. The route renders CMS page_sections ABOVE
// a static, config-driven "Practice Areas" 9-card grid (which carries its own
// heading), so the only CMS section here is a hero header. Replaces all
// page_sections rows for page_slug='services'. Safe to re-run (DELETE + INSERT).
//
// All copy is em-dash and en-dash free per the Content Style Rules in CLAUDE.md.
//
// Run: node scripts/seed-services-page.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SECTIONS = [
  {
    display_order: 10,
    section_type: 'hero',
    content: {
      badge_text: 'WHAT WE DO',
      headline: 'Corporate finance, end to end.',
      subtitle:
        'From the first model to the final close: valuation, due diligence, M&A, project finance, and the documentation that gets a deal done. Each engagement is led directly by the partner.',
      cta_label: 'Start a Conversation',
      cta_href: '/contact',
      cta_secondary_label: 'Our Approach',
      cta_secondary_href: '/approach',
      background_style: 'light',
    },
  },
];

async function main() {
  console.log('Phase 9: Seeding services overview intro');

  console.log('  Deleting existing services page_sections rows...');
  const { error: delErr, count: delCount } = await sb
    .from('page_sections')
    .delete({ count: 'exact' })
    .eq('page_slug', 'services');
  if (delErr) throw delErr;
  console.log(`  Deleted ${delCount ?? 0} rows.`);

  console.log(`  Inserting ${SECTIONS.length} new section(s)...`);
  const rows = SECTIONS.map((s) => ({
    page_slug: 'services',
    section_type: s.section_type,
    content: s.content,
    styles: {},
    display_order: s.display_order,
    visible: true,
  }));
  const { data: inserted, error: insErr } = await sb
    .from('page_sections')
    .insert(rows)
    .select('section_type, display_order');
  if (insErr) throw insErr;
  console.log(`  Inserted ${inserted?.length ?? 0} row(s).`);

  console.log('  Bumping cms_pages.updated_at for services...');
  const { error: pageErr } = await sb
    .from('cms_pages')
    .update({ updated_at: new Date().toISOString() })
    .eq('slug', 'services');
  if (pageErr) throw pageErr;

  console.log('\nVerifying page_sections (page_slug=services)...');
  const { data: verify, error: verifyErr } = await sb
    .from('page_sections')
    .select('display_order, section_type')
    .eq('page_slug', 'services')
    .order('display_order', { ascending: true });
  if (verifyErr) throw verifyErr;
  for (const row of verify ?? []) {
    console.log(`  ${String(row.display_order).padStart(3, ' ')}  ${row.section_type}`);
  }
  console.log(`Total rows: ${verify?.length ?? 0}`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
