// scripts/seed-admin.mjs
// Creates the first admin row, or resets it to a known development value, and
// verifies the stored hash by comparing it back. Run with `npm run seed-admin`.
//
// USE rotate-admin-password.mjs INSTEAD to set a real credential. This script
// hardcodes its password in the file below, which is correct for a throwaway
// debug login and completely wrong for a production one: it would commit the
// live password to git history.
//
// Since the launch-blocker rotation, this script refuses to overwrite an
// existing row whose hash no longer matches ADMIN_PASSWORD, because doing so
// would silently downgrade a rotated production credential back to the debug
// value. Set ADMIN_SEED_FORCE=1 if that is genuinely what you want.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Minimal .env.local loader so we don't depend on dotenv.
function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const ADMIN_EMAIL = 'meetahmadch@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';
const ADMIN_NAME = 'Ahmad Din';

async function main() {
  loadEnvLocal();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Hash via JS variable, so no shell escaping is involved.
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

  // Try to update an existing row first.
  const { data: existing, error: lookupErr } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (lookupErr) {
    throw new Error('Lookup failed: ' + lookupErr.message);
  }

  if (existing) {
    // Refuse to clobber a rotated credential. Before the rotation this script
    // was the documented way to reset the debug login, so it is still reachable
    // by muscle memory and by an npm script; without this guard, one stray run
    // would put the production admin back on a password that is in git history.
    const { data: current } = await supabase
      .from('admin_users')
      .select('password_hash')
      .eq('id', existing.id)
      .single();
    const alreadyThisPassword =
      current?.password_hash && bcrypt.compareSync(ADMIN_PASSWORD, current.password_hash);
    if (!alreadyThisPassword && process.env.ADMIN_SEED_FORCE !== '1') {
      console.error(
        `Refusing to reset ${ADMIN_EMAIL}: the stored hash does not match the password this\n` +
          'script would set, which means the credential has been rotated since.\n' +
          'Use `npm run rotate-admin-password` to set a new one, or re-run with\n' +
          'ADMIN_SEED_FORCE=1 if you really mean to overwrite it.',
      );
      process.exit(1);
    }

    const { error: updErr } = await supabase
      .from('admin_users')
      .update({ password_hash: passwordHash })
      .eq('id', existing.id);
    if (updErr) throw new Error('Update failed: ' + updErr.message);
    console.log('Updated existing admin row for', ADMIN_EMAIL);
  } else {
    const { error: insErr } = await supabase
      .from('admin_users')
      .insert({
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: 'admin',
        password_hash: passwordHash,
      });
    if (insErr) throw new Error('Insert failed: ' + insErr.message);
    console.log('Inserted new admin row for', ADMIN_EMAIL);
  }

  // Read back and verify.
  const { data: row, error: readErr } = await supabase
    .from('admin_users')
    .select('id, email, name, role, password_hash, created_at, last_login_at')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (readErr || !row) {
    throw new Error('Read-back failed: ' + (readErr?.message ?? 'no row'));
  }

  const ok = bcrypt.compareSync(ADMIN_PASSWORD, row.password_hash);

  console.log('---');
  console.log('id:           ', row.id);
  console.log('email:        ', row.email);
  console.log('name:         ', row.name);
  console.log('role:         ', row.role);
  console.log('hash prefix:  ', row.password_hash.slice(0, 12) + '…');
  console.log('hash length:  ', row.password_hash.length);
  console.log('created_at:   ', row.created_at);
  console.log('last_login_at:', row.last_login_at);
  console.log('---');

  if (ok) {
    console.log('PASSWORD VERIFIED ✅');
    process.exit(0);
  } else {
    console.error('PASSWORD MISMATCH: bcrypt.compareSync returned false');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('seed-admin failed:', err.message);
  process.exit(1);
});
