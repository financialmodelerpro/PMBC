import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { isAdminOnlyPath } from '@/lib/auth/adminAccess';

export const config = {
  matcher: ['/admin/:path*'],
};

function nextWithPathname(req: NextRequest): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === '/admin/login') {
    return nextWithPathname(req);
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const role = token?.role;
  const signedIn = role === 'admin' || role === 'editor';

  if (!signedIn) {
    const loginUrl = new URL('/admin/login', req.url);
    if (pathname !== '/admin') {
      loginUrl.searchParams.set('callbackUrl', pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  // An editor typing an admin-only URL is sent to the dashboard, not to the
  // login screen: they are signed in, and inviting them to sign in again would
  // suggest the problem is their session. The API routes behind these screens
  // refuse independently, so this is the courtesy, not the control.
  if (role !== 'admin' && isAdminOnlyPath(pathname)) {
    return NextResponse.redirect(new URL('/admin?denied=1', req.url));
  }

  return nextWithPathname(req);
}
