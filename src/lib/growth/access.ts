import { redirect } from 'next/navigation';

import { getAdminSession, type AdminSession } from '@/lib/auth/requireAdmin';

/**
 * The server-side gate for every Growth page: admins only (since Unit 1.2).
 *
 * Built only from the admin's existing mechanism. No session: to the admin
 * login, as the admin layout does. An editor: to `/admin?denied=1`, as the
 * middleware does for every path in `ADMIN_ONLY_PREFIXES`, which lists
 * `/admin/growth`.
 *
 * The middleware and the admin layout already refuse both. This is repeated in
 * each Growth page because the App Router can render a page in parallel with
 * its layouts, so a page that reads lead data must not depend on the layout's
 * redirect alone. Call it first in every Growth page and server action; API
 * routes use `requireOwner` directly.
 */
export async function requireGrowthSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (session.user.role !== 'admin') redirect('/admin?denied=1');
  return session;
}
