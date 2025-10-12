"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onIdTokenChanged, signInWithPopup, GoogleAuthProvider, User, signOut as firebaseSignOut, AuthError, getAuth, Auth } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { useRouter } from 'next/navigation';
import { useToast } from './use-toast';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);


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

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
        setUser(user);
        
        const idToken = user ? await user.getIdToken() : null;

        await fetch(idToken ? '/api/login' : '/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      // The onIdTokenChanged listener will handle the rest
      router.push('/dashboard');
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
      // The onIdTokenChanged listener will handle clearing the cookie
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
