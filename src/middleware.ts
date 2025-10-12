'use server';
import { NextResponse, type NextRequest } from 'next/server';

// Define which paths are public (don't require authentication)
const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = publicPaths.some(p => path.startsWith(p));
  
  const sessionCookie = request.cookies.get('firebase-session');

  // If there's a session cookie and the user is on a public path, redirect to dashboard
  if (sessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If there's no session cookie and the user is on a protected path, redirect to login
  if (!sessionCookie && !isPublicPath) {
     const loginUrl = new URL('/login', request.url);
     loginUrl.searchParams.set('next', path);
     return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Config to specify which paths the middleware should run on.
// It excludes API routes, static files, and image optimization files.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
