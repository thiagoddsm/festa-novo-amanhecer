'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onIdTokenChanged, User } from 'firebase/auth';
import { useFirebase } from '@/firebase';

export const useAuth = () => {
  const { app } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = app ? getAuth(app) : null;

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      console.error("Firebase Auth não está inicializado.");
      return;
    }
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      // O onIdTokenChanged cuidará de atualizar o estado do usuário e o cookie
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const idToken = await firebaseUser.getIdToken();
        await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } else {
        setUser(null);
        await fetch('/api/logout', { method: 'POST' });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return { user, loading, signInWithGoogle };
};
