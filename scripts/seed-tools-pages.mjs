// scripts/seed-tools-pages.mjs
//
// Applies migration 074_tools_pages.sql through supabase-js: the cms_pages rows
// and hero sections for /tools and /tools/business-valuation.
//
//   npm run seed-tools-pages             apply
//   npm run seed-tools-pages -- --dry-run report only
//
// Idempotent. Rows are inserted only when absent, heroes only on a page with no
// sections. Every write is read back before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGES = [
  {
    slug: 'tools',
    title: 'Free Tools',
    metaTitle: 'Free Tools | PaceMakers Business Consultants',
    metaDescription:
      'Free corporate finance tools from PaceMakers. Indicative business valuation and investor readiness, built on the methods we use on mandates.',
    eyebrow: 'Free tools',
    headline: 'Tools for owners and investors',
    tagline:
      'Practical calculators built on the same methods we use on mandates. Indicative results in minutes, with a report you can keep.',
  },
  {
    slug: 'tool-business-valuation',
    title: 'Business Valuation Tool',
    metaTitle: 'Business Valuation Tool: DCF and Comparables | PaceMakers Business Consultants',
    metaDescription:
      'An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country.',
    eyebrow: 'Free tool',
    headline: 'Value your business with a DCF and comparables',
    tagline:
      'Enter three years of history and a five year forecast. The tool builds free cash flow, a cost of capital from Damodaran market data, and a comparables check, then shows where your value lands.',
  },
];

function heroContent(p) {
  return {
    badge_text: p.eyebrow,
    headline: p.headline,
    subtitle: `<p>${p.tagline}</p>`,
    tags: [],
    cta_label: '',
    cta_href: '',
    cta_secondary_label: '',
    cta_secondary_href: '',
  };
}

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found at ' + envPath);
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const p of PAGES) {
    const { data: existing, error: readErr } = await db.from('cms_pages').select('slug').eq('slug', p.slug).maybeSingle();
    if (readErr) throw new Error(`cms_pages read (${p.slug}): ${readErr.message}`);
    if (existing) console.log(`skip  cms_pages ${p.slug}: exists`);
    else if (DRY_RUN) console.log(`would create cms_pages ${p.slug}`);
    else {
      const { error } = await db.from('cms_pages').insert({
        slug: p.slug,
        title: p.title,
        meta_title: p.metaTitle,
        meta_description: p.metaDescription,
        status: 'published',
        is_system: true,
      });
      if (error) throw new Error(`cms_pages insert (${p.slug}): ${error.message}`);
      console.log(`create cms_pages ${p.slug}`);
    }

    const { data: sections, error: secErr } = await db.from('page_sections').select('id').eq('page_slug', p.slug);
    if (secErr) throw new Error(`page_sections read (${p.slug}): ${secErr.message}`);
    if (sections.length) console.log(`skip  ${p.slug} hero: page has ${sections.length} section(s)`);
    else if (DRY_RUN) console.log(`would create ${p.slug} hero at order 10`);
    else {
      const { error } = await db.from('page_sections').insert({
        page_slug: p.slug,
        section_type: 'hero',
        content: heroContent(p),
        styles: {},
        display_order: 10,
        visible: true,
      });
      if (error) throw new Error(`${p.slug} hero insert: ${error.message}`);
      console.log(`create ${p.slug} hero at order 10`);
    }
  }

  if (DRY_RUN) return console.log('\nDry run, nothing written.');

  const failures = [];
  for (const p of PAGES) {
    const { data: row } = await db.from('cms_pages').select('status').eq('slug', p.slug).maybeSingle();
    if (!row) failures.push(`${p.slug} page missing`);
    else if (row.status !== 'published') failures.push(`${p.slug} is ${row.status}`);
    const { data: heroes } = await db.from('page_sections').select('content').eq('page_slug', p.slug).eq('section_type', 'hero');
    if (heroes?.length !== 1) failures.push(`${p.slug} has ${heroes?.length ?? 0} heroes`);
  }
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f));
    process.exitCode = 1;
  } else console.log('\nAll checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-tools-pages failed:', err.message);
  process.exitCode = 1;
});
