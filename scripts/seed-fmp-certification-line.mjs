// scripts/seed-fmp-certification-line.mjs
//
// Applies migration 055_fmp_certification_line.sql through supabase-js.
//
//   node scripts/seed-fmp-certification-line.mjs           apply
//   node scripts/seed-fmp-certification-line.mjs --dry-run report only
//   npm run seed-fmp-certification-line
//
// Replaces the /fmp band that listed the two certification paths with a short
// statement and a link to the catalogue. See the migration header for why: the
// band carried session counts, hour counts and course UUIDs that PMBC has no
// way of knowing have changed.
//
// The row is updated in place, so it keeps its id, display_order and styles.
// Idempotent and guarded: the update only fires while the band is still the
// feature_cards version.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'financial-modeler-pro';

const CONTENT = {
  eyebrow: 'CERTIFICATION',
  headline: 'Free professional certification.',
  subhead:
    'Financial Modeler Pro runs its certification courses free, with no subscription and no paywall. Each path is assessed rather than attendance-based, and ends in a certificate carrying a unique ID that an employer or an institution can verify online.',
  cta_primary_label: 'Browse Free Courses',
  cta_primary_href: 'https://app.financialmodelerpro.com/training',
};

/** Strings that must not survive anywhere on this page once the band is gone. */
const RETIRED = ['3SFM', 'BVM', '17 Sessions', '6 Lessons', 'football field'];

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

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, section_type, content, display_order')
    .eq('page_slug', PAGE)
    .order('display_order', { ascending: true });
  if (error) throw new Error('read: ' + error.message);

  const band = (rows ?? []).find(
    (r) => r.section_type === 'feature_cards' && r.content?.eyebrow === 'CERTIFICATION',
  );

  if (!band) {
    const already = (rows ?? []).find(
      (r) => r.section_type === 'cta_block' && r.content?.eyebrow === 'CERTIFICATION',
    );
    console.log(
      already
        ? '  skip  the certification band is already the short version'
        : '  skip  no certification band found on /fmp',
    );
    if (!already) {
      process.exitCode = 1;
      return;
    }
  } else {
    const cardCount = Array.isArray(band.content?.cards) ? band.content.cards.length : 0;
    console.log(
      `  ${DRY_RUN ? 'would ' : ''}replace the certification band (${cardCount} course card(s)) at order ${band.display_order} with a short statement and one CTA`,
    );
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          section_type: 'cta_block',
          content: CONTENT,
          updated_at: new Date().toISOString(),
        })
        .eq('id', band.id);
      if (e) throw new Error('update: ' + e.message);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];

  const { data: after } = await db
    .from('page_sections')
    .select('id, section_type, content, display_order, visible')
    .eq('page_slug', PAGE)
    .order('display_order', { ascending: true });

  const cta = (after ?? []).find(
    (r) => r.section_type === 'cta_block' && r.content?.eyebrow === 'CERTIFICATION',
  );
  if (!cta) {
    failures.push('the certification band is not a cta_block');
  } else {
    if (cta.content.headline !== CONTENT.headline) failures.push('headline did not take');
    if (cta.content.cta_primary_href !== CONTENT.cta_primary_href) {
      failures.push('the CTA does not point at the FMP course catalogue');
    }
    if (cta.content.cards) failures.push('the course cards are still on the row');
    if (!cta.visible) failures.push('the band is hidden');
  }

  // A sweep over the whole page rather than only the row edited above: the
  // point is that no course-specific figure survives anywhere on /fmp, not that
  // one row changed.
  const pageJson = JSON.stringify(after ?? []);
  for (const term of RETIRED) {
    if (pageJson.includes(term)) failures.push(`"${term}" still appears on /fmp`);
  }

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(
    `  ok    ${(after ?? []).length} sections on /fmp, none naming a specific course. COMPLETE`,
  );
}

main().catch((err) => {
  console.error('seed-fmp-certification-line failed:', err.message);
  process.exitCode = 1;
});
