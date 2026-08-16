import type { AdminRole } from './requireAdmin';

/**
 * Admin surfaces only an `admin` may reach.
 *
 * One list, read by three places that must agree: the middleware that blocks
 * the URL, the layout that decides what the sidebar offers, and the API routes
 * behind each screen. Kept as path prefixes rather than as a flag on each nav
 * item so that typing the URL is refused as firmly as clicking the link, which
 * is the only version of this that is worth anything.
 *
 * Three of the four are site-wide rather than page-shaped: Site Settings,
 * Header Settings and Footer Links each change every page at once, so a
 * mistake there is not a mistake an editor can see the extent of. The audit log
 * is different again: it is the record of what everyone did, and someone who
 * can be audited should not be able to read or reshape the audit. User
 * management is on the list for the obvious reason.
 *
 * **Pages and Nav is deliberately not here.** It reorders and hides navigation
 * items, which is content work, and hiding is the operation editors are trusted
 * with everywhere else.
 */
export const ADMIN_ONLY_PREFIXES: readonly string[] = [
  '/admin/settings',
  '/admin/header-settings',
  '/admin/footer-links',
  '/admin/users',
  '/admin/audit',
];

/** True when `pathname` is a screen only an `admin` may open. */
export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/** True when a session in `role` may open `pathname`. */
export function roleMayOpen(role: AdminRole, pathname: string): boolean {
  if (role === 'admin') return true;
  return !isAdminOnlyPath(pathname);
}
