import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SESSION_OPTIONS, type SessionData } from '@/lib/auth';

const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = publicPaths.some(p => path.startsWith(p));
  
  const session = await getIronSession<SessionData>(request.cookies, SESSION_OPTIONS);
  const user = session.user;

  if (isPublicPath && user?.isAuthenticated) {
    let url = '/dashboard';
    if(user.role === 'PDV') url = '/pos';
    return NextResponse.redirect(new URL(url, request.url));
  }

  if (!isPublicPath && !user?.isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Specific role checks for app routes
  if (path.startsWith('/dashboard') || path.startsWith('/cashier')) {
      if (user?.role !== 'CAIXA') {
          return NextResponse.redirect(new URL('/pos', request.url));
      }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
