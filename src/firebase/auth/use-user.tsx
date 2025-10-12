'use client';
import { useEffect, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { useAuth } from '../provider';

async function setSessionCookie(idToken: string) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      throw new Error('Failed to set session cookie');
    }
}

async function clearSessionCookie() {
    await fetch('/api/logout', {
        method: 'POST',
    });
}

export const useUser = () => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setUser(user);
        try {
            const idToken = await user.getIdToken(true); // Force refresh
            await setSessionCookie(idToken);
        } catch(error) {
            console.error("Error setting session cookie", error);
            setUser(null);
            await clearSessionCookie();
        }
      } else {
        setUser(null);
        await clearSessionCookie();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
};
