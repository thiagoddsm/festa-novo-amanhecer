import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdmin } from './lib/firebase-admin';

async function verifySessionCookie(request: NextRequest) {
  const sessionCookie = request.cookies.get('firebase-session')?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    // Initialize admin app if not already done
    if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp();
    }
    const decodedIdToken = await getAuth(firebaseAdmin.app()).verifySessionCookie(sessionCookie, true);
    return decodedIdToken;
  } catch (error) {
    console.error('Error verifying session cookie:', error);
    return null;
  }
}


// Define which paths are public (don't require authentication)
const publicPaths = ['/login', '/api/login', '/api/logout'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicPath = publicPaths.some(p => path.startsWith(p));
  
  const decodedToken = await verifySessionCookie(request);

  if (decodedToken) {
    if (isPublicPath) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else {
    if (!isPublicPath) {
       const loginUrl = new URL('/login', request.url);
       loginUrl.searchParams.set('next', path);
       return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Config to specify which paths the middleware should run on
export const config = {
  matcher: ['/((?!api/_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
