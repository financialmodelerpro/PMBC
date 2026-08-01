'use client';

/**
 * shared/auth/clientSession.ts
 *
 * Client-side drop-in for the two things the copied admin UI imports from
 * next-auth/react: useSession() and signOut().
 *
 * Same reasoning as the server shim: the UI was copied from a working CMS and
 * presenting the original shape means none of that UI code has to be edited.
 *
 * IMPORTANT: this is presentation only. It reports who you are so the sidebar
 * can render a name and a sign-out button. It grants NOTHING. Every piece of
 * data is fetched through an API route that checks the signed admin cookie on
 * the server, so faking this in the browser gets you an admin-looking shell
 * with no data in it.
 *
 * No em dashes in this file.
 */

import { useEffect, useState } from 'react';

export interface ClientSession {
  user: { name: string; email: string; role: 'admin' };
}

type Status = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Mirrors next-auth's useSession() return shape.
 *
 * Asks the server whether the admin cookie is valid rather than assuming, so a
 * signed-out admin is not shown a UI that will fail on every request.
 */
export function useSession(): { data: ClientSession | null; status: Status } {
  const [data, setData] = useState<ClientSession | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.user) { setData(json); setStatus('authenticated'); }
        else { setData(null); setStatus('unauthenticated'); }
      })
      .catch(() => { if (!cancelled) { setData(null); setStatus('unauthenticated'); } });
    return () => { cancelled = true; };
  }, []);

  return { data, status };
}

/** Mirrors next-auth's signOut(). Clears the cookie server-side, then redirects. */
export async function signOut(opts?: { callbackUrl?: string }): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => null);
  window.location.href = opts?.callbackUrl ?? '/admin/login';
}
