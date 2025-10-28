'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth as useFirebaseAuth, FirebaseClientProvider } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createInitialAdminUser } from '@/lib/actions';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/hooks/use-auth-context';
import { FullPageLoader } from '@/components/ui/loader';

const loginSchema = z.object({
  email: z.string().email('Por favor, insira um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const auth = useFirebaseAuth();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // This effect now ONLY handles redirection for an ALREADY authenticated user trying to access the login page.
  useEffect(() => {
    if (!loading && user) {
        if (user.role === 'PDV') {
            router.replace('/pos');
        } else {
            router.replace('/dashboard');
        }
    }
  }, [user, loading, router]);


  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    if (!auth) {
        toast({
            variant: 'destructive',
            title: 'Erro Crítico de Configuração',
            description: 'O serviço de autenticação não foi inicializado corretamente.',
        });
        setIsSubmitting(false);
        return;
    }

    try {
      // The onIdTokenChanged listener in AuthProvider will handle the user state update.
      // The useEffect in the main app layout will handle the redirect. We just sign in here.
      await signInWithEmailAndPassword(auth, data.email, data.password);
      
    } catch (error: any) {
      console.error('[DIAGNOSTIC] Erro detalhado no login:', error);
      let message = 'Ocorreu um erro ao fazer login.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          message = 'E-mail ou senha inválidos.';
      }
      toast({
        variant: 'destructive',
        title: 'Erro de Login',
        description: message,
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  // This effect runs once on mount to ensure the admin user exists.
  useEffect(() => {
      createInitialAdminUser().then(result => {
          if (result && result.message) {
              if (result.status === 'success' && result.message.includes('criado')) {
                toast({ title: 'Configuração do Sistema', description: result.message });
              } else if (result.status === 'error') {
                toast({ title: 'Aviso de Configuração', description: result.message, variant: 'destructive'});
              }
          }
      }).catch(err => {
          console.error("[DIAGNOSTIC] Falha crítica na execução do setup do admin:", err);
          toast({ title: 'Erro Crítico', description: 'Falha ao configurar usuário administrador inicial.'});
      })
  }, [toast]);

  // While checking auth state or if the user is already logged in (and we are about to redirect), show a loader.
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Entrar'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function LoginPage() {
    return (
        <FirebaseClientProvider>
            <AuthProvider>
                <LoginPageContent />
            </AuthProvider>
        </FirebaseClientProvider>
    )
}
