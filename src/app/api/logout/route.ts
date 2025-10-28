import { NextResponse } from 'next/server';
import { auth } from 'firebase-admin';
import { getApps, initializeApp } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp();
}

export async function POST() {
  try {
    const response = NextResponse.json({ status: 'success' });
    
    // Invalidate the session cookie by setting its maxAge to 0
    response.cookies.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Error logging out:', error);
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 });
  }
}
