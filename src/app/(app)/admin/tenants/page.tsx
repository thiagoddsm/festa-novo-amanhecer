'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Calendar, Plus, Trash2, Layers } from 'lucide-react';
import type { Tenant, TenantEvent } from '@/lib/definitions';

export default function TenantsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [eventsByTenant, setEventsByTenant] = useState<Record<string, TenantEvent[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // New Organization Dialog
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // New Event Dialog
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [selectedTenantForEvent, setSelectedTenantForEvent] = useState<Tenant | null>(null);
  const [newEventName, setNewEventName] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Load tenants
  useEffect(() => {
    if (!firestore) return;

    const unsubscribe = onSnapshot(collection(firestore, 'tenants'), async (snapshot) => {
      const tenantList = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Tenant),
      );
      setTenants(tenantList);
      setIsLoading(false);

      // Load events for each tenant
      const eventsMap: Record<string, TenantEvent[]> = {};
      for (const t of tenantList) {
        try {
          const eventsSnap = await getDocs(collection(firestore, 'tenants', t.id, 'events'));
          eventsMap[t.id] = eventsSnap.docs.map(
            (ed) => ({ id: ed.id, ...ed.data() } as TenantEvent),
          );
        } catch (e) {
          console.error(`Failed to load events for tenant ${t.id}`, e);
          eventsMap[t.id] = [];
        }
      }
      setEventsByTenant(eventsMap);
    });

    return () => unsubscribe();
  }, [firestore]);

  // Create Organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || isCreatingOrg) return;

    setIsCreatingOrg(true);
    try {
      await addDoc(collection(firestore, 'tenants'), {
        name: newOrgName.trim(),
        created_at: Timestamp.now(),
      });
      toast({ title: 'Sucesso!', description: `Organização "${newOrgName}" criada com sucesso.` });
      setNewOrgName('');
      setNewOrgOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar a organização.' });
    } finally {
      setIsCreatingOrg(false);
    }
  };

  // Delete Organization
  const handleDeleteOrg = async (tenant: Tenant) => {
    if (!confirm(`Tem certeza que deseja excluir a organização "${tenant.name}"?`)) return;

    try {
      await deleteDoc(doc(firestore, 'tenants', tenant.id));
      toast({ title: 'Excluída!', description: `Organização "${tenant.name}" foi removida.` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir a organização.' });
    }
  };

  // Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !selectedTenantForEvent || isCreatingEvent) return;

    setIsCreatingEvent(true);
    try {
      await addDoc(collection(firestore, 'tenants', selectedTenantForEvent.id, 'events'), {
        name: newEventName.trim(),
        active: true,
        created_at: Timestamp.now(),
      });
      toast({
        title: 'Sucesso!',
        description: `Evento "${newEventName}" adicionado à ${selectedTenantForEvent.name}.`,
      });
      setNewEventName('');
      setNewEventOpen(false);
      setSelectedTenantForEvent(null);

      // Refresh events for this tenant
      const eventsSnap = await getDocs(
        collection(firestore, 'tenants', selectedTenantForEvent.id, 'events'),
      );
      setEventsByTenant((prev) => ({
        ...prev,
        [selectedTenantForEvent.id]: eventsSnap.docs.map(
          (ed) => ({ id: ed.id, ...ed.data() } as TenantEvent),
        ),
      }));
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível criar o evento.' });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (tenantId: string, event: TenantEvent) => {
    if (!confirm(`Tem certeza que deseja remover o evento "${event.name}"?`)) return;

    try {
      await deleteDoc(doc(firestore, 'tenants', tenantId, 'events', event.id));
      toast({ title: 'Removido!', description: `Evento "${event.name}" foi removido.` });
      setEventsByTenant((prev) => ({
        ...prev,
        [tenantId]: (prev[tenantId] || []).filter((e) => e.id !== event.id),
      }));
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o evento.' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizações & Eventos
            </CardTitle>
            <CardDescription>
              Gerencie as igrejas, organizações e seus respectivos eventos cadastrados no FestaPay.
            </CardDescription>
          </div>

          <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Organização
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateOrg}>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Organização</DialogTitle>
                  <DialogDescription>
                    Insira o nome da igreja ou organização mantenedora.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <label className="text-sm font-medium">Nome da Organização</label>
                  <Input
                    placeholder="Ex: Igreja Batista da Manhã"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="mt-1"
                    autoFocus
                    required
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setNewOrgOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreatingOrg || !newOrgName.trim()}>
                    {isCreatingOrg ? 'Criando…' : 'Salvar Organização'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
          ) : tenants && tenants.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {tenants.map((tenant) => {
                const events = eventsByTenant[tenant.id] || [];

                return (
                  <Card key={tenant.id} className="border bg-card">
                    <CardHeader className="flex flex-row items-start justify-between pb-3">
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {tenant.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {events.length} evento(s) cadastrado(s)
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteOrg(tenant)}
                        title="Excluir Organização"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-3">
                      {/* Events list */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Eventos:
                        </span>

                        {events.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {events.map((ev) => (
                              <Badge
                                key={ev.id}
                                variant="secondary"
                                className="flex items-center gap-1 text-xs py-1 px-2.5 font-normal"
                              >
                                {ev.name}
                                <button
                                  type="button"
                                  className="ml-1 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteEvent(tenant.id, ev)}
                                  title="Remover Evento"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhum evento criado para esta organização.
                          </p>
                        )}
                      </div>

                      {/* Add Event Button */}
                      <div className="pt-2 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelectedTenantForEvent(tenant);
                            setNewEventOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar Evento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Nenhuma organização cadastrada</p>
              <p className="text-xs mt-1">
                Clique em &quot;Nova Organização&quot; acima para começar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Event Dialog */}
      <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
        <DialogContent>
          <form onSubmit={handleCreateEvent}>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Evento</DialogTitle>
              <DialogDescription>
                Organização: <strong>{selectedTenantForEvent?.name}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">Nome do Evento</label>
              <Input
                placeholder="Ex: Festa Novo Amanhecer 2027"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                className="mt-1"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewEventOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingEvent || !newEventName.trim()}>
                {isCreatingEvent ? 'Criando…' : 'Salvar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
