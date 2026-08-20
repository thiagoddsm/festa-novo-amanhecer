'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/use-tenant-context';
import { useAuth } from '@/hooks/use-auth-context';
import { Building2, CalendarPlus, Loader2, Sparkles, Pencil, CheckCircle2, Calendar, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/provider';
import type { Tenant, Event } from '@/lib/definitions';
import MigrationButton from '@/components/admin/MigrationButton';

export default function TenantsPage() {
  const firestore = useFirestore();
  const { user } = useAuth();
  const { currentTenant, currentEvent, tenantsList, eventsList } = useTenant();
  const { toast } = useToast();

  const [isCreatingTenant, setIsCreatingTenant] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Forms state
  const [tenantName, setTenantName] = useState('');
  const [eventName, setEventName] = useState('');

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !user || !firestore) return;

    setIsCreatingTenant(true);
    try {
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const tenantRef = doc(firestore, 'tenants', slug);
      
      const newTenantData: Omit<Tenant, 'id'> = {
        name: tenantName,
        slug,
        owner_id: user.uid,
        plan: 'FREE',
        status: 'ACTIVE',
        created_at: Timestamp.now(),
      };

      await setDoc(tenantRef, newTenantData);

      // Link tenant to current user in Firestore /users/{uid}
      const userRef = doc(firestore, 'users', user.uid);
      await setDoc(userRef, {
        role: 'SUPERADMIN',
        tenants: {
          [slug]: { role: 'ADMIN' }
        }
      }, { merge: true });

      toast({
        title: 'Organização Criada!',
        description: `Organização "${tenantName}" cadastrada com sucesso.`
      });

      setTenantName('');
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description: err.message || 'Não foi possível cadastrar a organização.'
      });
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !currentTenant || !firestore) return;

    setIsCreatingEvent(true);
    try {
      const eventsRef = collection(firestore, 'tenants', currentTenant.id, 'events');
      
      const newEventData: Omit<Event, 'id'> = {
        tenant_id: currentTenant.id,
        name: eventName,
        status: 'ACTIVE',
        created_at: Timestamp.now(),
      };

      await addDoc(eventsRef, newEventData);

      toast({
        title: 'Evento Criado!',
        description: `Evento "${eventName}" adicionado para ${currentTenant.name}.`
      });

      setEventName('');
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description: err.message || 'Não foi possível cadastrar o evento.'
      });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciador Multi-Tenant</h1>
        <p className="text-muted-foreground">Cadastre e gerencie suas Organizações (Igrejas/Produtoras) e Eventos.</p>
        <MigrationButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nova Organização (Tenant) */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" /> Nova Organização (Tenant)
            </CardTitle>
            <CardDescription>Cadastre um novo cliente, matriz ou igreja no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <Label htmlFor="tenant_name">Nome da Organização / Igreja</Label>
                <Input
                  id="tenant_name"
                  placeholder="Ex: Igreja Central / Produtora Festa X"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isCreatingTenant || !tenantName.trim()} className="w-full">
                {isCreatingTenant ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Cadastrar Organização
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Novo Evento */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarPlus className="h-5 w-5 text-primary" /> Novo Evento
            </CardTitle>
            <CardDescription>
              Adicione um novo evento para a organização ativa:{' '}
              <Badge variant="outline" className="font-semibold text-primary">{currentTenant?.name || 'Nenhuma selecionada'}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <Label htmlFor="event_name">Nome do Evento</Label>
                <Input
                  id="event_name"
                  placeholder="Ex: Festa da Padroeira 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  disabled={!currentTenant}
                  required
                />
              </div>
              <Button type="submit" disabled={isCreatingEvent || !eventName.trim() || !currentTenant} className="w-full">
                {isCreatingEvent ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
                Cadastrar Evento
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Organizações e Eventos Cadastrados */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Organizações e Eventos Cadastrados</CardTitle>
          <CardDescription>Gerencie eventos, renomeie e consulte os responsáveis por cada organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {tenantsList.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma organização cadastrada ainda. Crie a primeira acima!</p>
          ) : (
            <div className="space-y-6">
              {tenantsList.map((t) => (
                <TenantEventsDetail key={t.id} tenant={t} firestore={firestore} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TenantEventsDetail({ tenant, firestore }: { tenant: Tenant; firestore: any }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore || !tenant.id) return;
    const eventsRef = collection(firestore, 'tenants', tenant.id, 'events');
    const unsub = onSnapshot(eventsRef, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    });
    return () => unsub();
  }, [firestore, tenant.id]);

  const handleUpdateEventName = async (eventId: string) => {
    if (!editingName.trim() || !firestore) return;
    try {
      const eventDocRef = doc(firestore, 'tenants', tenant.id, 'events', eventId);
      await updateDoc(eventDocRef, { name: editingName.trim() });
      toast({ title: 'Evento Atualizado!', description: 'O nome do evento foi alterado com sucesso.' });
      setEditingEventId(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleToggleEventStatus = async (eventItem: Event) => {
    if (!firestore) return;
    const newStatus = eventItem.status === 'FINISHED' ? 'ACTIVE' : 'FINISHED';
    try {
      const eventDocRef = doc(firestore, 'tenants', tenant.id, 'events', eventItem.id);
      await updateDoc(eventDocRef, { status: newStatus });
      toast({ title: 'Status Atualizado', description: `Evento marcado como ${newStatus === 'FINISHED' ? 'Finalizado' : 'Ativo'}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };

  const handleDeleteTenant = async () => {
    if (!firestore || !tenant.id) return;
    try {
      const tenantDocRef = doc(firestore, 'tenants', tenant.id);
      await deleteDoc(tenantDocRef);
      toast({
        title: 'Organização Excluída',
        description: `A organização "${tenant.name}" foi removida com sucesso.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: err.message || 'Não foi possível excluir a organização.',
      });
    }
  };

  return (
    <div className="p-5 border rounded-xl bg-card space-y-4 shadow-xs">
      <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-bold text-lg">{tenant.name}</span>
          <Badge variant="secondary" className="text-xs">Slug: {tenant.slug}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={tenant.status === 'ACTIVE' ? 'default' : 'outline'}>Plano {tenant.plan}</Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir Organização">
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <Trash2 className="h-5 w-5" /> Confirmar Exclusão de Organização
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir a organização <strong>"{tenant.name}"</strong>?
                  <br />
                  <span className="text-destructive font-semibold">Esta ação é irreversível</span> e removerá o cadastro do tenant do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTenant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Excluir Organização
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eventos desta Organização ({events.length})</h4>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">Nenhum evento cadastrado para esta organização.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 text-sm">
                {editingEventId === e.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      value={editingName}
                      onChange={(evt) => setEditingName(evt.target.value)}
                      className="h-8 text-xs flex-grow"
                      autoFocus
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleUpdateEventName(e.id)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingEventId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{e.name}</span>
                      <Badge variant={e.status === 'FINISHED' ? 'secondary' : 'outline'} className="text-[10px]">
                        {e.status === 'FINISHED' ? 'Finalizado' : 'Ativo'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Editar nome do evento"
                        onClick={() => {
                          setEditingEventId(e.id);
                          setEditingName(e.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={e.status === 'FINISHED' ? 'Reativar Evento' : 'Finalizar Evento'}
                        onClick={() => handleToggleEventStatus(e)}
                      >
                        <CheckCircle2 className={`h-3.5 w-3.5 ${e.status === 'FINISHED' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
