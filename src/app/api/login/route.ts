import { NextResponse } from 'next/server';
import { auth } from 'firebase-admin';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { firebaseConfig } from '@/firebase/config';

// Helper to ensure Firebase Admin is initialized only once
if (!getApps().length) {
  initializeApp();
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID token not provided' }, { status: 400 });
    }
    
    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await auth().createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ status: 'success' });
    response.cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: expiresIn,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Error creating session cookie:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
