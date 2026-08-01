// scripts/extract-fmp-ports.mjs
// MIGRATION_PLAN.md Phase A, step 3: copy the port candidates out of the
// "PMBC from FMP/" tree before it is deleted.
//
// The tree is UNTRACKED, so deleting it is unrecoverable unless it has been
// archived first. This script does the file-level half of that: it copies an
// explicit allowlist to a staging directory OUTSIDE the repo, writes a
// manifest with sha256 for each file, and prints everything it did NOT copy so
// the operator can confirm nothing was missed before deleting.
//
// It never copies a whole directory. Copying recursively would drag in
// node_modules and .next, and would quietly pick up files nobody reviewed.
//
// Filesystem only. This script never touches the database.
//
// Usage:
//   node scripts/extract-fmp-ports.mjs
//   node scripts/extract-fmp-ports.mjs --staging "D:/PMBC/_fmp-ports"

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const SOURCE_DIR = path.join(projectRoot, 'PMBC from FMP');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Default staging sits beside the repo, not inside it, so the copies cannot be
// picked up by tsc, next build, or git.
const STAGING_DIR = path.resolve(
  arg('--staging', path.join(projectRoot, '..', '_fmp-ports-2026-08-01')),
);

/**
 * The allowlist from MIGRATION_PLAN.md Appendix A. `to` records the intended
 * destination inside the PMBC tree; the copy itself is flat under staging so
 * nothing can be accidentally imported before it has been reviewed.
 */
const FILES = [
  { from: 'src/shared/utils/externalUrl.ts',                    to: 'src/lib/utils/externalUrl.ts' },
  { from: 'src/shared/cms/scheduling.ts',                       to: 'src/lib/cms/scheduling.ts (strip cron references)' },
  { from: 'src/components/admin/CategoryMultiSelect.tsx',       to: 'rewire to article_categories' },
  { from: 'src/components/admin/ArticleSeriesField.tsx',        to: 'rewire to article_series' },
  { from: 'src/components/admin/InstructorPicker.tsx',          to: 'rename to AuthorPicker, point at authors' },
  { from: 'src/components/admin/ArticleWriterField.tsx',        to: 'byline snapshot' },
  { from: 'src/components/admin/ArticleAuthorAboutFields.tsx',  to: 'byline snapshot' },
  { from: 'src/components/admin/ArticleScheduleField.tsx',      to: 're-document the guarantee' },
  { from: 'src/components/admin/ArticleExtraFields.tsx',        to: 'mid image, tags, og image' },
  { from: 'src/components/admin/LocalDateTime.tsx',             to: 'as is' },
  { from: 'app/api/admin/articles/slug-check/route.ts',         to: 'src/app/api/admin/articles/slug-check/route.ts' },
  // Reference only. Never execute this against the PMBC database: it is
  // CREATE TABLE IF NOT EXISTS throughout and would silently no-op against the
  // live schema while reporting success. See MIGRATION_PLAN.md risk R1.
  { from: 'supabase/migrations/001_cms_schema.sql',             to: 'REFERENCE ONLY, never execute (R1)' },

  // ---- FMP admin parity reference (added 2026-08-01) ----
  // Appendix A's allowlist was written for the Articles migration only. The
  // remaining parity phases in ADMIN_PARITY_GAP.md are implemented BY READING
  // FMP's real code, because CMS_REFERENCE.md is a stale snapshot marked "no
  // behavioral contract". Deleting the tree with only the 12 files above would
  // throw away the source for Phases 3 to 8. These are reference material, not
  // files to port verbatim (they are Next 16 / TipTap 2 / NextAuth-free).
  { from: 'src/components/admin/RichTextEditor.tsx',            to: 'REFERENCE, parity Phase 6 (toolbar upgrades)' },
  { from: 'src/components/admin/RichTextarea.tsx',              to: 'REFERENCE, parity Phase 6 (compact editor)' },
  { from: 'src/components/admin/MediaPicker.tsx',               to: 'REFERENCE, MediaPickerButton API' },
  { from: 'src/components/admin/CmsAdminNav.tsx',               to: 'REFERENCE, sidebar behaviour + colours' },
  { from: 'src/components/admin/ArticleBodyEditor.tsx',         to: 'REFERENCE, parity Phase D (articles)' },
  { from: 'src/components/admin/DeleteArticleButton.tsx',       to: 'REFERENCE, parity Phase D (articles)' },
  { from: 'app/admin/page-builder/[slug]/page.tsx',             to: 'REFERENCE, parity Phases 3/4/5 (per-section save, StyleEditor)' },
  { from: 'app/admin/page-builder/page.tsx',                    to: 'REFERENCE, parity Phase 4 (New Page templates)' },
  { from: 'app/admin/header-settings/page.tsx',                 to: 'REFERENCE, parity Phase 1 (done, kept for diffing)' },
  { from: 'app/admin/content/page.tsx',                         to: 'REFERENCE, parity Phase 7 (tabbed content)' },
  { from: 'app/admin/pages/page.tsx',                           to: 'REFERENCE, parity Phase 8 (inline edit)' },
  { from: 'app/admin/testimonials/page.tsx',                    to: 'REFERENCE, parity Phase 8 (approval workflow)' },
  { from: 'app/admin/media/page.tsx',                           to: 'REFERENCE, media library' },
  { from: 'app/admin/cms/page.tsx',                             to: 'REFERENCE, dashboard layout' },
  { from: 'app/api/admin/page-sections/route.ts',               to: 'REFERENCE, action-discriminator API shape' },
  { from: 'app/api/admin/pages/route.ts',                       to: 'REFERENCE, create_page action' },
  { from: 'src/styles/design-tokens.css',                       to: 'REFERENCE, FMP admin colour tokens' },
];

