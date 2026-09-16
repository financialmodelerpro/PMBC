// scripts/set-tools-links-visibility.mjs
//
// Shows or hides the two public entry points into the free tools, together:
//   - the "Free Tools" footer link, id `tools` in (footer_settings, links)
//   - the "Try our free valuation tool" cta_block on service-business-valuation
//
// WHY THIS EXISTS
// Migration 075 was applied on 2026-09-16 before /tools was deployed, which put
// both links on the live site pointing at a 404. They were hidden the same day
// with this script, and stay hidden until Unit 3 (results email and PDF report)
// is live on production. That is a decision about when the tool is worth
// promoting, not only about whether the route exists.
//
// Both switches are the same ones an operator uses in Footer Links and the page
// builder, so either can also be flipped from the admin. Nothing is deleted.
//
//   node scripts/set-tools-links-visibility.mjs --hide
//   node scripts/set-tools-links-visibility.mjs --show
//   add --dry-run to report only
//
// Every write is read back before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SHOW = args.has('--show');
if (SHOW === args.has('--hide')) {
  console.error('Pass exactly one of --hide or --show.');
  process.exit(1);
}
const visible = SHOW;

const SERVICE_PAGE = 'service-business-valuation';
const TOOL_HREF = '/tools/business-valuation';

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

async function readState(db) {
  const { data: row, error } = await db
    .from('cms_content')
    .select('value')
    .eq('section', 'footer_settings')
    .eq('key', 'links')
    .maybeSingle();
  if (error) throw new Error('footer links read: ' + error.message);
  const links = row ? JSON.parse(row.value) : null;

  const { data: ctas, error: ctaErr } = await db
    .from('page_sections')
    .select('id, visible, content')
    .eq('page_slug', SERVICE_PAGE)
    .eq('section_type', 'cta_block');
  if (ctaErr) throw new Error('service page read: ' + ctaErr.message);
  const toolCtas = (ctas ?? []).filter((c) => c.content?.cta_primary_href === TOOL_HREF);

  return { links, toolCtas };
}

async function main() {
  loadEnvLocal();
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const word = visible ? 'show' : 'hide';

  const { links, toolCtas } = await readState(db);

  // ---- Footer link ---------------------------------------------------------
  const link = links?.find((l) => l.id === 'tools');
  if (!link) console.log('skip  footer: no stored "tools" link');
  else if (link.visible === visible) console.log(`skip  footer: already ${visible ? 'visible' : 'hidden'}`);
  else if (DRY_RUN) console.log(`would ${word} the footer link`);
  else {
    const next = links.map((l) => (l.id === 'tools' ? { ...l, visible } : l));
    const { error } = await db
      .from('cms_content')
      .update({ value: JSON.stringify(next), updated_at: new Date().toISOString() })
      .eq('section', 'footer_settings')
      .eq('key', 'links');
    if (error) throw new Error('footer links update: ' + error.message);
    console.log(`set   footer link ${visible ? 'visible' : 'hidden'}`);
  }

  // ---- Service page CTA ----------------------------------------------------
  if (toolCtas.length === 0) console.log(`skip  ${SERVICE_PAGE}: no valuation tool CTA`);
  for (const c of toolCtas) {
    if (c.visible === visible) console.log(`skip  CTA ${c.id}: already ${visible ? 'visible' : 'hidden'}`);
    else if (DRY_RUN) console.log(`would ${word} CTA ${c.id}`);
    else {
      const { error } = await db.from('page_sections').update({ visible }).eq('id', c.id);
      if (error) throw new Error('CTA update: ' + error.message);
      console.log(`set   CTA ${c.id} ${visible ? 'visible' : 'hidden'}`);
    }
  }

  if (DRY_RUN) return console.log('\nDry run, nothing written.');

  const after = await readState(db);
  const failures = [];
  const afterLink = after.links?.find((l) => l.id === 'tools');
  if (afterLink && afterLink.visible !== visible) failures.push('footer link did not change');
  for (const c of after.toolCtas) if (c.visible !== visible) failures.push(`CTA ${c.id} did not change`);
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f));
    process.exitCode = 1;
  } else console.log(`\nBoth entry points ${visible ? 'visible' : 'hidden'}. COMPLETE`);
}

main().catch((err) => {
  console.error('set-tools-links-visibility failed:', err.message);
  process.exitCode = 1;
});
