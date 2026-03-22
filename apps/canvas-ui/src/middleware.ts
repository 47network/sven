import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for VPN-first access model.
 *
 * 1. Checks for session cookie on protected routes — redirects to /login if missing.
 * 2. Supports signed deep-link tokens (optional) via ?token= query parameter.
 *    When a valid token is present, it sets the session cookie and redirects
 *    to the target path, enabling one-click access from push notifications.
 *
 * The actual token verification happens server-side in the gateway;
 * this middleware delegates to the gateway's token exchange endpoint.
 */

const PUBLIC_PATHS = [
  '/login',
  '/shared',
  '/privacy',
  '/terms',
  '/docs',
  '/skills',
  '/marketplace',
  '/community',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
  '/sw.js',
];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const redirectTarget = `${pathname}${request.nextUrl.search || ''}`;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals and API proxy
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Deep-link token exchange
  const token = searchParams.get('token');
  if (token) {
    // Redirect to API for token exchange, which sets the session cookie
    // and redirects back to the target path
    const exchangeUrl = new URL('/api/v1/auth/token-exchange', request.url);
    exchangeUrl.searchParams.set('token', token);
    exchangeUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(exchangeUrl);
  }

  // Check session cookie
  const session = request.cookies.get('sven_session');
  if (!session?.value) {
    const tailscaleLogin = String(request.headers.get('tailscale-user-login') || '').trim();
    const forwardedFor = String(request.headers.get('x-forwarded-for') || '').trim();
    const forwardedProto = String(request.headers.get('x-forwarded-proto') || '').trim();
    const forwardedHost = String(request.headers.get('x-forwarded-host') || '').trim();
    if (tailscaleLogin && forwardedFor && forwardedProto && forwardedHost) {
      const bootstrapUrl = new URL('/api/v1/auth/tailscale/bootstrap', request.url);
      bootstrapUrl.searchParams.set('redirect', redirectTarget);
      return NextResponse.redirect(bootstrapUrl);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
