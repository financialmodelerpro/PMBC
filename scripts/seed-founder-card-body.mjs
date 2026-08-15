// scripts/seed-founder-card-body.mjs
//
// Applies migration 062_home_founder_card_body.sql through supabase-js.
//
// The home page stated the delivery model twice on one scroll: in the firm
// introduction at display_order 20, and again in the first paragraph of the
// founder card at 80. The introduction keeps it. The card is rewritten to do
// the job a founder card should do.
//
//   node scripts/seed-founder-card-body.mjs           apply
//   node scripts/seed-founder-card-body.mjs --dry-run report only
//   npm run seed-founder-card-body
//
// Keys are merged into the stored content rather than replacing it, so the
// photo, the proof points, the label added by migration 061 and the CTA are
// untouched.
//
// Re-running restores this wording over anything edited in the builder since.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const PAGE = 'home';
const INTRO_ORDER = 20;
const CARD_ORDER = 80;

const PATCH = {
  eyebrow: 'THE FOUNDING PARTNER',
  headline: 'The judgment behind the numbers.',
  bio_html:
    '<p style="text-align: justify;">Ahmad Din has spent more than twelve years in corporate finance and transaction advisory across Saudi Arabia, the GCC, and Pakistan. He is an ACCA member (UK) and FMVA certified. The work has been concentrated where the numbers have to survive scrutiny: multi-billion riyal mixed-use developments, project finance for renewable and industrial assets, and the valuations and due diligence that decide whether a buyer proceeds.</p>' +
    '<p style="text-align: justify;">What that brings to a mandate is judgment about which assumptions will hold. A model is only as good as the thinking behind its inputs, and knowing which of them survive diligence and which give way under questioning is what separates a defensible number from a plausible one. Where a figure will not hold, you will hear it from him early, while there is still time to change the structure.</p>',
};

/**
 * Phrases that were the actual duplication.
 *
 * Checked as a pair rather than by comparing the two blocks wholesale: the point
 * is not that the paragraphs differ, it is that this specific claim is made in
 * one place. So each phrase must still appear in the introduction and must not
 * appear on the card.
 */
