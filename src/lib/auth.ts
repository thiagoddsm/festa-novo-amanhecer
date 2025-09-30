import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type AuthenticatedUser = {
  isAuthenticated: true;
  role: 'CAIXA' | 'PDV';
  name: string;
  pdvId?: number;
};

export type SessionData = {
  user?: AuthenticatedUser;
};

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD || 'complex_password_at_least_32_characters_long',
  cookieName: 'festapay-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function checkAuth() {
  const session = await getIronSession<SessionData>(cookies(), SESSION_OPTIONS);
  return session;
}
