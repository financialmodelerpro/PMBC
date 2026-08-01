/**
 * POST /api/admin/logout - clear the admin cookie.
 * No em dashes in this file.
 */
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, cookieOptions } from '@/src/shared/auth/adminAuth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return res;
}
