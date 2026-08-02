// scripts/rotate-admin-password.mjs
//
// Rotates the admin password for a single admin_users row.
//
// The plaintext never reaches this repository, the terminal scrollback, the
// shell history, or any log. It is read from a hidden prompt (or an env var the
// caller exports and unsets), held in memory only long enough to hash, and
// never printed. Everything this script reports is either a boolean or
// non-secret metadata: a hash prefix, a length, a timestamp.
//
// That constraint is why this exists alongside seed-admin.mjs rather than
// replacing it. seed-admin.mjs hardcodes a known development password in the
// file, which is fine for a throwaway debug credential and completely wrong for
// a production one: it would put the live password in git history forever.
//
//   node scripts/rotate-admin-password.mjs
//   npm run rotate-admin-password
//
// Non-interactive (CI, or a shell where you have disabled history):
//   ADMIN_NEW_PASSWORD='...' node scripts/rotate-admin-password.mjs
//
// Target a different admin with ADMIN_EMAIL=someone@example.com.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_EMAIL = 'meetahmadch@gmail.com';
const BCRYPT_COST = 12;
const MIN_LENGTH = 16;

/** Minimal .env.local loader, matching seed-admin.mjs so there is one pattern. */
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

/**
 * Reads a line with echo suppressed.
 *
 * readline still emits the prompt, so _writeToOutput is overridden to print the
 * prompt once and swallow every subsequent keystroke echo. Without that, the
 * password would be visible on screen and captured by anything recording the
 * terminal.
 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'stdin is not a TTY, so the password cannot be read without echoing it.\n' +
            "Run this in a real terminal, or pass ADMIN_NEW_PASSWORD in the environment.",
        ),
      );
      return;
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let promptShown = false;
    rl._writeToOutput = (chunk) => {
      if (!promptShown) {
        rl.output.write(question);
        promptShown = true;
      } else if (chunk === '\r\n' || chunk === '\n') {
        rl.output.write('\n');
      }
      // Every other write is a keystroke echo. Dropped.
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Rejects passwords that would not survive the credential being leaked.
 *
 * This is a launch blocker being closed, not a formality: the credential it
 * replaces is a documented debug password sitting in public git history.
 */
function assessStrength(pw) {
  const problems = [];
  if (pw.length < MIN_LENGTH) {
    problems.push(`shorter than ${MIN_LENGTH} characters (got ${pw.length})`);
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) {
    problems.push(`uses ${classes} of 4 character classes, needs at least 3`);
  }
  if (/^\s|\s$/.test(pw)) {
    problems.push('starts or ends with whitespace, which is easy to lose in a copy and paste');
  }
  if (/(.)\1{3,}/.test(pw)) {
    problems.push('contains a character repeated 4 or more times in a row');
  }
  // Deliberately compared as lowercase substrings: "Admin@2026!!" is not a
  // rotation of "Admin@2026".
  const lowered = pw.toLowerCase();
  for (const banned of ['admin@2026', 'password', 'pacemakers', 'pmbc', 'qwerty', '123456']) {
    if (lowered.includes(banned)) {
      problems.push(`contains the predictable string "${banned}"`);
    }
  }
  return problems;
}

