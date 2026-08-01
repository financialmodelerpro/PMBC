/**
 * shared/auth/session.ts (SERVER ONLY)
 *
 * A drop-in replacement for the two NextAuth imports the copied CMS routes use.
 *
 * WHY A SHIM RATHER THAN REWRITING EVERY ROUTE
 *
 * The routes were copied verbatim from a working CMS. Each one checks auth in
 * its own slightly different shape:
 *
 *     const session = await getServerSession(authOptions);
 *     if (session?.user?.role !== 'admin') ...
 *     if (!session?.user || (session.user as {role?: string}).role !== 'admin') ...
 *
 * Rewriting those by hand or by regex means editing working authorisation logic
 * in six files, which is precisely the code you least want to touch on a copy
 * you cannot run yet. Instead this module presents the SAME shape NextAuth did,
 * so every check keeps working unchanged, and swaps only what is underneath.
 *
 * If you later add real user accounts, delete this file and install NextAuth.
 * The route code will not need to change, which is the point.
 *
 * FAIL CLOSED: getServerSession returns null unless a valid admin cookie is
 * present, and adminAuth denies outright when the environment is unconfigured.
 *
 * No em dashes in this file.
 */

import { isAdminRequest } from './adminAuth';

/** Present only so `getServerSession(authOptions)` still type-checks. It carries
 *  no configuration: the real decision is made by the cookie check below. */
export const authOptions = {} as const;

export interface AdminSession {
  user: { id: string; email: string; name: string; role: 'admin' };
}

/**
 * Returns an admin session when the request carries a valid admin cookie, and
 * null otherwise. Null is what every copied route treats as "not an admin", so
 * the existing checks reject exactly as they did before.
 */
export async function getServerSession(_options?: unknown): Promise<AdminSession | null> {
  if (!await isAdminRequest()) return null;
  return {
    user: {
      id: 'pmbc-admin',
      email: process.env.ADMIN_EMAIL ?? 'admin@pacemakers.local',
      name: 'PaceMakers Admin',
      role: 'admin',
    },
  };
}
