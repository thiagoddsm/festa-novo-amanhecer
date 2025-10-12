'use client';
import { useEffect, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { useAuth } from '../';

async function setSessionCookie(idToken: string) {
    await fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
    });
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
      if (user) {
        setUser(user);
        const idToken = await user.getIdToken();
        await setSessionCookie(idToken);
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
