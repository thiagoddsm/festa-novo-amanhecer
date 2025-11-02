'use client';
import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth-context';
import { FullPageLoader } from '@/components/ui/loader';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/hooks/use-auth-context';
import { Logo } from '@/components/layout/Logo';


const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.36 1.84-4.48 1.84-5.35 0-9.73-4.38-9.73-9.73s4.38-9.73 9.73-9.73c3.1 0 4.98 1.24 6.13 2.36l2.73-2.73C19.4 2.59 16.21 1 12.48 1 5.83 1 1 5.83 1 12.48s4.83 11.48 11.48 11.48c6.65 0 11.12-4.66 11.12-11.48 0-.79-.07-1.54-.19-2.26h-11z" fillRule="evenodd" clipRule="evenodd"/>
    </svg>
);

function LoginPageContent() {
  const firebaseAuth = useFirebaseAuth();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'VISITANTE') {
        // Stay on a simple page, or maybe redirect to a "waiting for approval" page.
        // For now, let's keep them on a page that just shows the header.
        router.replace('/dashboard'); // The layout will handle what they see.
      } else {
        router.replace(user.role === 'PDV' ? '/pos' : '/dashboard');
      }
    }
  }, [user, loading, router]);


  const onGoogleSubmit = async () => {
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(firebaseAuth, provider);
        // AuthProvider will now handle profile creation and redirection
    } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
            toast({ variant: 'destructive', title: 'Erro de Login', description: 'Não foi possível fazer login com o Google.' });
        }
        setIsSubmitting(false);
    }
  }

  if (loading || user) {
    return <FullPageLoader />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center items-center">
            <Logo className="mb-4" />
          <CardTitle>Bem-vindo ao FestaPay</CardTitle>
          <CardDescription>Faça login com sua conta Google para continuar</CardDescription>
        </CardHeader>
        <CardContent>
           <Button variant="outline" className="w-full" onClick={onGoogleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                ) : (
                    <>
                        <GoogleIcon />
                        Continuar com Google
                    </>
                )}
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// This wrapper ensures that the providers are available for the login page,
// allowing seamless redirects and state management.
export default function LoginPage() {
    return (
        <FirebaseClientProvider>
            <AuthProvider>
                <LoginPageContent />
            </AuthProvider>
        </FirebaseClientProvider>
    )
}
