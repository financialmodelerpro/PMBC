// scripts/configure-storage-buckets.mjs
//
// Sets a real `file_size_limit` on the four storage buckets.
//
// WHY THIS EXISTS
// Uploads go straight from the browser to Supabase Storage through a signed
// URL, so the API route never sees the bytes and cannot measure them. It
// checks the size the browser DECLARES before signing, which is enough to give
// an operator a clear error, but a declared size is a claim, not a fact.
// Setting the limit on the bucket makes storage itself enforce the ceiling, so
// the number the admin states is the number that actually applies.
//
// The ceiling is the video limit, since that is the largest thing any bucket
// legitimately holds. Per-type limits (10 MB for images) stay in the route,
// which knows the content type.
//
// Not a SQL migration: bucket configuration lives behind the storage admin
// API, and supabase-js cannot run the ALTER that would change storage.buckets
// directly.
//
//   node scripts/configure-storage-buckets.mjs           apply
//   node scripts/configure-storage-buckets.mjs --dry-run report only
//   npm run configure-storage-buckets
//
// Idempotent: a bucket already at the target limit is skipped.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const BUCKETS = ['cms-assets', 'article-covers', 'case-study-images', 'team-photos'];
// Kept in step with MAX_VIDEO_BYTES in src/lib/media.ts by hand: this script is
// plain node and cannot import a TypeScript module. The verification script
// asserts the two agree, so a change to one that misses the other fails.
const LIMIT_BYTES = 25 * 1024 * 1024;

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
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: existing, error: listErr } = await db.storage.listBuckets();
  if (listErr) throw new Error('list buckets: ' + listErr.message);

  let changes = 0;
  for (const name of BUCKETS) {
    const bucket = (existing ?? []).find((b) => b.name === name);
    if (!bucket) {
      console.log(`  WARN  ${name}: not found, skipping`);
      continue;
    }
    if (bucket.file_size_limit === LIMIT_BYTES) {
      console.log(`  skip  ${name}: already at ${LIMIT_BYTES} bytes`);
      continue;
    }
    changes += 1;
    console.log(
      `  ${DRY_RUN ? 'would set' : 'set'} ${name}: ${bucket.file_size_limit ?? 'project default'} -> ${LIMIT_BYTES} bytes`,
    );
    if (DRY_RUN) continue;
    const { error } = await db.storage.updateBucket(name, {
      public: bucket.public,
      fileSizeLimit: LIMIT_BYTES,
    });
    if (error) throw new Error(`${name}: ${error.message}`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run, nothing written. ${changes} change(s) pending.`);
    return;
  }

  console.log('\nVerifying...');
  const { data: after, error: afterErr } = await db.storage.listBuckets();
  if (afterErr) throw new Error('re-list buckets: ' + afterErr.message);
  const failures = [];
  for (const name of BUCKETS) {
    const b = (after ?? []).find((x) => x.name === name);
    if (!b) continue;
    console.log(`  ${name}: file_size_limit=${b.file_size_limit} public=${b.public}`);
    if (b.file_size_limit !== LIMIT_BYTES) {
      failures.push(`${name} is ${b.file_size_limit}, expected ${LIMIT_BYTES}`);
    }
    if (!b.public) failures.push(`${name} is no longer public`);
  }
  if (failures.length) {
    for (const f of failures) console.error('  FAIL ' + f);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${changes} change(s) applied and verified. COMPLETE`);
}

main().catch((err) => {
  console.error('configure-storage-buckets failed:', err.message);
  process.exitCode = 1;
});
