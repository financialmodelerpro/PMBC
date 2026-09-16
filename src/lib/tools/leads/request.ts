/**
 * What the lead API needs to know about the request itself, kept apart from the
 * submission logic so that logic can be tested without an HTTP request.
 */

import { createHash, randomBytes } from 'node:crypto';

/**
 * The visitor's IP as Vercel reports it. `x-forwarded-for` may be a list, of
 * which the first entry is the client; `x-real-ip` is the fallback.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || null;
}

/**
 * SHA-256 of the IP with a server-side secret, so the stored value can group
 * requests for rate limiting and cannot be reversed to an address by anyone
 * holding only the database.
 *
 * `TOOL_LEAD_IP_SALT` is the intended secret. `NEXTAUTH_SECRET` is the fallback
 * so a deployment missing the new variable still hashes rather than storing
 * nothing; with neither set, no hash is stored and rate limiting is skipped.
 */
export function hashIp(ip: string | null): string | null {
  const salt = process.env.TOOL_LEAD_IP_SALT || process.env.NEXTAUTH_SECRET;
  if (!ip || !salt) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** 32 random bytes, base64url. Identifies a lead in a link without exposing its id. */
export function newAccessToken(): string {
  return randomBytes(32).toString('base64url');
}
