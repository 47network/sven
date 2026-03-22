import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/setup', '/community-public'];
const ADMIN_BASE_PATH = process.env.ADMIN_BASE_PATH || '/admin47';

function normalizePath(pathname: string): string {
  if (!ADMIN_BASE_PATH || ADMIN_BASE_PATH === '/') return pathname;
  if (pathname === ADMIN_BASE_PATH) return '/';
  if (pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return pathname.slice(ADMIN_BASE_PATH.length) || '/';
  }
  return pathname;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const appPath = normalizePath(pathname);

  if (PUBLIC_PATHS.some((p) => appPath.startsWith(p))) {
    return NextResponse.next();
  }

  if (appPath.startsWith('/_next') || appPath.startsWith('/api') || appPath.startsWith('/v1')) {
    return NextResponse.next();
  }

  const token = searchParams.get('token');
  if (token) {
    const exchangeUrl = new URL('/v1/auth/token-exchange', request.url);
    exchangeUrl.searchParams.set('token', token);
    exchangeUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(exchangeUrl);
  }

  const session = request.cookies.get('sven_session');
  if (!session?.value) {
    const loginUrl = new URL(`${ADMIN_BASE_PATH}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
