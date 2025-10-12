import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdmin } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  const { idToken } = await request.json();

  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  try {
    // A inicialização já é tratada em firebase-admin.ts
    const sessionCookie = await getAuth(firebaseAdmin).createSessionCookie(idToken, { expiresIn });

    const options = {
      name: 'firebase-session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
    };

    const response = NextResponse.json({ status: 'success' });
    response.cookies.set(options);
    return response;

  } catch (error) {
    console.error('Error creating session cookie', error);
    return NextResponse.json({ status: 'error' }, { status: 401 });
  }
}
