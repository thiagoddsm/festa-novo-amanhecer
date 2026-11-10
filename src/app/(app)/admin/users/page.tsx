'use client';

import {
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  onSnapshot,
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
import {
  UserCog,
  Building2,
  Calendar,
  Store,
  CreditCard,
  Shield,
  Sparkles,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import type { UserProfile, Pdv, Tenant, TenantEvent, UserRole } from '@/lib/definitions';
import { type ColumnDef } from '@tanstack/react-table';
import CreateUserDialog from '@/components/admin/CreateUserDialog';
import EditUserAccessDialog from '@/components/admin/EditUserAccessDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN_ORGANIZACAO: 'Admin Organização',
  ADMIN_EVENTO: 'Admin Evento',
  CAIXA: 'Caixa Central',
  PDV: 'Operador de Barraca (PDV)',
  VISITANTE: 'Visitante (Aguardando)',
};

const ROLE_BADGE_STYLE: Record<UserRole, { class: string; icon: any }> = {
  SUPERADMIN: { class: 'bg-purple-100 text-purple-800 border-purple-300', icon: Shield },
  ADMIN_ORGANIZACAO: { class: 'bg-blue-100 text-blue-800 border-blue-300', icon: Shield },
  ADMIN_EVENTO: { class: 'bg-cyan-100 text-cyan-800 border-cyan-300', icon: Calendar },
  CAIXA: { class: 'bg-green-100 text-green-800 border-green-300', icon: CreditCard },
  PDV: { class: 'bg-orange-100 text-orange-800 border-orange-300', icon: Store },
  VISITANTE: { class: 'bg-amber-100 text-amber-800 border-amber-300', icon: UserX },
};

function UserRoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_BADGE_STYLE[role] || { class: 'bg-muted text-foreground', icon: Shield };
  const Icon = meta.icon;
  const label = role === 'VISITANTE' ? 'Aguardando Aprovação' : (ROLE_LABELS[role] || role);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.class}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data Hook
