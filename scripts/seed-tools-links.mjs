// scripts/seed-tools-links.mjs
//
// Applies migration 075_tools_links.sql through supabase-js: the "Free Tools"
// footer link and the "Try our free valuation tool" CTA on the Business
// Valuation service page.
//
// RUN ONLY AFTER /tools IS LIVE ON PRODUCTION. Previews share the production
// database, so running it earlier puts a link to a 404 in the live footer.
//
// STATUS: 075 was applied by hand on 2026-09-16 ahead of the deploy, and both
// links were hidden the same day with `set-tools-links-visibility.mjs --hide`.
// They stay hidden until Unit 3 is live; show them with `--show`, not by
// re-running this script, which skips links that already exist.
//
//   npm run seed-tools-links             apply
//   npm run seed-tools-links -- --dry-run report only
//
// Idempotent. The footer link is appended after Financial Modeler Pro only when
// no link with id `tools` exists, keeping every other link and its order. The
// CTA is inserted only when the service page has no cta_block.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

const FOOTER_LINK = { id: 'tools', label: 'Free Tools', href: '/tools', column: 'firm', visible: true };
const SERVICE_PAGE = 'service-business-valuation';
const CTA = {
  eyebrow: 'Free tool',
  headline: 'Try our free valuation tool',
  subhead:
    '<p>An indicative equity value range from a DCF and a comparables check, using Damodaran market data for your industry and country. About ten minutes, with a report you can keep.</p>',
  cta_primary_label: 'Open the valuation tool',
  cta_primary_href: '/tools/business-valuation',
  cta_secondary_label: '',
  cta_secondary_href: '',
};

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

  // ---- 1. Footer link ------------------------------------------------------
  const { data: row, error: readErr } = await db
    .from('cms_content')
    .select('value')
    .eq('section', 'footer_settings')
    .eq('key', 'links')
    .maybeSingle();
  if (readErr) throw new Error('footer links read: ' + readErr.message);

  if (!row) {
    console.log('skip  footer: no stored links row, so the footer uses DEFAULT_FOOTER_LINKS, which already has Free Tools');
  } else {
    const links = JSON.parse(row.value);
    if (links.some((l) => l.id === FOOTER_LINK.id)) {
      console.log('skip  footer: a "tools" link already exists');
    } else {
      const at = links.findIndex((l) => l.id === 'fmp');
      const next = [...links];
      next.splice(at === -1 ? next.length : at + 1, 0, FOOTER_LINK);
      if (DRY_RUN) console.log(`would add Free Tools to the footer at position ${(at === -1 ? links.length : at + 1) + 1}`);
      else {
        const { error } = await db
          .from('cms_content')
          .update({ value: JSON.stringify(next), updated_at: new Date().toISOString() })
          .eq('section', 'footer_settings')
          .eq('key', 'links');
        if (error) throw new Error('footer links update: ' + error.message);
        console.log('set   footer: Free Tools added after Financial Modeler Pro');
      }
    }
  }

  // ---- 2. Service page CTA -------------------------------------------------
  const { data: ctas, error: ctaErr } = await db
    .from('page_sections')
    .select('id')
    .eq('page_slug', SERVICE_PAGE)
    .eq('section_type', 'cta_block');
  if (ctaErr) throw new Error('service page read: ' + ctaErr.message);
  if (ctas.length) console.log(`skip  ${SERVICE_PAGE}: already has a cta_block`);
  else if (DRY_RUN) console.log(`would add the valuation tool CTA to ${SERVICE_PAGE} at order 20`);
  else {
    const { error } = await db.from('page_sections').insert({
      page_slug: SERVICE_PAGE,
      section_type: 'cta_block',
      content: CTA,
      styles: {},
      display_order: 20,
      visible: true,
    });
    if (error) throw new Error('service page CTA insert: ' + error.message);
    console.log(`create ${SERVICE_PAGE} CTA at order 20`);
  }

  if (DRY_RUN) return console.log('\nDry run, nothing written.');

  const failures = [];
  const { data: after } = await db.from('cms_content').select('value').eq('section', 'footer_settings').eq('key', 'links').maybeSingle();
  if (after && !JSON.parse(after.value).some((l) => l.id === 'tools' && l.href === '/tools')) failures.push('footer link missing');
  const { data: ctaAfter } = await db.from('page_sections').select('content').eq('page_slug', SERVICE_PAGE).eq('section_type', 'cta_block');
  if (!ctaAfter?.some((c) => c.content?.cta_primary_href === '/tools/business-valuation')) failures.push('service page CTA missing');
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f));
    process.exitCode = 1;
  } else console.log('\nAll checks passed. COMPLETE');
}

main().catch((err) => {
  console.error('seed-tools-links failed:', err.message);
  process.exitCode = 1;
});
