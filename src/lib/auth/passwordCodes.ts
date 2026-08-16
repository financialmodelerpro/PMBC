import { randomInt, createHash, timingSafeEqual } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * The one-time codes that confirm a password change by email.
 *
 * **Stored in `cms_content` under `_password_codes`, not a new table.** Adding a
 * table means DDL, which in this repository means pasting SQL into the Supabase
 * editor by hand, and a security step that only starts working after someone
 * remembers a manual migration is not a security step. `_fmp_cache` set this
 * precedent for exactly the same reason, the leading underscore marks the
 * section internal, and `/admin/content` already hides sections named that way
 * so nobody is offered a page of machine-written JSON to edit.
 *
 * **What is stored is not the code.** A SHA-256 of it, alongside the bcrypt hash
 * of the password waiting to be applied. So the row holds nothing that can be
 * replayed: not the code an attacker would need, and not the new password.
 * Holding the plaintext password between the two steps was the alternative and
 * would have been worse than the problem this feature solves.
 */

const SECTION = '_password_codes';

/** Ten minutes, as instructed. Long enough for an email, short enough to matter. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Five wrong guesses and the code dies.
 *
 * Six digits is a million possibilities, which is plenty against a person and
 * nothing against a script, so the attempt count is what actually bounds this.
 * Burning the code on the fifth failure means the attacker has to trigger a new
 * email, which lands in the account holder's inbox and tells them something is
 * happening.
 */
export const MAX_ATTEMPTS = 5;

type PendingChange = {
  codeHash: string;
  newPasswordHash: string;
  expiresAt: number;
  attempts: number;
};

function looseDb(): SupabaseClient {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

/** Six digits, uniformly drawn. `randomInt` rather than `Math.random`. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/** Constant time, so a wrong code cannot be narrowed down by timing the reply. */
function codeMatches(code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Store a pending change, replacing any code already outstanding for this user.
 *
 * One active code at a time is the instruction and also the safer reading: two
 * live codes means a second request does not invalidate the first, so an
 * attacker who triggered one keeps their window open while the real user starts
 * again.
 */
export async function storePendingChange(
  adminId: string,
  code: string,
  newPasswordHash: string,
): Promise<void> {
  const value: PendingChange = {
    codeHash: hashCode(code),
    newPasswordHash,
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  };
  const db = looseDb();
  await db.from('cms_content').delete().eq('section', SECTION).eq('key', adminId);
  await db
    .from('cms_content')
    .insert({ section: SECTION, key: adminId, value: JSON.stringify(value) });
}

export async function clearPendingChange(adminId: string): Promise<void> {
  const db = looseDb();
  await db.from('cms_content').delete().eq('section', SECTION).eq('key', adminId);
}

export type VerifyResult =
  | { state: 'ok'; newPasswordHash: string }
  | { state: 'none' }
  | { state: 'expired' }
  | { state: 'wrong'; attemptsLeft: number }
  | { state: 'exhausted' };

/**
 * Check a code and, when it is right, hand back the password hash to apply.
 *
 * Every terminal outcome clears the record: a correct code is spent, an expired
 * one is rubbish, and an exhausted one must not be retryable. Only a wrong
 * guess with attempts remaining leaves anything behind.
 */
export async function verifyCode(adminId: string, code: string): Promise<VerifyResult> {
  const db = looseDb();
  const { data } = await db
    .from('cms_content')
    .select('value')
    .eq('section', SECTION)
    .eq('key', adminId)
    .maybeSingle();

  if (!data?.value) return { state: 'none' };

  let pending: PendingChange;
  try {
    pending = JSON.parse(data.value) as PendingChange;
  } catch {
    await clearPendingChange(adminId);
    return { state: 'none' };
  }

  if (Date.now() > pending.expiresAt) {
    await clearPendingChange(adminId);
    return { state: 'expired' };
  }

  if (codeMatches(code, pending.codeHash)) {
    await clearPendingChange(adminId);
    return { state: 'ok', newPasswordHash: pending.newPasswordHash };
  }

  const attempts = (pending.attempts ?? 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await clearPendingChange(adminId);
    return { state: 'exhausted' };
  }

  await db
    .from('cms_content')
    .update({ value: JSON.stringify({ ...pending, attempts }) })
    .eq('section', SECTION)
    .eq('key', adminId);

  return { state: 'wrong', attemptsLeft: MAX_ATTEMPTS - attempts };
}
