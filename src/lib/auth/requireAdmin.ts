import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';

import { authOptions } from './config';

/**
 * The two staff roles.
 *
 * `admin` is Ahmad and anyone he gives the same reach: everything, including
 * deletion, the settings that shape the whole site, user management and the
 * audit log.
 *
 * `editor` writes content. The line drawn for them is **deletion, not editing**:
 * an editor can create and change anything on the public site and can hide any
 * of it, which achieves what deleting achieves without the part that cannot be
 * undone. They are also kept out of the four surfaces where a mistake is
 * site-wide rather than page-shaped (Site Settings, Header Settings, Footer
 * Links) or is a record of what others did (the audit log), plus user
 * management itself.
 *
 * Stored in `admin_users.role`, which is a plain TEXT column with no CHECK, so
 * adding this role needed no DDL. `isAdminRole` is the gate instead: a row with
 * an unrecognised role authenticates as nothing rather than as an admin.
 */
export type AdminRole = 'admin' | 'editor';

export const ADMIN_ROLES: readonly AdminRole[] = ['admin', 'editor'];

export function isAdminRole(value: unknown): value is AdminRole {
  return value === 'admin' || value === 'editor';
}

export type AdminSession = Session & {
  user: { id: string; email: string; name: string; role: AdminRole };
};

/**
 * Any signed-in staff member, admin or editor.
 *
 * Use this to gate a route that an editor is allowed to reach. It used to mean
 * "an admin", because admin was the only role; every existing caller kept
 * working when editors were added because an editor is also a valid session
 * here. **That is the trap this file exists to make visible**: a route that
 * should be admin-only and calls this is open to editors and will not fail any
 * test that only ever signs in as an admin. Reach for `getOwnerSession` when
 * the answer is "only Ahmad".
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = (await getServerSession(authOptions)) as AdminSession | null;
  if (!session || !isAdminRole(session.user?.role)) return null;
  return session;
}

/** An `admin` session and nothing else. The gate for site-wide settings, user management and the audit log. */
export async function getOwnerSession(): Promise<AdminSession | null> {
  const session = await getAdminSession();
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

/**
 * The same gate, but able to tell the two failures apart.
 *
 * `getOwnerSession` returns null for both "not signed in" and "signed in as an
 * editor", which collapses a 401 and a 403 into one answer. That matters: a 401
 * tells a client its session is bad and invites it to log in again, which is
 * wrong and confusing advice to give an editor who is signed in perfectly well
 * and simply is not allowed. Routes that want the distinction call this and
 * return the response as-is.
 */
export async function requireOwner(): Promise<AdminSession | NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  if (session.user.role !== 'admin') {
    return forbidden('This is an admin-only area.');
  }
  return session;
}

/**
 * Whether this session may delete.
 *
 * Deliberately a question about the session rather than about the thing being
 * deleted: an editor cannot delete a page, a section, a collection row or an
 * uploaded file, and the answer does not depend on which.
 */
export function canDelete(session: AdminSession | null): boolean {
  return session?.user.role === 'admin';
}

/** 401 for "not signed in", used where a route has no session at all. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * 403 for "signed in, but not allowed".
 *
 * Separate from 401 on purpose. An editor hitting an admin-only route is not a
 * failed login and should not be sent to the login screen to try again, which
 * is what a 401 invites the client to do.
 */
export function forbidden(
  message = 'Your role does not allow this action.',
): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
