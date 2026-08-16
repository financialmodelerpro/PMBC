'use client';

import { createContext, useContext } from 'react';

/**
 * The signed-in role, made available to client components under `/admin`.
 *
 * There is no `SessionProvider` in this app: the admin layout is a server
 * component that reads the session directly, and adding NextAuth's client
 * session would mean a second fetch of something the server already has. This
 * carries the one field the UI needs down from that layout instead.
 *
 * **This hides controls. It does not enforce anything.** Every delete route
 * checks the role itself, so a hidden button and a curled request get the same
 * answer. The point of hiding is that an editor is not shown an action that
 * would fail: being refused is worse than never being offered.
 */
export type AdminRole = 'admin' | 'editor';

const RoleContext = createContext<AdminRole>('admin');

export function AdminRoleProvider({
  role,
  children,
}: {
  role: AdminRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useAdminRole(): AdminRole {
  return useContext(RoleContext);
}

/** True when this session may delete. Mirrors `canDelete` on the server. */
export function useCanDelete(): boolean {
  return useAdminRole() === 'admin';
}
