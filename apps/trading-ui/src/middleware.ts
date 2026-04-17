import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Trading UI is publicly viewable — guests can see what Sven does.
 * Login is only required for actions (POST requests are gated at the API layer).
 * The middleware now passes all requests through without auth checks.
 * The API client handles 401s for gated endpoints and redirects to /login.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
