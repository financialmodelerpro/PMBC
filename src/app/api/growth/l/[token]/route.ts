import { NextResponse } from 'next/server';

import { TRACK_COOKIE, TRACK_COOKIE_DAYS, recordClick } from '@/lib/growth/links';

export const dynamic = 'force-dynamic';

/**
 * A tracked link from an outreach email (Unit 3.2, 2026-09-23). Logs the
 * click, remembers the visitor for the website chat, and redirects to a path
 * on this site only. An unknown token, or any failure, goes to the home page:
 * a link in someone's inbox must never break.
 */
export async function GET(req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const origin = new URL(req.url).origin;
  let path = '/';
  let known = false;
  try {
    const r = await recordClick(token, req.headers);
    path = r.path;
    known = Boolean(r.link);
  } catch (err) {
    console.error('[growth-link] click not recorded:', err instanceof Error ? err.message : err);
  }
  const res = NextResponse.redirect(new URL(path, origin), 302);
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  res.headers.set('Cache-Control', 'no-store');
  if (known) res.cookies.set(TRACK_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: TRACK_COOKIE_DAYS * 86_400 });
  return res;
}