// ---------------------------------------------------------------------------
function useAdminUsersData() {
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const [eventsByTenant, setEventsByTenant] = useState<Record<string, TenantEvent[]>>({});
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
            pdvId: data.pdvId || (Array.isArray(data.pdvIds) ? data.pdvIds[0] : undefined),
            pdvIds: Array.isArray(data.pdvIds) ? data.pdvIds : (data.pdvId ? [data.pdvId] : []),
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

  // Real-time events per tenant
  const tenantIdsKey = (tenants ?? []).map((t) => t.id).sort().join('|');
  useEffect(() => {
    if (!firestore || !tenantIdsKey) return;
    const unsubs = tenantIdsKey.split('|').map((tid) =>
      onSnapshot(collection(firestore, 'tenants', tid, 'events'), (snap) => {
        const evs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TenantEvent));
        setEventsByTenant((prev) => ({ ...prev, [tid]: evs }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [firestore, tenantIdsKey]);

  return { users, tenants, pdvs, eventsByTenant };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function UsersPage() {
  const { users, tenants, pdvs, eventsByTenant } = useAdminUsersData();

  const isLoading = users === null || tenants === null || pdvs === null;

  const stableTenants = useMemo(() => tenants ?? [], [tenants]);
  const stablePdvs = useMemo(() => pdvs ?? [], [pdvs]);

  const columns: ColumnDef<UserProfile>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Usuário',
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm text-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{user.email || 'Sem e-mail'}</span>
            </div>
          );
        },
        filterFn: (row, id, value) => {
          const val = String(row.getValue(id) ?? '').toLowerCase();
          return val.includes(String(value ?? '').toLowerCase());
        },
      },
      {
        accessorKey: 'role',
        header: 'Função',
        cell: ({ row }) => {
          const user = row.original;
          const isVisitante = user.role === 'VISITANTE';

          return (
            <div className="flex flex-col gap-1.5 items-start">
              <UserRoleBadge role={user.role} />

              {/* Show note if pending request */}
              {isVisitante && user.requestedTenantId && (
                <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                  <span>
                    Pediu: <strong>{user.requestedRole === 'PDV' ? 'Barraca' : 'Caixa'}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        id: 'acessoResumo',
        header: 'Organização & Barraca Atribuída',
        cell: ({ row }) => {
          const user = row.original;

          // Find tenant
          const userTenantIds = Object.keys(user.tenants || {}).filter(
            (tid) => stableTenants.some((t) => t.id === tid)
          );
          const primaryTenantId = userTenantIds[0] || user.requestedTenantId;
          const tenant = stableTenants.find((t) => t.id === primaryTenantId);

          // Find assigned PDVs
          const userPdvIds =
            user.pdvIds && user.pdvIds.length > 0
              ? user.pdvIds
              : user.pdvId
              ? [user.pdvId]
              : [];
          const assignedPdvs = userPdvIds
            .map((id) => stablePdvs.find((p) => p.id === id))
            .filter((p): p is Pdv => !!p);
          const assignedPdv = assignedPdvs[0] || null;

          // Find event
          const tenantEvents = primaryTenantId ? eventsByTenant[primaryTenantId] || [] : [];
          const eventId =
            assignedPdv?.event_id ||
            user.tenants?.[primaryTenantId || '']?.allowedEventIds?.[0] ||
            user.requestedEventId;
          const event = tenantEvents.find((e) => e.id === eventId);

          if (!tenant && !assignedPdv) {
            return (
              <span className="text-xs text-muted-foreground italic">
                Nenhum acesso configurado
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-1 text-xs">
              {tenant && (
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>{tenant.name}</span>
                </div>
              )}

              {event && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{event.name}</span>
                </div>
              )}

              {user.role === 'PDV' && (
                <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                  {assignedPdvs.length > 0 ? (
                    assignedPdvs.map((p) => (
                      <Badge
                        key={p.id}
                        variant="outline"
                        className="text-xs font-bold text-orange-900 bg-orange-50 border-orange-300 gap-1"
                      >
                        <Store className="h-3.5 w-3.5 text-orange-600" />
                        {p.nome}
                      </Badge>
                    ))
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs font-bold text-orange-900 bg-orange-50 border-orange-300 gap-1"
                    >
                      <Store className="h-3.5 w-3.5 text-orange-600" />
                      Barraca não definida
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'acoes',
        header: 'Ação',
        cell: ({ row }) => {
          const user = row.original;
          const isMasterAdmin = user.email === 'thiagoddsm@gmail.com' || user.id === 'thiagoddsm';

          if (isMasterAdmin) {
            return (
              <Badge variant="secondary" className="text-xs text-purple-900 bg-purple-50">
                Acesso Total (Master)
              </Badge>
            );
          }

          return (
            <EditUserAccessDialog
              user={user}
              tenants={stableTenants}
              eventsByTenant={eventsByTenant}
              allPdvs={stablePdvs}
            />
          );
        },
      },
    ],
    [stableTenants, stablePdvs, eventsByTenant],
  );

  const userFilterColumns = useMemo(
    () => [
      { columnId: 'name', placeholder: 'Buscar por nome…' },
      {
        columnId: 'role',
        placeholder: 'Filtrar por função…',
        options: [
          { value: 'SUPERADMIN', label: 'Super Admin' },
          { value: 'ADMIN_ORGANIZACAO', label: 'Admin Organização' },
          { value: 'CAIXA', label: 'Caixa Central' },
          { value: 'PDV', label: 'Operador de Barraca' },
          { value: 'VISITANTE', label: 'Aguardando Aprovação' },
        ],
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <UserCog className="h-5 w-5 text-primary" />
              Gerenciar Voluntários & Permissões
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Defina a organização, o evento e a barraca (PDV) de cada voluntário em passos simples.
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
              filterColumns={userFilterColumns}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
