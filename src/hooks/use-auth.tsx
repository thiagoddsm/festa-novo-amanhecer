"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onIdTokenChanged, signInWithPopup, GoogleAuthProvider, User, signOut as firebaseSignOut, AuthError } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from './use-toast';
import { initializeFirebase } from '@/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = initializeFirebase();

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
        setUser(user);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      
      const idToken = await result.user.getIdToken();

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        router.push('/dashboard');
      } else {
        throw new Error('Falha ao criar sessão no servidor.');
      }

    } catch (error) {
        const authError = error as AuthError;
        if (authError.code === 'auth/popup-blocked') {
            toast({
                variant: 'destructive',
                title: 'Pop-up Bloqueado',
                description: 'Seu navegador bloqueou a janela de login. Por favor, habilite pop-ups para este site.',
            });
        } else if (authError.code !== 'auth/cancelled-popup-request' && authError.code !== 'auth/popup-closed-by-user') {
             console.error("Error signing in with Google: ", error);
             toast({ variant: 'destructive', title: 'Erro de Login', description: authError.message });
        }
        setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
    } finally {
        setLoading(false);
    }
  };

  const value = { user, loading, signInWithGoogle, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
