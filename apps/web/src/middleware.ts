import { NextResponse, type NextRequest } from 'next/server';

// Soft guard: if there's no session cookie at all, send to /login before the
// dashboard flashes. Real authorization is always enforced by the API.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('access_token');
  const { pathname } = req.nextUrl;

  // Only guard app routes. We intentionally do NOT auto-redirect /login -> /dues
  // on cookie presence: a stale/expired cookie is still "present" but invalid, and
  // bouncing it to /dues (which then bounces back) causes a blank redirect loop.
  // The login page + the dashboard's own session check handle authenticated users.
  if (!hasSession && pathname !== '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Guard app routes; skip Next internals, the API proxy, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
