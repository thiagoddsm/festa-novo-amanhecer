import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SESSION_OPTIONS, type SessionData } from '@/lib/auth';

// Define which paths are public (don't require authentication)
const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Check if the current path is a public one
  const isPublicPath = publicPaths.some(p => path.startsWith(p));

  // Get session data
  const session = await getIronSession<SessionData>(request.cookies, SESSION_OPTIONS);
  const user = session.user;

  // --- Logic for authenticated users ---
  if (user?.isAuthenticated) {
    // If the user is authenticated and tries to access a public path (like /login),
    // redirect them to their respective main page.
    if (isPublicPath) {
      const url = user.role === 'CAIXA' ? '/cashier' : '/pos';
      return NextResponse.redirect(new URL(url, request.url));
    }

    // Role-based access control for private routes
    // If a PDV user tries to access a CAIXA-only page, redirect to /pos
    if (user.role === 'PDV' && (path.startsWith('/dashboard') || path.startsWith('/cashier'))) {
      return NextResponse.redirect(new URL('/pos', request.url));
    }
    
    // If a CAIXA user tries to access the root, redirect them to the cashier page
    if (user.role === 'CAIXA' && path === '/') {
        return NextResponse.redirect(new URL('/cashier', request.url));
    }

    // Allow access if none of the above conditions are met
    return NextResponse.next();
  }

  // --- Logic for unauthenticated users ---
  // If the user is not authenticated and is trying to access a private path,
  // redirect them to the login page.
  if (!isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Allow access to public paths for unauthenticated users
  return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
