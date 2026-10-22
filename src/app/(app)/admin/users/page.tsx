'use client';

import {
  useState,
  useEffect,
  useMemo,
  memo,
  useCallback,
  useRef,
} from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserCog, X, Plus, CheckCircle, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { UserProfile, Pdv, Tenant, TenantEvent, TenantRole, UserRole } from '@/lib/definitions';
import { type ColumnDef } from '@tanstack/react-table';
import type { Firestore } from 'firebase/firestore';
import CreateUserDialog from '@/components/admin/CreateUserDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN_ORGANIZACAO: 'Admin Organização',
  ADMIN_EVENTO: 'Admin Evento',
  CAIXA: 'Caixa',
  PDV: 'PDV',
  VISITANTE: 'Visitante',
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  SUPERADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  ADMIN_ORGANIZACAO: 'bg-blue-100 text-blue-800 border-blue-300',
  ADMIN_EVENTO: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  CAIXA: 'bg-green-100 text-green-800 border-green-300',
  PDV: 'bg-orange-100 text-orange-800 border-orange-300',
  VISITANTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  ADMIN: 'Admin',
  OPERADOR: 'Operador',
  CAIXA: 'Caixa',
  PDV: 'PDV',
};

function RoleBadge({ role }: { role: UserRole }) {
  const label =
    role === 'VISITANTE' ? 'Aguardando Aprovação' : (ROLE_LABELS[role] ?? role);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASS[role] ?? ''}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lazy event loading cache (module-level, keyed by tenantId)
// ---------------------------------------------------------------------------
const eventCache: Record<string, TenantEvent[]> = {};

async function loadEvents(firestore: Firestore, tenantId: string): Promise<TenantEvent[]> {
  if (eventCache[tenantId]) return eventCache[tenantId];
  const snap = await getDocs(collection(firestore, 'tenants', tenantId, 'events'));
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TenantEvent));
  eventCache[tenantId] = events;
  return events;
}