const DELIVERY_MODEL_PHRASES = [
  'reviews every deliverable',
  'Analysts and associates are engaged',
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

const strip = (html) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The longest run of words the two passages share.
 *
 * A secondary guard, not the test. It would not have caught the duplication
 * this migration exists to fix: the two passages made the same claim in
 * different words, and their longest shared run was five words, which is lower
 * than the six the replacement shares with it purely by naming the same
 * geography. Semantic repetition does not show up as verbatim overlap.
 *
 * It earns its place anyway, because the failure it does catch is the other one:
 * a future edit pasting a sentence from one block into the other.
 */
function longestSharedRun(a, b) {
  const wa = a.toLowerCase().split(' ');
  const wb = new Set();
  for (let i = 0; i < b.toLowerCase().split(' ').length; i++) wb.add(i);
  const bw = b.toLowerCase().split(' ');
  let best = 0;
  let bestText = '';
  for (let i = 0; i < wa.length; i++) {
    for (let j = 0; j < bw.length; j++) {
      let k = 0;
      while (i + k < wa.length && j + k < bw.length && wa[i + k] === bw[j + k]) k++;
      if (k > best) {
        best = k;
        bestText = wa.slice(i, i + k).join(' ');
      }
    }
  }
  return { words: best, text: bestText };
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

  const { data: rows, error } = await db
    .from('page_sections')
    .select('id, display_order, section_type, content')
    .eq('page_slug', PAGE)
    .in('display_order', [INTRO_ORDER, CARD_ORDER]);
  if (error) throw new Error('read failed: ' + error.message);

  const intro = (rows ?? []).find((r) => r.display_order === INTRO_ORDER);
  const card = (rows ?? []).find(
    (r) => r.display_order === CARD_ORDER && r.section_type === 'founder_block',
  );
  if (!intro) throw new Error(`no section at display_order ${INTRO_ORDER}.`);
  if (!card) throw new Error(`no founder_block at display_order ${CARD_ORDER}.`);

  const before = card.content ?? {};

  console.log('Founder card body');
  console.log('\n  before:');
  console.log('    eyebrow  ' + JSON.stringify(before.eyebrow ?? null));
  console.log('    headline ' + JSON.stringify(before.headline ?? null));
  console.log('    overlap with the firm introduction: ');
  const overlapBefore = longestSharedRun(strip(intro.content?.html), strip(before.bio_html));
  console.log(`      ${overlapBefore.words} consecutive words: "${overlapBefore.text}"`);

  const changed = Object.keys(PATCH).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(PATCH[k]),
  );
  if (changed.length === 0) {
    console.log('\n  skip  already applied.');
  } else {
    console.log('\n  after:');
    console.log('    eyebrow  ' + JSON.stringify(PATCH.eyebrow));
    console.log('    headline ' + JSON.stringify(PATCH.headline));
    const overlapAfter = longestSharedRun(strip(intro.content?.html), strip(PATCH.bio_html));
    console.log(
      `    overlap with the firm introduction: ${overlapAfter.words} consecutive words: "${overlapAfter.text}"`,
    );

    if (DRY_RUN) {
      console.log('\nDry run, nothing written.');
      return;
    }

    const { error: upErr } = await db
      .from('page_sections')
      .update({ content: { ...before, ...PATCH }, updated_at: new Date().toISOString() })
      .eq('id', card.id);
    if (upErr) throw new Error('update failed: ' + upErr.message);
    console.log('\n  written.');
  }

  if (DRY_RUN) {
    console.log('\nDry run, nothing written.');
    return;
  }

  console.log('\nVerifying...');
  let ok = true;

  const { data: after } = await db
    .from('page_sections')
    .select('display_order, content')
    .eq('page_slug', PAGE)
    .in('display_order', [INTRO_ORDER, CARD_ORDER]);
  const introText = strip(
    (after ?? []).find((r) => r.display_order === INTRO_ORDER)?.content?.html,
  );
  const cardContent = (after ?? []).find((r) => r.display_order === CARD_ORDER)?.content ?? {};
  const cardText = strip(cardContent.bio_html);

  // The delivery model is stated once, in the introduction.
  for (const phrase of DELIVERY_MODEL_PHRASES) {
    const inIntro = introText.toLowerCase().includes(phrase.toLowerCase());
    const onCard = cardText.toLowerCase().includes(phrase.toLowerCase());
    if (inIntro && !onCard) {
      console.log(`  ok    "${phrase}" appears in the introduction only.`);
    } else {
      console.error(
        `  FAIL  "${phrase}" intro=${inIntro} card=${onCard}. It should be in the introduction and not on the card.`,
      );
      ok = false;
    }
  }

  // And the heading is no longer a third statement of it.
  if (/partner-led/i.test(String(cardContent.headline ?? '') + String(cardContent.eyebrow ?? ''))) {
    console.error('  FAIL  the card heading or eyebrow still restates partner-led delivery.');
    ok = false;
  } else {
    console.log('  ok    the card heading and eyebrow frame the person, not the model.');
  }

  // Blunt overlap check, to catch a future edit reintroducing shared prose.
  const overlap = longestSharedRun(introText, cardText);
  if (overlap.words <= 6) {
    console.log(
      `  ok    longest shared run with the introduction is ${overlap.words} words ("${overlap.text}").`,
    );
  } else {
    console.error(
      `  FAIL  ${overlap.words} consecutive words shared with the introduction: "${overlap.text}"`,
    );
    ok = false;
  }

  // The card still carries everything else it had.
  for (const k of ['photo_url', 'credentials', 'credentials_label', 'cta_primary_label']) {
    if (cardContent[k] === undefined || cardContent[k] === null || cardContent[k] === '') {
      console.error(`  FAIL  the card lost ${k}.`);
      ok = false;
    }
  }
  if (ok) console.log('  ok    photo, proof points, their label and the CTA are intact.');

  if (ok) {
    console.log('\nCOMPLETE.');
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('seed-founder-card-body failed:', err.message);
  process.exitCode = 1;
});
