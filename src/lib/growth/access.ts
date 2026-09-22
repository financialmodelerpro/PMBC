import { redirect } from 'next/navigation';

import { getAdminSession, type AdminSession } from '@/lib/auth/requireAdmin';

/**
 * The server-side gate for every Growth page, built only from the admin's
 * existing mechanism: `getAdminSession` (NextAuth session with an admin or
 * editor role), redirecting to the admin login exactly as the admin layout does.
 *
 * The admin layout already runs this check for every /admin route, and the
 * middleware redirects before either. It is repeated in each Growth page
 * because the App Router can render a page in parallel with its layouts, so a
 * later unit's page that reads lead data must not depend on the layout's
 * redirect alone. Call it first in every Growth page and every Growth server
 * action; API routes keep using `getAdminSession` or `requireOwner` directly.
 */
export async function requireGrowthSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}