/** Directories whose contents are noise, excluded from the "not copied" report. */
const NOISE = new Set(['node_modules', '.next', '.git']);

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (NOISE.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log(`Source "${SOURCE_DIR}" does not exist. Already extracted and deleted.`);
    process.exit(0);
  }

  fs.mkdirSync(STAGING_DIR, { recursive: true });
  console.log(`Source : ${SOURCE_DIR}`);
  console.log(`Staging: ${STAGING_DIR}\n`);

  const manifest = [];
  const copied = new Set();
  let missing = 0;

  for (const item of FILES) {
    const src = path.join(SOURCE_DIR, item.from);
    if (!fs.existsSync(src)) {
      console.log(`  MISSING  ${item.from}`);
      missing++;
      continue;
    }
    const destName = item.from.split('/').join('__');
    const dest = path.join(STAGING_DIR, destName);
    fs.copyFileSync(src, dest);
    const hash = sha256(src);
    manifest.push({
      source: item.from,
      staged: destName,
      intendedDestination: item.to,
      sha256: hash,
      bytes: fs.statSync(src).size,
    });
    copied.add(item.from);
    console.log(`  copied   ${item.from}`);
  }

  // Full snapshot of everything else, so the delete decision is informed.
  const all = walk(SOURCE_DIR);
  const notCopied = all.filter((f) => !copied.has(f));

  fs.writeFileSync(
    path.join(STAGING_DIR, 'MANIFEST.json'),
    JSON.stringify(
      {
        extractedAtNote: 'Timestamp intentionally omitted; see the git archive tag.',
        sourceDir: 'PMBC from FMP',
        copied: manifest,
        notCopiedCount: notCopied.length,
        notCopied,
      },
      null,
      2,
    ),
  );

  console.log(`\nCopied ${manifest.length}/${FILES.length} files.`);
  if (missing) console.log(`${missing} allowlisted file(s) were missing.`);
  console.log(`\nNOT copied (${notCopied.length} files, excluding node_modules/.next/.git):`);
  for (const f of notCopied) console.log(`  ${f}`);
  console.log(`\nManifest written to ${path.join(STAGING_DIR, 'MANIFEST.json')}`);
  console.log('Review the not-copied list above before deleting the source tree.');
}

main();
