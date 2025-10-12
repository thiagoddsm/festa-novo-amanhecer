import { NextResponse } from 'next/server';

export async function POST() {
  const options = {
    name: 'firebase-session',
    value: '',
    maxAge: -1,
  };

  const response = NextResponse.json({ status: 'success' });
  response.cookies.set(options);
  return response;
}
