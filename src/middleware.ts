import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

  if (!token || token.role !== 'admin') {
    const loginUrl = new URL('/admin/login', req.url);
    if (pathname !== '/admin') {
      loginUrl.searchParams.set('callbackUrl', pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return nextWithPathname(req);
}
