'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth, FirebaseClientProvider } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createInitialAdminUser } from '@/lib/actions';
import Image from 'next/image';
import { FullPageLoader } from '@/components/ui/loader';
import { useUserData } from '@/hooks/use-user-data';

const loginSchema = z.object({
  email: z.string().email('Por favor, insira um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: userLoading } = useUserData();

  useEffect(() => {
    if (!userLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, userLoading, router]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    console.log('[DIAGNOSTIC] Tentativa de login iniciada para:', data.email);

    if (!auth) {
        console.error('[DIAGNOSTIC] Objeto de autenticação do Firebase é nulo.');
        toast({
            variant: 'destructive',
            title: 'Erro Crítico de Configuração',
            description: 'O serviço de autenticação não foi inicializado corretamente.',
        });
        setIsLoading(false);
        return;
    }

    try {
      console.log('[DIAGNOSTIC] Chamando signInWithEmailAndPassword...');
      await signInWithEmailAndPassword(auth, data.email, data.password);
      console.log('[DIAGNOSTIC] Login bem-sucedido. Redirecionando para /dashboard');
      router.push('/dashboard');
    } catch (error: any) {
      console.error('[DIAGNOSTIC] Erro detalhado no login:', error);
      let message = 'Ocorreu um erro ao fazer login.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          message = 'E-mail ou senha inválidos.';
      } else {
          message = `Erro: ${error.message}`;
      }
      toast({
        variant: 'destructive',
        title: 'Erro de Login',
        description: message,
      });
    } finally {
        console.log('[DIAGNOSTIC] Finalizando tentativa de login.');
        setIsLoading(false);
    }
  };

  useEffect(() => {
      console.log('[DIAGNOSTIC] Executando createInitialAdminUser setup...');
      createInitialAdminUser().then(result => {
          if (result && result.message) {
              console.log('[DIAGNOSTIC] Resultado do setup do admin:', result);
              if (result.status === 'success') {
                toast({ title: 'Configuração do Sistema', description: result.message });
              } else {
                toast({ title: 'Aviso de Configuração', description: result.message, variant: 'destructive'});
              }
          }
      }).catch(err => {
          console.error("[DIAGNOSTIC] Falha crítica na execução do setup do admin:", err);
          toast({ title: 'Erro Crítico', description: 'Falha ao configurar usuário administrador inicial.'});
      })
  }, [toast]);
  
  if (userLoading || (!userLoading && user)) {
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Entrar'}
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
            <LoginPageContent />
        </FirebaseClientProvider>
    )
}
