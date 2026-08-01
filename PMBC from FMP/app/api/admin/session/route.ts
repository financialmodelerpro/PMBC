/**
 * GET /api/admin/session - who am I, for the sidebar.
 *
 * Presentation only. It reports the session so the UI can render a name and a
 * sign-out button; it grants nothing. Every data route re-checks the cookie.
 *
 * No em dashes in this file.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from '@/src/shared/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json(session);
}
