import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

// Helper to ensure Firebase Admin is initialized only once
if (!getApps().length) {
  initializeApp();
}

const PROTECTED_ROUTES = ['/dashboard', '/cashier', '/pos', '/cards', '/transactions', '/admin'];
const PUBLIC_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    if (!sessionCookie) {
      // If no session cookie and accessing a protected route, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Verify the session cookie.
      await auth().verifySessionCookie(sessionCookie, true);
      // Session is valid, allow the request to proceed.
      return NextResponse.next();
    } catch (error) {
      // Session cookie is invalid, redirect to login.
      console.error('Error verifying session cookie in middleware:', error);
      const response = NextResponse.redirect(new URL('/login', request.url));
      // Clear the invalid cookie
      response.cookies.delete('session');
      return response;
    }
  }

  // Handle public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (sessionCookie) {
      try {
        // If there's a valid session, redirect from login to dashboard
        await auth().verifySessionCookie(sessionCookie, true);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch (error) {
         // Invalid cookie, let them stay on the login page but clear the cookie
        const response = NextResponse.next();
        response.cookies.delete('session');
        return response;
      }
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.svg (icon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
