'use client';
import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FullPageLoader } from '@/components/ui/loader';
import { Logo } from '@/components/layout/Logo';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/hooks/use-auth-context';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tenant {
  id: string;
  name: string;
}

interface TenantEvent {
  id: string;
  name: string;
}

interface Pdv {
  id: string;
  nome: string;
  event_id?: string;
  tenant_id?: string;
}

// ---------------------------------------------------------------------------
// Google icon SVG
// ---------------------------------------------------------------------------

const GoogleIcon = () => (
  <svg
    className="mr-2 h-4 w-4"
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.36 1.84-4.48 1.84-5.35 0-9.73-4.38-9.73-9.73s4.38-9.73 9.73-9.73c3.1 0 4.98 1.24 6.13 2.36l2.73-2.73C19.4 2.59 16.21 1 12.48 1 5.83 1 1 5.83 1 12.48s4.83 11.48 11.48 11.48c6.65 0 11.12-4.66 11.12-11.48 0-.79-.07-1.54-.19-2.26h-11z"
      fillRule="evenodd"
      clipRule="evenodd"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Main inner component
// ---------------------------------------------------------------------------

function LoginPageContent() {
  const firebaseAuth = useFirebaseAuth();
  const firestore = useFirestore();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // ---- Shared submitting state ----
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Entrar (login) form ----
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // ---- Criar Conta form ----
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'CAIXA' | 'PDV'>('CAIXA');
  const [selectedPdvId, setSelectedPdvId] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [events, setEvents] = useState<TenantEvent[]>([]);
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingPdvs, setLoadingPdvs] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // ---- Redirect authenticated users ----
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === 'PDV' ? '/pos' : '/dashboard');
    }
  }, [user, loading, router]);

  // ---- Load tenants on mount ----
  useEffect(() => {
    if (!firestore) return;
    setLoadingTenants(true);
    getDocs(collection(firestore, 'tenants'))
      .then((snap) => {
        setTenants(
          snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))
        );
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar as organizações.',
        });
      })
      .finally(() => setLoadingTenants(false));
  }, [firestore, toast]);

  // ---- Load events when tenant changes ----
  useEffect(() => {
    setEvents([]);
    setSelectedEventId('');
    setPdvs([]);
    setSelectedPdvId('');
    if (!firestore || !selectedTenantId) return;
    setLoadingEvents(true);
    getDocs(collection(firestore, 'tenants', selectedTenantId, 'events'))
      .then((snap) => {
        setEvents(
          snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))
        );
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar os eventos.',
        });
      })
      .finally(() => setLoadingEvents(false));
  }, [firestore, selectedTenantId, toast]);

  // ---- Load PDVs when event or tenant changes ----
  useEffect(() => {
    setPdvs([]);
    setSelectedPdvId('');
    if (!firestore || !selectedTenantId || !selectedEventId) return;
    setLoadingPdvs(true);
    getDocs(collection(firestore, 'pdvs'))
      .then((snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv));
        // Apenas barracas do evento escolhido (exclui o Caixa Central)
        const filtered = all
          .filter(
            (p) =>
              p.tenant_id === selectedTenantId &&
              p.event_id === selectedEventId &&
              p.nome !== 'Caixa Central'
          )
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setPdvs(filtered);
      })
      .catch(() => {
        console.warn('Erro ao carregar PDVs.');
      })
      .finally(() => setLoadingPdvs(false));
  }, [firestore, selectedTenantId, selectedEventId]);

  // ---- Handlers ----

  const onEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, loginEmail, loginPassword);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de Login',
        description: 'Email ou senha inválidos.',
      });
      setIsSubmitting(false);
    }
  };

  const onGoogleLogin = async () => {
    if (!firebaseAuth) return;
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(firebaseAuth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          variant: 'destructive',
          title: 'Erro de Login',
          description: 'Não foi possível fazer login com o Google.',
        });
      }
      setIsSubmitting(false);
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseAuth || !firestore) return;

    if (signupPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    if (signupPassword !== signupConfirm) {
      toast({
        variant: 'destructive',
        title: 'Senhas não coincidem',
        description: 'Confirme a senha corretamente.',
      });
      return;
    }

    if (!selectedTenantId) {
      toast({
        variant: 'destructive',
        title: 'Organização obrigatória',
        description: 'Selecione uma organização.',
      });
      return;
    }

    if (!selectedEventId) {
      toast({
        variant: 'destructive',
        title: 'Evento obrigatório',
        description: 'Selecione o evento em que você vai trabalhar.',
      });
      return;
    }

    if (selectedRole === 'PDV' && pdvs.length > 0 && !selectedPdvId) {
      toast({
        variant: 'destructive',
        title: 'Barraca obrigatória',
        description: 'Selecione a barraca onde você vai atuar.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        signupEmail,
        signupPassword
      );
      const uid = credential.user.uid;

      await setDoc(doc(firestore, 'users', uid), {
        name: signupName,
        email: signupEmail,
        role: 'VISITANTE',
        requestedTenantId: selectedTenantId,
        requestedEventId: selectedEventId || null,
        requestedRole: selectedRole,
        requestedPdvId: selectedRole === 'PDV' ? selectedPdvId || null : null,
      });

      // Sign out immediately so they wait for admin approval
      await firebaseAuth.signOut();

      setSignupSuccess(true);
    } catch (error: any) {
      const message =
        error.code === 'auth/email-already-in-use'
          ? 'Este email já está cadastrado.'
          : 'Não foi possível criar a conta.';
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Render ----

  if (loading || user) {
    return <FullPageLoader />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center items-center pb-2">
          <Logo className="mb-4" />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="entrar">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="entrar" className="flex-1">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="criar" className="flex-1">
                Criar Conta
              </TabsTrigger>
            </TabsList>

            {/* ---- ENTRAR TAB ---- */}
            <TabsContent value="entrar">
              <Tabs defaultValue="email">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="email" className="flex-1">
                    Email / Senha
                  </TabsTrigger>
                  <TabsTrigger value="google" className="flex-1">
                    Google
                  </TabsTrigger>
                </TabsList>

                {/* Email login sub-tab */}
                <TabsContent value="email">
                  <form onSubmit={onEmailLogin} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="login-password">Senha</Label>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="animate-spin" /> : 'Entrar'}
                    </Button>
                  </form>
                </TabsContent>

                {/* Google login sub-tab */}
                <TabsContent value="google">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onGoogleLogin}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <GoogleIcon />
                        Continuar com Google
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ---- CRIAR CONTA TAB ---- */}
            <TabsContent value="criar">
              {signupSuccess ? (
                <div className="rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-6 text-center text-sm">
                  Cadastro enviado! Aguarde aprovação de um administrador.
                </div>
              ) : (
                <form onSubmit={onSignup} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="João da Silva"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-confirm">Confirmar senha</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      placeholder="Repita a senha"
                    />
                  </div>

                  {/* Organisation select */}
                  <div className="space-y-1">
                    <Label htmlFor="signup-tenant">Organização</Label>
                    <Select
                      required
                      value={selectedTenantId}
                      onValueChange={setSelectedTenantId}
                      disabled={loadingTenants}
                    >
                      <SelectTrigger id="signup-tenant">
                        <SelectValue
                          placeholder={
                            loadingTenants ? 'Carregando...' : 'Selecione a organização'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Event select — optional, only shown once a tenant is chosen */}
                  {selectedTenantId && (
                    <div className="space-y-1">
                      <Label htmlFor="signup-event">Evento</Label>
                      <Select
                        value={selectedEventId}
                        onValueChange={setSelectedEventId}
                        disabled={loadingEvents}
                      >
                        <SelectTrigger id="signup-event">
                          <SelectValue
                            placeholder={
                              loadingEvents ? 'Carregando...' : 'Selecione um evento'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {events.map((ev) => (
                            <SelectItem key={ev.id} value={ev.id}>
                              {ev.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Role select — Caixa or PDV */}
                  {selectedTenantId && (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="signup-role">Função Desejada</Label>
                      <Select
                        value={selectedRole}
                        onValueChange={(val) => setSelectedRole(val as 'CAIXA' | 'PDV')}
                      >
                        <SelectTrigger id="signup-role">
                          <SelectValue placeholder="Selecione a função" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAIXA">Operador de Caixa Central</SelectItem>
                          <SelectItem value="PDV">Operador de PDV (Barraca / Comida / Bebida)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* PDV / Barraca select — only shown if PDV is selected */}
                  {selectedTenantId && selectedRole === 'PDV' && (
                    <div className="space-y-1">
                      <Label htmlFor="signup-pdv">Barraca / Ponto de Venda</Label>
                      {!selectedEventId ? (
                        <p className="text-[11px] text-muted-foreground">
                          Escolha o evento acima para ver as barracas.
                        </p>
                      ) : (
                        <>
                          <Select
                            value={selectedPdvId}
                            onValueChange={setSelectedPdvId}
                            disabled={loadingPdvs || pdvs.length === 0}
                          >
                            <SelectTrigger id="signup-pdv">
                              <SelectValue
                                placeholder={
                                  loadingPdvs
                                    ? 'Carregando barracas...'
                                    : pdvs.length === 0
                                    ? 'Nenhuma barraca neste evento'
                                    : 'Selecione a barraca'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {pdvs.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            {loadingPdvs
                              ? ''
                              : pdvs.length === 0
                              ? 'Este evento ainda não tem barracas. Você pode enviar o cadastro e o administrador define a sua barraca na aprovação.'
                              : 'Selecione a barraca onde você atuará no evento.'}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      'Solicitar Cadastro'
                    )}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper — ensures providers are available before rendering content
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <LoginPageContent />
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
