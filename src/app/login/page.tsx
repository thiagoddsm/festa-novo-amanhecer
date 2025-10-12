'use client';

import Image from "next/image";
import { useRouter } from 'next/navigation';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useFirebase } from '@/firebase'; 
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { app } = useFirebase();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    if (!app) return;
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard'); // Redirect to dashboard after successful login
    } catch (error) {
      console.error("Error signing in with Google: ", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-md text-center">
         <div className="flex justify-center mb-6">
            <Image src="/icon.svg" alt="FestaPay Logo" width={64} height={64} />
         </div>
         <h1 className="text-2xl font-bold mb-2">Bem-vindo ao FestaPay</h1>
         <p className="text-muted-foreground mb-6">Faça login para continuar.</p>
        <Button onClick={handleGoogleSignIn} className="w-full">
          Entrar com Google
        </Button>
      </div>
    </div>
  );
}