/** Optional end-to-end check: does NextAuth actually accept the new password? */
async function verifyLiveLogin(base, email, password) {
  const jar = new Map();
  const ingest = (res) => {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const first = raw.split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  };
  const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  ingest(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${base}/admin`,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });
  ingest(loginRes);

  const hasSession =
    jar.has('next-auth.session-token') || jar.has('__Secure-next-auth.session-token');
  if (!hasSession) return { ok: false, detail: `no session cookie (HTTP ${loginRes.status})` };

  const guarded = await fetch(`${base}/admin`, {
    headers: { cookie: header() },
    redirect: 'manual',
  });
  return {
    ok: guarded.status === 200,
    detail: `/admin returned HTTP ${guarded.status}`,
  };
}

async function reachable(base) {
  try {
    const res = await fetch(`${base}/admin/login`, { redirect: 'manual' });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  loadEnvLocal();

  const email = process.env.ADMIN_EMAIL || DEFAULT_EMAIL;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Confirm the target exists before asking for anything secret. Prompting for
  // a password and only then failing on a typo'd email is a bad trade.
  const { data: before, error: lookupErr } = await supabase
    .from('admin_users')
    .select('id, email, name, role, password_hash, created_at, last_login_at')
    .eq('email', email)
    .maybeSingle();
  if (lookupErr) throw new Error('Lookup failed: ' + lookupErr.message);
  if (!before) {
    throw new Error(
      `No admin_users row for ${email}. This script rotates an existing credential; ` +
        'use seed-admin.mjs to create the first one.',
    );
  }

  console.log(`Rotating the password for ${before.email} (${before.name}, role=${before.role}).`);
  console.log(`Current hash: ${before.password_hash.slice(0, 7)}... length ${before.password_hash.length}`);
  console.log('');

  let password = process.env.ADMIN_NEW_PASSWORD;
  let fromEnv = Boolean(password);

  if (!password) {
    password = await promptHidden('New password (not echoed): ');
    const again = await promptHidden('Confirm new password:     ');
    // Double entry is not ceremony. A typo here hashes an unknown string and
    // locks the only admin out of the console, with recovery only via this
    // script and the service-role key.
    if (password !== again) {
      throw new Error('The two entries did not match. Nothing was changed.');
    }
  }

  if (!password) throw new Error('Empty password. Nothing was changed.');

  const problems = assessStrength(password);
  if (problems.length > 0) {
    console.error('Password rejected. Nothing was changed:');
    for (const p of problems) console.error(`  - ${p}`);
    // process.exitCode rather than process.exit: forcing an exit while libuv
    // still holds handles trips an assertion on Windows, and that noise would
    // sit right where a real failure message belongs.
    process.exitCode = 1;
    return;
  }

  // Guard against rotating to the value being retired.
  if (bcrypt.compareSync(password, before.password_hash)) {
    throw new Error('That is the password already in use. Nothing was changed.');
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_COST);

  const { error: updErr } = await supabase
    .from('admin_users')
    .update({ password_hash: passwordHash })
    .eq('id', before.id);
  if (updErr) throw new Error('Update failed: ' + updErr.message);

  const { data: after, error: readErr } = await supabase
    .from('admin_users')
    .select('id, email, password_hash')
    .eq('id', before.id)
    .single();
  if (readErr || !after) throw new Error('Read-back failed: ' + (readErr?.message ?? 'no row'));

  const storedMatches = bcrypt.compareSync(password, after.password_hash);
  const changed = after.password_hash !== before.password_hash;

  console.log('');
  console.log('Rotation results');
  console.log(`  ${changed ? 'PASS' : 'FAIL'}  stored hash changed`);
  console.log(`  ${storedMatches ? 'PASS' : 'FAIL'}  stored hash verifies against the new password`);
  console.log(
    `  ${after.password_hash.startsWith('$2') && after.password_hash.length === 60 ? 'PASS' : 'FAIL'}  hash is a well-formed bcrypt digest (cost ${BCRYPT_COST})`,
  );
  console.log(`  new hash: ${after.password_hash.slice(0, 7)}... length ${after.password_hash.length}`);

  let liveOk = null;
  const base = process.env.SMOKE_BASE || 'http://localhost:3001';
  if (await reachable(base)) {
    const live = await verifyLiveLogin(base, email, password);
    liveOk = live.ok;
    console.log(`  ${live.ok ? 'PASS' : 'FAIL'}  end-to-end login at ${base} (${live.detail})`);
  } else {
    console.log(`  SKIP  end-to-end login: no server responding at ${base}`);
    console.log('        Start one with `npm run dev -- -p 3001` and re-run to check this.');
  }

  // Drop the plaintext reference. Node strings are immutable so this is not a
  // secure wipe, only a scope reduction; the real protection is that it was
  // never written anywhere.
  password = null;
  if (fromEnv) {
    console.log('');
    console.log('NOTE: ADMIN_NEW_PASSWORD was read from the environment. Unset it, and');
    console.log('      clear it from your shell history if your shell records assignments.');
  }

  const allOk = changed && storedMatches && liveOk !== false;
  console.log('');
  console.log(allOk ? 'ROTATION COMPLETE' : 'ROTATION INCOMPLETE, review the failures above');
  process.exitCode = allOk ? 0 : 1;
}

main().catch((err) => {
  console.error('rotate-admin-password failed:', err.message);
  process.exitCode = 1;
});
