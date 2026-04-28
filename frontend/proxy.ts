import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/chats', '/profile', '/settings'];
const PUBLIC_ROUTES = ['/login', '/register'];

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;

  // Handle root path - redirect to /chats (if authenticated) or /login
  if (pathname === '/') {
    if (accessToken) {
      return NextResponse.redirect(new URL('/chats', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if trying to access protected route without token
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect to login if accessing protected route without token
  if (isProtectedRoute && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to chats if accessing public route with token
  if (isPublicRoute && accessToken) {
    return NextResponse.redirect(new URL('/chats', request.url));
  }

  // Allow the request to continue
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
