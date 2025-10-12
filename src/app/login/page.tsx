'use client';

import React, { useEffect, useCallback } from 'react';
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser } from '@/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function LoginPage() {
  const auth = useAuth();
  const { user, loading } = useUser();
  const router = useRouter();

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
      // O erro 'auth/unauthorized-domain' aparecerá aqui no console se a configuração estiver errada.
    }
  }, [auth]);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);
  
  const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 9.998C34.793 6.368 29.824 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691c2.126-3.488 5.799-5.945 10.111-6.536L9.998 38.802C6.368 34.793 4 29.824 4 24c0-3.14.78-6.066 2.16-8.68z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192L30.537 31.09C28.297 32.793 25.753 34 24 34c-4.418 0-8.28-2.05-10.74-5.226L6.299 35.436C9.99 40.846 16.639 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.16-4.087 5.571l7.537 7.537C41.258 36.372 44 30.636 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
           <div className="flex justify-center items-center mb-4">
            <Image src="/icon.svg" alt="FestaPay Logo" width={64} height={64} />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao FestaPay</CardTitle>
          <CardDescription>Faça login com o Google para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full" 
            onClick={signInWithGoogle}
            disabled={loading}
          >
            {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
                <>
                    <GoogleIcon />
                    Entrar com Google
                </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
