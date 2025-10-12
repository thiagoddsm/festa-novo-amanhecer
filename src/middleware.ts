'use server';
import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = publicPaths.some(p => path.startsWith(p));
  
  const sessionCookie = request.cookies.get('firebase-session')?.value;

  if (sessionCookie && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!sessionCookie && !isPublicPath) {
     return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
