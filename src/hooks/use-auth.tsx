'use client';

import { useCallback } from 'react';
import { signInWithPopup, GoogleAuthProvider, getAuth } from 'firebase/auth';
import { useFirebase } from '@/firebase';

export const useAuth = () => {
  const { app } = useFirebase();
  const auth = app ? getAuth(app) : null;

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      console.error("Firebase Auth não está inicializado.");
      throw new Error("Firebase Auth não está inicializado.");
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // O hook useUser cuidará de redirecionar e setar o cookie
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      throw error;
    }
  }, [auth]);

  // Este hook agora só expõe a ação de login.
  // O estado do usuário é gerenciado por useUser.
  return { signInWithGoogle };
};
