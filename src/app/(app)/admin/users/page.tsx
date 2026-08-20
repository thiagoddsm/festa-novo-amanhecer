'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCog, X } from 'lucide-react';
import type { UserProfile, Pdv, Tenant, Event } from '@/lib/definitions';
import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function TenantUserEventSelector({
  tenantId,
  tenantName,
  isTenantAdmin,
  allowedEventsList,
  userRole,
  onUpdateAccess,
  onRemoveTenant,
  onRemoveEvent,
  firestore,
  isUpdating,
}: {
  tenantId: string;
  tenantName: string;
  isTenantAdmin: boolean;
  allowedEventsList: string[];
  userRole: string;
  onUpdateAccess: (accessData: any) => void;
  onRemoveTenant: (tenantId: string) => void;
  onRemoveEvent: (tenantId: string, eventId: string) => void;
  firestore: any;
  isUpdating: boolean;
}) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const eventsRef = collection(firestore, 'tenants', tenantId, 'events');
    const unsub = onSnapshot(eventsRef, (snapshot) => {
      setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Event)));
    });
    return () => unsub();
  }, [firestore, tenantId]);

  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-md bg-background border relative group">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-xs">🏢 {tenantName}</span>
          <Badge variant={isTenantAdmin ? 'default' : 'outline'} className="text-[9px]">
            {isTenantAdmin ? 'ADMIN DA IGREJA' : 'OPERADOR'}
          </Badge>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Desvincular Organização"
          onClick={() => onRemoveTenant(tenantId)}
          disabled={isUpdating}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isTenantAdmin ? (
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pl-1">
          ✨ Acesso total a todos os eventos
        </span>
      ) : (
        <div className="space-y-1.5 pt-1">
          {events.length > 0 && (
            <Select
              value=""
              onValueChange={(eventId) => {
                const updatedList = Array.from(new Set([...allowedEventsList, eventId]));
                onUpdateAccess({
                  tenantId,
                  role: userRole,
                  allowedEventIds: updatedList,
                  defaultEventId: eventId,
                });
              }}
              disabled={isUpdating}
            >
              <SelectTrigger className="h-7 text-xs bg-primary/10 text-primary border-primary/20">
                <SelectValue placeholder="➕ Liberar Evento Específico..." />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    📅 {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {allowedEventsList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allowedEventsList.map((evtId) => {
                const evtObj = events.find((e) => e.id === evtId);
                return (
                  <Badge key={evtId} variant="secondary" className="text-[10px] py-0.5 px-2 font-normal flex items-center gap-1">
                    <span>📅 {evtObj?.name || evtId}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveEvent(tenantId, evtId)}
                      className="text-muted-foreground hover:text-destructive ml-0.5"
                      title="Remover Acesso a este Evento"
                      disabled={isUpdating}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : (
            <span className="text-[10px] italic text-amber-600 block pl-1">
              Nenhum evento liberado ainda
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const RoleAndPdvManager = ({ user, pdvs, tenants }: { user: UserProfile; pdvs: Pdv[]; tenants: Tenant[] }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleUpdate = async (field: 'role' | 'pdvId' | 'tenantAccess' | 'removeTenantAccess' | 'removeEventAccess', value: any) => {
    setIsUpdating(true);
    const userRef = doc(firestore, 'users', user.id);
    let updateData: any = {};

    if (field === 'role') {
        updateData.role = value;
        if (user.role === 'PDV' && value !== 'PDV') {
            updateData.pdvId = null;
        }
    } else if (field === 'pdvId') {
        updateData.pdvId = value;
    }
    
    try {
      if (field === 'tenantAccess') {
        const existingTenants = user.tenants || {};
        const currentTenantAccess = existingTenants[value.tenantId] || {};
        const updatedTenants = {
          ...existingTenants,
          [value.tenantId]: {
            ...currentTenantAccess,
            role: value.role || currentTenantAccess.role || 'ADMIN',
            allowedEventIds: value.allowedEventIds || currentTenantAccess.allowedEventIds || [],
            ...(value.defaultEventId ? { defaultEventId: value.defaultEventId } : {})
          }
        };
        await setDoc(userRef, { tenants: updatedTenants }, { merge: true });
      } else if (field === 'removeTenantAccess') {
        const existingTenants = { ...(user.tenants || {}) };
        delete existingTenants[value.tenantId];
        await setDoc(userRef, { tenants: existingTenants });
      } else if (field === 'removeEventAccess') {
        const existingTenants = { ...(user.tenants || {}) };
        const currentAccess = existingTenants[value.tenantId];
        if (currentAccess && currentAccess.allowedEventIds) {
          currentAccess.allowedEventIds = currentAccess.allowedEventIds.filter((id: string) => id !== value.eventId);
          await setDoc(userRef, { tenants: existingTenants });
        }
      } else {
        await updateDoc(userRef, updateData);
      }
      toast({
        title: 'Sucesso!',
        description: `Permissões de ${user.name} foram atualizadas.`
      });
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast({
        variant: 'destructive',
        title: 'Erro!',
        description: error.message || 'Não foi possível atualizar os dados do usuário.'
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  if (user.email === 'thiagoddsm@gmail.com') {
    return <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">SUPERADMIN GERAL</Badge>;
  }

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantEvents, setTenantEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!selectedTenantId || !firestore) {
      setTenantEvents([]);
      return;
    }
    const eventsRef = collection(firestore, 'tenants', selectedTenantId, 'events');
    const unsub = onSnapshot(eventsRef, (snapshot) => {
      setTenantEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event)));
    });
    return () => unsub();
  }, [selectedTenantId, firestore]);

  return (
    <div className="flex flex-col gap-2 min-w-[240px]">
       <div className="flex items-center gap-2">
          <Select onValueChange={(value) => handleUpdate('role', value)} defaultValue={user.role} disabled={isUpdating}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Função Geral" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPERADMIN">Super Admin Geral</SelectItem>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="CAIXA">Caixa</SelectItem>
              <SelectItem value="PDV">Ponto de Venda</SelectItem>
              <SelectItem value="VISITANTE">Visitante (Aguardando)</SelectItem>
            </SelectContent>
          </Select>
       </div>
      
      {user.role === 'PDV' && (
        <Select onValueChange={(value) => handleUpdate('pdvId', value)} defaultValue={user.pdvId} disabled={isUpdating || pdvs.length === 0}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione um PDV" />
          </SelectTrigger>
          <SelectContent>
            {pdvs.map(pdv => (
              <SelectItem key={pdv.id} value={pdv.id}>{pdv.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Organizações & Eventos já vinculados */}
      {user.tenants && Object.keys(user.tenants).length > 0 && (
        <div className="flex flex-col gap-2 mb-1 bg-muted/20 p-2.5 rounded-lg border text-xs">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Organizações & Eventos Autorizados:</span>
          {Object.entries(user.tenants).map(([tid, accessInfo]: [string, any]) => {
            const tenantObj = tenants.find((t) => t.id === tid);
            const isTenantAdmin = accessInfo.role === 'ADMIN';
            const allowedEventsList = accessInfo.allowedEventIds || (accessInfo.defaultEventId ? [accessInfo.defaultEventId] : []);
            
            return (
              <TenantUserEventSelector
                key={tid}
                tenantId={tid}
                tenantName={tenantObj?.name || tid}
                isTenantAdmin={isTenantAdmin}
                allowedEventsList={allowedEventsList}
                userRole={user.role}
                onUpdateAccess={(updatedAccess) => handleUpdate('tenantAccess', updatedAccess)}
                onRemoveTenant={(tId) => handleUpdate('removeTenantAccess', { tenantId: tId })}
                onRemoveEvent={(tId, eId) => handleUpdate('removeEventAccess', { tenantId: tId, eventId: eId })}
                firestore={firestore}
                isUpdating={isUpdating}
              />
            );
          })}
        </div>
      )}

      {/* Vincular Nova Organização / Tenant */}
      {tenants.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <Select 
            value=""
            onValueChange={(tenantId) => {
              handleUpdate('tenantAccess', { tenantId, role: user.role });
            }} 
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 text-xs bg-muted/30">
              <SelectValue placeholder="➕ Vincular Nova Organização..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">🏢 {t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};


function useUsersAndPdvs() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    
    const usersUnsubscribe = onSnapshot(collection(firestore, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(allUsers);
    });

    const pdvsUnsubscribe = onSnapshot(collection(firestore, 'pdvs'), (snapshot) => {
        const allPdvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
        setPdvs(allPdvs);
    });

    const tenantsUnsubscribe = onSnapshot(collection(firestore, 'tenants'), (snapshot) => {
        const allTenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
        setTenants(allTenants);
    });

    return () => {
        usersUnsubscribe();
        pdvsUnsubscribe();
        tenantsUnsubscribe();
    };
  }, [firestore]);

  return { users, pdvs, tenants };
}

export default function UsersPage() {
  const { users, pdvs, tenants } = useUsersAndPdvs();
  const [isLoading, setIsLoading] = useState(true);

  const columns: ColumnDef<UserProfile>[] = [
    {
      accessorKey: 'name',
      header: 'Nome',
      filterFn: (row, id, value) => {
        const itemValue = String(row.getValue(id) || '').toLowerCase();
        return itemValue.includes(String(value || '').toLowerCase());
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      filterFn: (row, id, value) => {
        const itemValue = String(row.getValue(id) || '').toLowerCase();
        return itemValue.includes(String(value || '').toLowerCase());
      },
    },
    {
      accessorKey: 'role',
      header: 'Função & Organizações Vinculadas',
      cell: ({ row }) => {
         const user = row.original;
         return <RoleAndPdvManager user={user} pdvs={pdvs || []} tenants={tenants} />;
      },
       filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
       },
    },
  ];

  useEffect(() => {
    if (users !== null && pdvs !== null) {
      setIsLoading(false);
    }
  }, [users, pdvs]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog />
            Gerenciar Usuários & Acessos por Organização
          </CardTitle>
          <CardDescription>
            Como Administrador Geral (Super Admin), gerencie as permissões e vincule usuários a Organizações (Igrejas/Produtoras) específicas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              columns={columns}
              data={users || []}
              filterColumns={[
                { columnId: 'name', placeholder: 'Buscar por nome...' },
                { columnId: 'email', placeholder: 'Buscar por email...' },
                {
                  columnId: 'role',
                  placeholder: 'Filtrar por função...',
                  options: [
                    { value: 'SUPERADMIN', label: 'Super Admin Geral' },
                    { value: 'ADMIN', label: 'Administrador' },
                    { value: 'CAIXA', label: 'Caixa' },
                    { value: 'PDV', label: 'Ponto de Venda' },
                    { value: 'VISITANTE', label: 'Visitante' },
                  ],
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
