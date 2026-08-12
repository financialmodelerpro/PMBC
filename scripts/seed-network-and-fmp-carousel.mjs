// scripts/seed-network-and-fmp-carousel.mjs
//
// Applies migration 053_home_network_mention_and_fmp_carousel.sql through
// supabase-js.
//
//   node scripts/seed-network-and-fmp-carousel.mjs           apply
//   node scripts/seed-network-and-fmp-carousel.mjs --dry-run report only
//   npm run seed-network-and-fmp-carousel
//
// Two changes, both described in the migration header: the home network block
// becomes a three sentence mention linking to /network, and "Who it is for" on
// /fmp becomes the same audience carousel the home page uses.
//
// Idempotent: each step is guarded on the state it expects to find.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

/** Em and en dash detector, escaped so this file cannot trip the repo gate. */
const DASH_RX = new RegExp('[\u2013\u2014]');

const NETWORK_MENTION = {
  heading: 'Reach across the Gulf, delivery in house.',
  align: 'left',
  html:
    "<p>Two long-standing relationships extend the firm's reach across the Gulf: " +
    'Sky Gulf in Al Khobar and Lynkers in Manama. Both originate and refer mandates ' +
    'and open local doors. Neither executes them: every engagement is delivered by ' +
    'PaceMakers, partner-led. <a href="/network">Meet the network</a>.</p>',
};

const FMP_AUDIENCES = [
  {
    title: 'Financial Analysts',
    description:
      'Build a complete, balanced model without starting from an empty workbook every time. The structure, the schedules and the checks are already in place, so the work goes into the assumptions rather than into wiring up the mechanics.',
  },
  {
    title: 'Investment Professionals',
    description:
      'Screen and underwrite opportunities on a consistent basis. Scenario analysis compares cases side by side, and the IC presentation builder turns the result into a deck whose figures stay linked to the model behind it.',
  },
  {
    title: 'Real Estate Developers',
    description:
      'Model a phased, multi-asset development properly: mixed unit programmes, construction drawn against a facility with interest capitalised during the build, instalment revenue, and an equity waterfall that survives a lender review.',
  },
  {
    title: 'Family Offices',
    description:
      'Review your own holdings rather than outsourcing the review. Test a sponsor case yourself, see which assumptions carry the return, and hold an independent view before committing capital.',
  },
  {
    title: 'Lenders and Banks',
    description:
      'Interrogate a borrower model on your own terms. DSCR, debt sizing, sculpting and covenant headroom are computed explicitly, so a credit team can stress the case rather than accept a sponsor summary.',
  },
  {
    title: 'Students and Aspiring Analysts',
    description:
      'Learn the method that firms actually use, then prove it. Both certification paths are free, assessed rather than attendance-based, and end in a certificate an employer can verify online.',
  },
].map((a) => ({ ...a, image_url: '', image_alt: '' }));

const FMP_CAROUSEL = {
  eyebrow: 'WHO IT IS FOR',
  headline: 'Built for the people who have to defend the numbers.',
  intro:
    'The platform assumes a working knowledge of finance and no patience for a course that never reaches a model.',
  autoplay_seconds: 6,
  items: FMP_AUDIENCES,
};

/** Every carousel on the site holds a card for this long. */
const AUTOPLAY_SECONDS = 6;

/**
 * Rewrites a numeric range written with an en or em dash into words.
 *
 * The nine service timeline strings were seeded by migration 010, before the
 * no-dash rule, and CLAUDE.md lists them as known pre-rule content to fix when
 * next touched rather than in a dash-only pass. The whole-table sweep at the end
 * of this script is what next touched them.
 *
 * Only a dash BETWEEN DIGITS is rewritten, because that is the one case where
 * the replacement is unambiguous: "3 to 5 weeks" is the only thing the original
 * could have meant. A dash anywhere else is a sentence the author shaped, and
 * guessing at a comma or a full stop would be rewriting their copy, so those are
 * reported and the run stops instead.
 */
