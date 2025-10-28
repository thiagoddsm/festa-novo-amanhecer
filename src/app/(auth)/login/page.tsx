'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, getAdditionalUserInfo } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth-context';
import { FullPageLoader } from '@/components/ui/loader';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/hooks/use-auth-context';

const loginSchema = z.object({
  email: z.string().email('Por favor, insira um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.36 1.84-4.48 1.84-5.35 0-9.73-4.38-9.73-9.73s4.38-9.73 9.73-9.73c3.1 0 4.98 1.24 6.13 2.36l2.73-2.73C19.4 2.59 16.21 1 12.48 1 5.83 1 1 5.83 1 12.48s4.83 11.48 11.48 11.48c6.65 0 11.12-4.66 11.12-11.48 0-.79-.07-1.54-.19-2.26h-11z" fillRule="evenodd" clipRule="evenodd"/>
    </svg>
);

function LoginPageContent() {
  const firebaseAuth = useFirebaseAuth();
  const firestore = useFirestore();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'PDV' ? '/pos' : '/dashboard');
    }
  }, [user, loading, router]);

  const handleAuthSuccess = async (firebaseUser: any) => {
    if (!firestore) return;

    const userDocRef = doc(firestore, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // Create a user profile in Firestore for new Google Sign-In users
      try {
        await setDoc(userDocRef, {
          name: firebaseUser.displayName || 'Novo Usuário',
          email: firebaseUser.email,
          role: 'CAIXA', // Default role for new sign-ups
        });
      } catch (error) {
         console.error("Error creating user profile:", error);
         toast({ variant: 'destructive', title: 'Erro de Perfil', description: 'Não foi possível criar seu perfil de usuário.' });
         // Sign out if profile creation fails
         await firebaseSignOut(firebaseAuth);
      }
    }
    // For existing users (or email/password users), the profile should already exist.
    // The AuthProvider will handle fetching the profile and redirecting.
  };

  const onEmailSubmit = async (data: LoginFormValues) => {
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, data.email, data.password);
      // AuthProvider will detect the new user and handle the redirect
    } catch (error: any) {
      let message = 'Ocorreu um erro ao fazer login.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'E-mail ou senha inválidos.';
      }
      toast({ variant: 'destructive', title: 'Erro de Login', description: message });
      setIsSubmitting(false);
    }
    // No need for finally block to set isSubmitting to false, as successful login will unmount the component
  };

  const onGoogleSubmit = async () => {
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(firebaseAuth, provider);
        // After successful sign in, ensure profile exists
        await handleAuthSuccess(result.user);
        // AuthProvider will now detect the new user and handle the redirect
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
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Image src="/icon.svg" alt="FestaPay Logo" width={48} height={48} />
          </div>
          <CardTitle>Bem-vindo ao FestaPay</CardTitle>
          <CardDescription>Faça login para acessar o painel</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="seu@email.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl><Input type="password" placeholder="******" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </Form>
          <div className="relative my-6">
            <Separator />
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
            </div>
          </div>
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
