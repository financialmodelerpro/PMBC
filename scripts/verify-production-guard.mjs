// scripts/verify-production-guard.mjs
//
// Proves no script can send POST, PUT, PATCH or DELETE to production.
//
//   1. isProductionUrl: the production domain, its subdomains and Vercel
//      deployment hosts are production; localhost and junk are not.
//   2. Every script under scripts/ whose source sends one of those methods
//      calls refuseWritesAgainstProduction (or, for the password rotation,
//      checks isProductionUrl before its login POST).
//   3. Each verifier and smoke script is run with its base URL set to
//      production. Each must exit with code 2 and print REFUSED. `fetch` is
//      replaced before the script loads, so if a guard ever broke, the attempt
//      is caught on this machine and nothing reaches the network.
//
//   npm run verify-production-guard

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { isProductionUrl } from './lib/productionGuard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0, failures = 0;
function check(label, ok, detail = '') {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
}

console.log('isProductionUrl');
for (const u of ['https://www.pacemakersglobal.com', 'https://pacemakersglobal.com/api/x', 'https://PMBC-git-feat.vercel.app', 'http://www.pacemakersglobal.com:443']) check(`${u} is production`, isProductionUrl(u));
for (const u of ['http://localhost:3999', 'http://127.0.0.1:3000', 'https://pacemakersglobal.com.evil.test', '', undefined, 'not a url']) check(`${String(u)} is not production`, !isProductionUrl(u));

console.log('Every writing script is guarded');
const scriptsDir = path.join(root, 'scripts');
const writers = fs
  .readdirSync(scriptsDir)
  .filter((f) => f.endsWith('.mjs') && f !== 'verify-production-guard.mjs')
  .filter((f) => /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(fs.readFileSync(path.join(scriptsDir, f), 'utf8')));
check('the scan finds the known writing scripts', ['verify-tool-lead-api.mjs', 'verify-brevo-webhook.mjs', 'smoke-admin.mjs'].every((f) => writers.includes(f)), writers.join(', '));
for (const f of writers) {
  const src = fs.readFileSync(path.join(scriptsDir, f), 'utf8');
  const guarded = f === 'rotate-admin-password.mjs' ? /if \(isProductionUrl\(base\)\)/.test(src) : /refuseWritesAgainstProduction\(/.test(src);
  check(`${f} is guarded`, guarded);
}

console.log('Pointed at production, each refuses without a request');
const stub = `data:text/javascript,${encodeURIComponent(
  "globalThis.fetch = async (u) => { console.log('NETWORK_ATTEMPT ' + u); process.exit(3); };",
)}`;
const runs = [
  ['verify-tool-lead-api.mjs', { VERIFY_BASE: 'https://www.pacemakersglobal.com' }],
  ['verify-brevo-webhook.mjs', { VERIFY_BASE: 'https://www.pacemakersglobal.com' }],
  ['verify-media-upload.mjs', { VERIFY_BASE: 'https://www.pacemakersglobal.com' }],
  ['smoke-admin.mjs', { SMOKE_BASE: 'https://www.pacemakersglobal.com' }],
  ['verify-parity8.mjs', { SMOKE_BASE: 'https://www.pacemakersglobal.com' }],
];
for (const [f, env] of runs) {
  const r = spawnSync(process.execPath, ['--import', stub, path.join(scriptsDir, f)], {
    cwd: root,
    env: { ...process.env, ...env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    encoding: 'utf8',
    timeout: 120000,
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  check(`${f}: exit code 2`, r.status === 2, `status ${r.status}`);
  check(`${f}: printed REFUSED`, out.includes(`REFUSED`), out.slice(0, 200));
  check(`${f}: made no network attempt`, !out.includes('NETWORK_ATTEMPT'), out.match(/NETWORK_ATTEMPT[^\n]*/)?.[0]);
}
{
  // smoke-builder has a fixed localhost base, so it must still run past the guard.
  const src = fs.readFileSync(path.join(scriptsDir, 'smoke-builder.mjs'), 'utf8');
  check('smoke-builder guards its fixed base too', src.includes("refuseWritesAgainstProduction(BASE, 'smoke-builder')"));
}

console.log(`\n${checks - failures} of ${checks} checks passed.`);
if (failures) {
  console.log(`${failures} FAILED`);
  process.exitCode = 1;
} else console.log('COMPLETE');