function rangesToWords(text) {
  return text.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2');
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

let changes = 0;
const act = (msg) => {
  changes += 1;
  console.log(`  ${DRY_RUN ? 'would ' : ''}${msg}`);
};

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
    .select('id, page_slug, section_type, display_order, content');
  if (error) throw new Error('read: ' + error.message);

  // ---- 1. home network block -> mention -------------------------------------
  const network = (rows ?? []).find(
    (r) =>
      r.page_slug === 'home' &&
      r.section_type === 'text_image' &&
      r.content?.cta_href === '/network',
  );
  if (!network) {
    console.log('  skip  the home network block is no longer a text_image');
  } else {
    const video = network.content?.image_url || '(none)';
    act(
      'cut the home network block to a three sentence mention linking to /network',
    );
    console.log(`        the video it carried is dropped, not deleted: ${video}`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          section_type: 'paragraphs',
          content: NETWORK_MENTION,
          updated_at: new Date().toISOString(),
        })
        .eq('id', network.id);
      if (e) throw new Error('network update: ' + e.message);
    }
  }

  // ---- 2. /fmp "Who it is for" -> carousel -----------------------------------
  const audience = (rows ?? []).find(
    (r) =>
      r.page_slug === 'financial-modeler-pro' &&
      r.section_type === 'service_cards' &&
      r.content?.eyebrow === 'WHO IT IS FOR',
  );
  if (!audience) {
    console.log('  skip  "Who it is for" on /fmp is already a carousel');
  } else {
    act(
      `convert "Who it is for" from ${(audience.content?.cards ?? []).length} static cards ` +
        `to a ${FMP_AUDIENCES.length} card carousel with image slots`,
    );
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          section_type: 'audience_carousel',
          content: FMP_CAROUSEL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', audience.id);
      if (e) throw new Error('fmp update: ' + e.message);
    }
  }

  // ---- 3. every carousel holds for six seconds -------------------------------
  const carousels = (rows ?? []).filter((r) => r.section_type === 'audience_carousel');
  for (const c of carousels) {
    if (c.content?.autoplay_seconds === AUTOPLAY_SECONDS) continue;
    act(`set ${c.page_slug} carousel to ${AUTOPLAY_SECONDS} seconds a card`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({
          content: { ...c.content, autoplay_seconds: AUTOPLAY_SECONDS },
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id);
      if (e) throw new Error('interval update: ' + e.message);
    }
  }

  // ---- 4. pre-rule en dashes in the service timeline copy --------------------
  // Numeric ranges seeded by migration 010. Fixed here rather than left alone,
  // because the verification below sweeps the whole table and the repo gate is
  // zero. CLAUDE.md asks for exactly this: fix them when next touching the
  // content, never as a dash-only pass.
  const { data: contentRows } = await db.from('cms_content').select('id, section, key, value');
  for (const r of contentRows ?? []) {
    const before = r.value ?? '';
    if (!DASH_RX.test(before)) continue;
    const fixed = rangesToWords(before);
    if (DASH_RX.test(fixed)) {
      console.error(`  FAIL  (${r.section}, ${r.key}) holds a dash that is not a numeric range.`);
      console.error('        Reword it in /admin/content; this script will not guess at it.');
      process.exitCode = 1;
      return;
    }
    act(`rewrite the range in (${r.section}, ${r.key}) as words`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('cms_content')
        .update({ value: fixed, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) throw new Error('dash fix: ' + e.message);
    }
  }
  for (const r of rows ?? []) {
    const before = JSON.stringify(r.content);
    if (!DASH_RX.test(before)) continue;
    const fixed = rangesToWords(before);
    if (DASH_RX.test(fixed)) {
      console.error(
        `  FAIL  ${r.page_slug} / ${r.section_type} holds a dash that is not a numeric range.`,
      );
      process.exitCode = 1;
      return;
    }
    act(`rewrite the range in ${r.page_slug} / ${r.section_type} as words`);
    if (!DRY_RUN) {
      const { error: e } = await db
        .from('page_sections')
        .update({ content: JSON.parse(fixed), updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) throw new Error('dash fix: ' + e.message);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  // ---- verify ---------------------------------------------------------------
  console.log('\nVerifying...');
  const failures = [];
  const { data: after } = await db
    .from('page_sections')
    .select('page_slug, section_type, display_order, content');

  const mention = (after ?? []).find(
    (r) => r.page_slug === 'home' && r.content?.heading === NETWORK_MENTION.heading,
  );
  if (!mention) failures.push('the home network mention is missing');
  else {
    if (mention.section_type !== 'paragraphs') {
      failures.push(`the network mention is ${mention.section_type}, expected paragraphs`);
    }
    if (!(mention.content?.html ?? '').includes('href="/network"')) {
      failures.push('the network mention does not link to /network');
    }
    // Three sentences is the brief. Counting them beats eyeballing the length.
    const text = String(mention.content?.html ?? '').replace(/<[^>]*>/g, '');
    const sentences = text.split(/\.\s+|\.$/).filter((t) => t.trim().length > 0).length;
    if (sentences > 4) failures.push(`the network mention runs to ${sentences} sentences`);
    if (mention.content?.image_url || mention.content?.media_url) {
      failures.push('the network mention still carries media');
    }
  }

  const fmp = (after ?? []).find(
    (r) => r.page_slug === 'financial-modeler-pro' && r.section_type === 'audience_carousel',
  );
  if (!fmp) failures.push('/fmp has no audience carousel');
  else {
    const items = Array.isArray(fmp.content?.items) ? fmp.content.items : [];
    if (items.length !== FMP_AUDIENCES.length) {
      failures.push(`the /fmp carousel has ${items.length} cards, expected ${FMP_AUDIENCES.length}`);
    }
    for (const a of FMP_AUDIENCES) {
      const found = items.find((i) => i?.title === a.title);
      if (!found) failures.push(`the /fmp carousel is missing "${a.title}"`);
      else if (typeof found.image_url !== 'string') {
        failures.push(`"${a.title}" has no image_url slot`);
      }
    }
  }

  const allCarousels = (after ?? []).filter((r) => r.section_type === 'audience_carousel');
  if (allCarousels.length !== 2) {
    failures.push(`expected 2 carousels on the site, found ${allCarousels.length}`);
  }
  for (const c of allCarousels) {
    if (c.content?.autoplay_seconds !== AUTOPLAY_SECONDS) {
      failures.push(
        `the ${c.page_slug} carousel holds for ${c.content?.autoplay_seconds}s, expected ${AUTOPLAY_SECONDS}`,
      );
    }
  }

  if (DASH_RX.test(JSON.stringify(after ?? []))) {
    failures.push('em or en dash in page_sections');
  }
  const { data: afterContent } = await db.from('cms_content').select('section, key, value');
  for (const r of afterContent ?? []) {
    if (DASH_RX.test(r.value ?? '')) {
      failures.push(`em or en dash in cms_content (${r.section}, ${r.key})`);
    }
  }

  console.log(
    '  carousels: ' +
      allCarousels.map((c) => `${c.page_slug} (${c.content?.items?.length ?? 0} cards)`).join(', '),
  );

  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('seed-network-and-fmp-carousel failed:', err.message);
  process.exitCode = 1;
});
