/**
 * POST /api/admin/login   - exchange the admin password for a signed cookie
 *
 * Fails closed: if ADMIN_PASSWORD or ADMIN_SESSION_SECRET is unset, this
 * returns 503 rather than letting anyone in.
 *
 * No em dashes in this file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuthConfigured, cookieOptions, issueToken, passwordMatches, ADMIN_COOKIE } from '@/src/shared/auth/adminAuth';

export async function POST(req: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json(
      { error: 'Admin access is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null) as { password?: string } | null;
  if (!body?.password) {
    return NextResponse.json({ error: 'Password required.' }, { status: 400 });
  }

  if (!passwordMatches(body.password)) {
    // Deliberately vague and deliberately not timing-revealing (the comparison
    // is constant time). Do not say whether a password "exists".
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, issueToken(), cookieOptions());
  return res;
}