// ---------------------------------------------------------------------------
// VisitanteAlert — show pending request and approve button
// ---------------------------------------------------------------------------
const VisitanteAlert = memo(
  ({ user, tenants, pdvs }: { user: UserProfile; tenants: Tenant[]; pdvs: Pdv[] }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isApproving, setIsApproving] = useState(false);
    const [eventName, setEventName] = useState<string | null>(null);

    const requestedTenant = tenants.find((t) => t.id === user.requestedTenantId);
    const requestedPdv = user.requestedPdvId ? pdvs.find((p) => p.id === user.requestedPdvId) : null;

    useEffect(() => {
      if (!firestore || !user.requestedTenantId || !user.requestedEventId) return;

      loadEvents(firestore, user.requestedTenantId)
        .then((events) => {
          const found = events.find((e) => e.id === user.requestedEventId);
          if (found) {
            setEventName(found.name);
          }
        })
        .catch((err) => console.warn('Erro ao carregar nome do evento solicitado:', err));
    }, [firestore, user.requestedTenantId, user.requestedEventId]);

    if (!user.requestedTenantId) return null;

    const handleApprove = async () => {
      if (isApproving) return;
      setIsApproving(true);
      try {
        const tenantId = user.requestedTenantId!;
        const eventId = user.requestedEventId;
        const reqRole = user.requestedRole;

        let newGlobalRole: UserRole = 'CAIXA';
        let newTenantRole: TenantRole = 'CAIXA';

        if (reqRole === 'PDV') {
          newGlobalRole = 'PDV';
          newTenantRole = 'PDV';
        } else if (reqRole === 'CAIXA') {
          newGlobalRole = 'CAIXA';
          newTenantRole = 'CAIXA';
        } else {
          // Fallback legacy
          newGlobalRole = eventId ? 'ADMIN_EVENTO' : 'ADMIN_ORGANIZACAO';
          newTenantRole = eventId ? 'CAIXA' : 'ADMIN';
        }

        const tenantEntry = eventId
          ? { role: newTenantRole, allowedEventIds: [eventId] }
          : { role: newTenantRole };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: Record<string, any> = {
          role: newGlobalRole,
          [`tenants.${tenantId}`]: tenantEntry,
          requestedTenantId: deleteField(),
          requestedEventId: deleteField(),
          requestedRole: deleteField(),
          requestedPdvId: deleteField(),
        };

        if (reqRole === 'PDV' && user.requestedPdvId) {
          updatePayload.pdvId = user.requestedPdvId;
        }

        await updateDoc(doc(firestore, 'users', user.id), updatePayload);
        toast({ title: 'Acesso aprovado!', description: `${user.name} aprovado como ${ROLE_LABELS[newGlobalRole] || newGlobalRole}.` });
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível aprovar o acesso.' });
      } finally {
        setIsApproving(false);
      }
    };

    return (
      <div className="flex flex-col gap-1 mt-1 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
          Solicitação de Cadastro Pendente
        </div>
        {requestedTenant && (
          <div className="text-xs text-amber-900 space-y-0.5">
            <p>
              Org: <strong>{requestedTenant.name}</strong>
              {user.requestedEventId && (
                <>
                  {' • '}Evento: <strong>{eventName || 'Carregando...'}</strong>
                </>
              )}
            </p>
            <p className="flex items-center gap-1.5 pt-0.5">
              <span>Função Desejada:</span>
              <span className="font-bold text-primary px-1.5 py-0.2 bg-background rounded border border-border">
                {user.requestedRole === 'PDV' ? 'PDV (Barraca)' : 'Caixa Central'}
              </span>
              {user.requestedRole === 'PDV' && (
                <span className="text-muted-foreground text-[11px]">
                  {requestedPdv ? `(${requestedPdv.nome})` : user.requestedPdvId ? `(ID: ${user.requestedPdvId})` : '(Nenhuma barraca pré-selecionada)'}
                </span>
              )}
            </p>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="self-start text-green-700 border-green-500 hover:bg-green-100/60 text-xs h-7 mt-1.5 font-bold shadow-2xs"
          onClick={handleApprove}
          disabled={isApproving}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          {isApproving ? 'Aprovando…' : `Aprovar como ${user.requestedRole === 'PDV' ? 'PDV' : 'Caixa'}`}
        </Button>
      </div>
    );
  },
);
VisitanteAlert.displayName = 'VisitanteAlert';

// ---------------------------------------------------------------------------
// TenantAccessPanel — collapsible per-user tenant management
// ---------------------------------------------------------------------------
type TenantAccessPanelProps = {
  user: UserProfile;
  tenants: Tenant[];
};

const TenantAccessPanel = memo(({ user, tenants }: TenantAccessPanelProps) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [eventsByTenant, setEventsByTenant] = useState<Record<string, TenantEvent[]>>({});
  const [pendingTenant, setPendingTenant] = useState<string | null>(null);
  const [addEventSelect, setAddEventSelect] = useState<Record<string, string>>({});
  const [newTenantId, setNewTenantId] = useState('');

  const userTenantIds = Object.keys(user.tenants ?? {});
  const unlinkedTenants = tenants.filter((t) => !userTenantIds.includes(t.id));

  const ensureEvents = useCallback(
    async (tenantId: string) => {
      if (eventsByTenant[tenantId]) return;
      const events = await loadEvents(firestore, tenantId);
      setEventsByTenant((prev) => ({ ...prev, [tenantId]: events }));
    },
    [firestore, eventsByTenant],
  );

  const handleExpand = () => {
    setExpanded((v) => {
      if (!v) {
        // preload events for all current tenants
        userTenantIds.forEach((tid) => ensureEvents(tid));
      }
      return !v;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mutate = useCallback(async (tenantId: string, payload: Record<string, any>, successMsg: string) => {
    setPendingTenant(tenantId);
    try {
      await updateDoc(doc(firestore, 'users', user.id), payload);
      toast({ title: 'Sucesso!', description: successMsg });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Erro', description: 'Operação falhou.' });
    } finally {
      setPendingTenant(null);
    }
  }, [firestore, user.id, toast]);

  const changeTenantRole = (tenantId: string, newRole: TenantRole) =>
    mutate(tenantId, { [`tenants.${tenantId}.role`]: newRole }, `Papel → ${TENANT_ROLE_LABELS[newRole]}`);

  const removeTenant = (tenantId: string) =>
    mutate(tenantId, { [`tenants.${tenantId}`]: deleteField() }, 'Acesso à organização revogado.');

  const addEvent = async (tenantId: string, eventId: string) => {
    if (!eventId) return;
    await mutate(tenantId, { [`tenants.${tenantId}.allowedEventIds`]: arrayUnion(eventId) }, `Evento ${eventId} liberado.`);
    setAddEventSelect((prev) => ({ ...prev, [tenantId]: '' }));
  };

  const removeEvent = (tenantId: string, eventId: string) =>
    mutate(tenantId, { [`tenants.${tenantId}.allowedEventIds`]: arrayRemove(eventId) }, `Evento ${eventId} removido.`);

  const addNewTenant = async () => {
    if (!newTenantId) return;
    const tid = newTenantId;
    setNewTenantId('');
    await mutate(tid, { [`tenants.${tid}`]: { role: 'OPERADOR' } }, 'Organização vinculada.');
  };

  if (!user.tenants && unlinkedTenants.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleExpand}
        type="button"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Acesso por Organização ({userTenantIds.length})
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {userTenantIds.map((tenantId) => {
            const access = user.tenants![tenantId];
            const tenantName = tenants.find((t) => t.id === tenantId)?.name ?? tenantId;
            const events = eventsByTenant[tenantId] ?? [];
            const allowedIds = access.allowedEventIds ?? [];
            const availableEvents = events.filter((e) => !allowedIds.includes(e.id));
            const isBusy = pendingTenant === tenantId;

            return (
              <div key={tenantId} className="rounded-md border p-2 bg-muted/30 flex flex-col gap-2">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{tenantName}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                    onClick={() => removeTenant(tenantId)}
                    title="Remover organização"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Tenant role */}
                <Select
                  value={access.role}
                  onValueChange={(v) => changeTenantRole(tenantId, v as TenantRole)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TENANT_ROLE_LABELS) as TenantRole[]).map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {TENANT_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Event chips */}
                {allowedIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allowedIds.map((eid) => {
                      const evName = events.find((e) => e.id === eid)?.name ?? eid;
                      return (
                        <span
                          key={eid}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-0.5 border border-blue-200"
                        >
                          {evName}
                          <button
                            type="button"
                            className="hover:text-destructive"
                            onClick={() => removeEvent(tenantId, eid)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Add event */}
                <div className="flex items-center gap-1">
                  <Select
                    value={addEventSelect[tenantId] ?? ''}
                    onValueChange={(v) => {
                      setAddEventSelect((prev) => ({ ...prev, [tenantId]: v }));
                      ensureEvents(tenantId);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="+ Liberar Evento Específico" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEvents.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          Nenhum evento disponível
                        </SelectItem>
                      ) : (
                        availableEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="text-xs">
                            {e.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2"
                    onClick={() => addEvent(tenantId, addEventSelect[tenantId] ?? '')}
                    disabled={!addEventSelect[tenantId]}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Link new tenant */}
          {unlinkedTenants.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Select value={newTenantId} onValueChange={setNewTenantId}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="+ Vincular Nova Organização" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2"
                onClick={addNewTenant}
                disabled={!newTenantId}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
TenantAccessPanel.displayName = 'TenantAccessPanel';

// ---------------------------------------------------------------------------
// GlobalRoleManager — optimistic global role selector
// ---------------------------------------------------------------------------
const GlobalRoleManager = memo(({ user }: { user: UserProfile }) => {
  const [localRole, setLocalRole] = useState<UserRole>(user.role);
  const isUpdatingRef = useRef(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setLocalRole(user.role);
  }, [user.role]);

  const handleChange = useCallback(
    async (value: string) => {
      if (isUpdatingRef.current) return;
      const newRole = value as UserRole;
      setLocalRole(newRole);
      isUpdatingRef.current = true;
      try {
        await updateDoc(doc(firestore, 'users', user.id), { role: newRole });
        toast({ title: 'Função atualizada!', description: `${user.name} → ${ROLE_LABELS[newRole]}` });
      } catch (err) {
        console.error(err);
        setLocalRole(user.role);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a função.' });
      } finally {
        isUpdatingRef.current = false;
      }
    },
    [firestore, user, toast],
  );

  if (user.role === 'SUPERADMIN' || user.email === 'thiagoddsm@gmail.com') {
    return <RoleBadge role={user.role} />;
  }

  return (
    <Select value={localRole} onValueChange={handleChange}>
      <SelectTrigger className="h-8 text-xs w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABELS) as UserRole[])
          .filter((r) => r !== 'SUPERADMIN')
          .map((r) => (
            <SelectItem key={r} value={r} className="text-xs">
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
});
GlobalRoleManager.displayName = 'GlobalRoleManager';

// ---------------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------------
function useAdminUsersData() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const unsub1 = onSnapshot(collection(firestore, 'users'), (snap) => {
      setUsers(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, any>;
          const isMasterAdmin = data.email === 'thiagoddsm@gmail.com' || d.id === 'thiagoddsm';
          let role = (data.role as UserRole) || 'VISITANTE';
          if (isMasterAdmin) {
            role = 'SUPERADMIN';
          } else if ((role as string) === 'ADMIN') {
            role = 'ADMIN_ORGANIZACAO';
          }

          return {
            id: d.id,
            name: data.name || data.nome || data.displayName || 'Sem nome',
            email: data.email || '',
            role,
            pdvId: data.pdvId,
            tenants: data.tenants || {},
            requestedTenantId: data.requestedTenantId,
            requestedEventId: data.requestedEventId,
            requestedRole: data.requestedRole,
            requestedPdvId: data.requestedPdvId,
          } as UserProfile;
        }),
      );
    });

    const unsub2 = onSnapshot(collection(firestore, 'tenants'), (snap) => {
      setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tenant)));
    });

    const unsub3 = onSnapshot(collection(firestore, 'pdvs'), (snap) => {
      setPdvs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv)));
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [firestore]);

  return { users, tenants, pdvs };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function UsersPage() {
  const { users, tenants, pdvs } = useAdminUsersData();

  const isLoading = users === null || tenants === null || pdvs === null;

  const stableTenants = useMemo(() => tenants ?? [], [tenants]);
  const stablePdvs = useMemo(() => pdvs ?? [], [pdvs]);

  const columns: ColumnDef<UserProfile>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Nome',
        filterFn: (row, id, value) => {
          const val = String(row.getValue(id) ?? '').toLowerCase();
          return val.includes(String(value ?? '').toLowerCase());
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        filterFn: (row, id, value) => {
          const val = String(row.getValue(id) ?? '').toLowerCase();
          return val.includes(String(value ?? '').toLowerCase());
        },
      },
      {
        accessorKey: 'role',
        header: 'Função (global)',
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex flex-col gap-1">
              <RoleBadge role={user.role} />
              <GlobalRoleManager user={user} />
              {user.role === 'VISITANTE' && (
                <VisitanteAlert user={user} tenants={stableTenants} pdvs={stablePdvs} />
              )}
            </div>
          );
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        id: 'acessoPorOrganizacao',
        header: 'Acesso por Organização',
        cell: ({ row }) => {
          const user = row.original;
          return <TenantAccessPanel user={user} tenants={stableTenants} />;
        },
      },
    ],
    [stableTenants],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog />
              Gerenciar Usuários
            </CardTitle>
            <CardDescription>
              Visualize e gerencie as funções e permissões dos usuários do sistema.
            </CardDescription>
          </div>
          <CreateUserDialog />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DataTable
              columns={columns}
              data={users ?? []}
              filterColumns={[
                { columnId: 'name', placeholder: 'Buscar por nome…' },
                { columnId: 'email', placeholder: 'Buscar por email…' },
                {
                  columnId: 'role',
                  placeholder: 'Filtrar por função…',
                  options: [
                    { value: 'SUPERADMIN', label: 'Super Admin' },
                    { value: 'ADMIN_ORGANIZACAO', label: 'Admin Organização' },
                    { value: 'ADMIN_EVENTO', label: 'Admin Evento' },
                    { value: 'CAIXA', label: 'Caixa' },
                    { value: 'PDV', label: 'PDV' },
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

