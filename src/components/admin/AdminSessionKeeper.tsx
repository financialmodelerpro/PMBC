'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps an admin session alive while someone is working, and says so plainly
 * when it has run out.
 *
 * The session is a NextAuth JWT that lasts SESSION_MAX_AGE_SECONDS (an hour,
 * `src/lib/auth/config.ts`). On its own that hour counts from sign-in, so a
 * page builder left open kept showing while every save after the hour came
 * back 401 "Unauthorized" (2026-10-11). Calling `/api/auth/session` re-issues
 * the cookie with a fresh hour, so this calls it every few minutes, but only
 * after recent activity in the tab: an unattended console still signs itself
 * out an hour after its last use.
 *
 * Any admin API call answered 401 raises a banner saying the session has
 * expired, with a link to sign in again in a new tab. The sign-in sets the
 * same cookie, so the open page's unsaved edits survive and its next Save
 * goes through.
 */

/** How often to renew while active. Well inside the one-hour session. */
const RENEW_EVERY_MS = 5 * 60 * 1000;
/** Activity within this window counts as "working". */
const ACTIVE_WINDOW_MS = RENEW_EVERY_MS;

export function AdminSessionKeeper() {
  const [expired, setExpired] = useState(false);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'input', 'wheel'] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });

    const renew = async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
        const body = (await res.json().catch(() => null)) as { user?: unknown } | null;
        setExpired(!body?.user);
      } catch {
        // A network blip is not an expiry; the next tick tries again.
      }
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity.current < ACTIVE_WINDOW_MS) {
        void renew();
      }
    }, RENEW_EVERY_MS);

    // Coming back to the tab: renew if still signed in, or show the banner now
    // rather than at the next failed save.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        mark();
        void renew();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Any admin API call refused for want of a session raises the banner, and
    // a later successful one (after signing in elsewhere) clears it.
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const path = new URL(url, window.location.origin);
        if (path.origin === window.location.origin && path.pathname.startsWith('/api/admin/')) {
          if (res.status === 401) setExpired(true);
          else if (res.ok) setExpired(false);
        }
      } catch {
        // Never let the observer break the request.
      }
      return res;
    };

    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.fetch = original;
    };
  }, []);

  if (!expired) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: 560,
        width: 'calc(100% - 32px)',
        background: '#14304F',
        color: '#FFFFFF',
        borderLeft: '4px solid #C69C3E',
        borderRadius: 8,
        padding: '14px 18px',
        boxShadow: '0 10px 30px rgba(15, 27, 45, 0.25)',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Your session has expired</strong>
      Nothing was saved since it ran out. Sign in again in a new tab, then come back and press Save:
      your edits on this page are still here.{' '}
      <a
        href="/admin/login"
        target="_blank"
        rel="noopener"
        style={{ color: '#E8C77A', fontWeight: 700, textDecoration: 'underline' }}
      >
        Sign in again
      </a>
    </div>
  );
}
