/**
 * shared/auth/adminAuth.ts (SERVER ONLY)
 *
 * Admin authentication for the PaceMakers CMS.
 *
 * The FMP original used NextAuth with a users table, scrypt password hashing
 * and role claims. That is the right shape for a product with customer
 * accounts. This site has one kind of user, you, so it ships with a single
 * shared password instead. Swap it for real accounts if the team grows.
 *
 * FAIL CLOSED. If ADMIN_PASSWORD or ADMIN_SESSION_SECRET is missing, every
 * check DENIES rather than allowing. This is deliberate and it is the single
 * most important line in the file.
 *
 * The reason: the FMP codebase had an email endpoint whose auth read
 *
 *     const secret = process.env.RESEND_WEBHOOK_SECRET;
 *     if (secret) { ...check the bearer token... }
 *
 * The secret was set locally and never set in production, so the check never
 * ran and the endpoint accepted anonymous requests for months. It looked
 * secured on a developer machine. An unset secret must mean CLOSED, never OPEN.
 *
 * No em dashes in this file.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'pmbc_admin';
/** Session lifetime. Short enough to limit a stolen cookie, long enough to work in. */
const MAX_AGE_SECONDS = 60 * 60 * 12;

function config(): { password: string; secret: string } | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  // Both required. Missing either means the deployment is not configured, and
  // an unconfigured deployment must be locked, not open.
  if (!password || !secret) return null;
  return { password, secret };
}

/** Whether the admin area can work at all. Used to show a clear setup message
 *  rather than an unexplained login failure. */
export function adminAuthConfigured(): boolean {
  return config() !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Constant-time compare, so a wrong password cannot be found byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Mint a session token: expiry plus an HMAC over it. The secret never leaves
 *  the server, so a client cannot forge or extend one. */
export function issueToken(now = Date.now()): string {
  const cfg = config();
  if (!cfg) throw new Error('Admin auth is not configured.');
  const expires = now + MAX_AGE_SECONDS * 1000;
  return `${expires}.${sign(String(expires), cfg.secret)}`;
}

/** Verify a token: correct signature AND not expired. */
export function verifyToken(token: string | undefined, now = Date.now()): boolean {
  const cfg = config();
  if (!cfg || !token) return false;

  const [expiresRaw, signature] = token.split('.');
  if (!expiresRaw || !signature) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now) return false;

  return safeEqual(signature, sign(expiresRaw, cfg.secret));
}

/** Check the submitted password against the configured one. */
export function passwordMatches(submitted: string): boolean {
  const cfg = config();
  if (!cfg || typeof submitted !== 'string') return false;
  return safeEqual(submitted, cfg.password);
}

export function cookieOptions() {
  return {
    httpOnly: true,                                   // not readable from JS
    secure: process.env.NODE_ENV === 'production',    // https only in prod
    sameSite: 'lax' as const,                         // blocks cross-site posts
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}

/**
 * The guard every admin API route calls. Returns false when auth is
 * unconfigured, the cookie is absent, forged, or expired.
 */
export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(ADMIN_COOKIE)?.value);
}
