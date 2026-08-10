// scripts/seed-home-hero-eyebrow.mjs
//
// Applies migration 041_home_hero_eyebrow.sql through supabase-js.
//
// Replaces the home hero eyebrow, which repeated the brand name already shown
// in the logo directly above it, with the discipline.
//
//   node scripts/seed-home-hero-eyebrow.mjs           apply
//   node scripts/seed-home-hero-eyebrow.mjs --dry-run report only
//   npm run seed-home-hero-eyebrow
//
// Idempotent and non-destructive: guarded on the old value, so a re-run after an
// operator has rewritten the eyebrow leaves their wording alone. The write is
// read back and compared before success is reported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const OLD = 'PACEMAKERS BUSINESS CONSULTANTS';
const NEW = 'CORPORATE FINANCE AND TRANSACTION ADVISORY';

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
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: hero, error } = await db
    .from('page_sections')
    .select('id, content')
    .eq('page_slug', 'home')
    .eq('section_type', 'hero')
    .maybeSingle();
  if (error) throw new Error('home hero read failed: ' + error.message);
  if (!hero) {
    console.log('No hero section on /home. Nothing to do.');
    return;
  }

  const current = String(hero.content?.badge_text ?? '');

  if (current === NEW) {
    console.log(`skip  eyebrow is already "${NEW}"`);
    return;
  }
  if (current !== OLD) {
    console.log(
      `skip  eyebrow is "${current}", not the expected "${OLD}". Left alone, an operator edit outranks this migration.`,
    );
    return;
  }
  if (DRY_RUN) {
    console.log(`would set home hero eyebrow to "${NEW}" (was "${OLD}")`);
    console.log('\nDry run, nothing written.');
    return;
  }

  const next = { ...(hero.content ?? {}), badge_text: NEW };
  const { data: updated, error: upErr } = await db
    .from('page_sections')
    .update({ content: next, updated_at: new Date().toISOString() })
    .eq('id', hero.id)
    .select('id, content');
  if (upErr) throw new Error('update failed: ' + upErr.message);
  if (!updated || updated.length !== 1) {
    throw new Error(`update matched ${updated?.length ?? 0} rows, expected 1`);
  }
  console.log(`set   home hero eyebrow to "${NEW}"`);

  console.log('\nVerifying...');
  const { data: final } = await db
    .from('page_sections')
    .select('content')
    .eq('id', hero.id)
    .single();
  const failures = [];
  if (final?.content?.badge_text !== NEW) {
    failures.push(`badge_text is "${final?.content?.badge_text}", expected "${NEW}"`);
  }
  // The rest of the hero must be untouched: a botched merge here would blank the
  // headline or the CTAs on the site's most important section.
  for (const k of ['headline', 'subtitle', 'cta_label', 'cta_href', 'cta_secondary_label']) {
    if (final?.content?.[k] !== hero.content?.[k]) {
      failures.push(`${k} changed unexpectedly`);
    }
  }
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log('  Eyebrow updated, every other hero field byte-identical. COMPLETE');
}

main().catch((err) => {
  console.error('seed-home-hero-eyebrow failed:', err.message);
  process.exitCode = 1;
});
