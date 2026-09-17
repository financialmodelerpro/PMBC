import { NextResponse } from 'next/server';

import { attributionCookie } from './bookingLinks';
import type { BookingRedirect } from './bookingRedirect';

/**
 * The redirect to /book with no query string, carrying the attribution cookie
 * when there is one. The Location is relative, so it always stays on the host
 * the visitor used. Never cached, never indexed.
 */
export function bookingRedirectResponse(req: Request, outcome: BookingRedirect): NextResponse {
  const secure = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  const res = new NextResponse(null, { status: 302, headers: { location: outcome.location } });
  if (outcome.attribution) res.headers.append('set-cookie', attributionCookie(outcome.attribution, secure));
  res.headers.set('cache-control', 'no-store');
  res.headers.set('x-robots-tag', 'noindex');
  res.headers.set('referrer-policy', 'no-referrer');
  return res;
}
