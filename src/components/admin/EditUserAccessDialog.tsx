'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import {
  Store,
  CreditCard,
  Shield,
  UserX,
  Building2,
  Calendar,
  Check,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, Pdv, Tenant, TenantEvent, UserRole, TenantRole } from '@/lib/definitions';

interface EditUserAccessDialogProps {
  user: UserProfile;
  tenants: Tenant[];
  eventsByTenant: Record<string, TenantEvent[]>;
  allPdvs: Pdv[];
  trigger?: React.ReactNode;
  initialOpen?: boolean;
}

export default function EditUserAccessDialog({
  user,
  tenants,
  eventsByTenant,
  allPdvs,
  trigger,
  initialOpen = false,
}: EditUserAccessDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [open, setOpen] = useState(initialOpen);
  const [isSaving, setIsSaving] = useState(false);

  // User form states
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('VISITANTE');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedPdvId, setSelectedPdvId] = useState<string>('');
  const [eventsMode, setEventsMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [specificEventIds, setSpecificEventIds] = useState<string[]>([]);

  // Initialize or reset state when dialog opens
  useEffect(() => {
    if (!open) return;

    // 1. Detect Tenant
    const userTenantIds = Object.keys(user.tenants || {}).filter(
      (tid) => tenants.some((t) => t.id === tid)
    );
    const primaryTenantId =
      userTenantIds[0] ||
      user.requestedTenantId ||
      tenants[0]?.id ||
      '';
    setSelectedTenantId(primaryTenantId);

    // 2. Detect Role
    let role = user.role || 'VISITANTE';
    if (user.role === 'VISITANTE' && user.requestedRole) {
      role = user.requestedRole as UserRole;
    }
    if ((role as string) === 'ADMIN') role = 'ADMIN_ORGANIZACAO';
    setSelectedRole(role);

    // 3. Detect PDV & Event
    const currentPdvId = user.pdvId || user.requestedPdvId || '';
    const currentPdv = allPdvs.find((p) => p.id === currentPdvId);

    const tenantEvents = eventsByTenant[primaryTenantId] || [];
    const eventFromPdv = currentPdv?.event_id;
    const eventFromRequest = user.requestedEventId;
    const eventFromUserTenants = user.tenants?.[primaryTenantId]?.allowedEventIds?.[0];

    const detectedEventId =
      eventFromPdv ||
      eventFromRequest ||
      eventFromUserTenants ||
      tenantEvents[0]?.id ||
      '';

    setSelectedEventId(detectedEventId);
    setSelectedPdvId(currentPdvId);

    // 4. Allowed Events Mode for Admins / Cashiers
    const allowed = user.tenants?.[primaryTenantId]?.allowedEventIds;
    if (allowed && allowed.length > 0) {
      setEventsMode('SPECIFIC');
      setSpecificEventIds(allowed);
    } else {
      setEventsMode('ALL');
      setSpecificEventIds([]);
    }
  }, [open, user, tenants, eventsByTenant, allPdvs]);

  // Available events for the selected tenant
  const availableEvents = useMemo(() => {
    return eventsByTenant[selectedTenantId] || [];
  }, [eventsByTenant, selectedTenantId]);

  // PDVs filtered by the selected event (for PDV role)
  const availablePdvs = useMemo(() => {
    if (!selectedTenantId) return [];
    return allPdvs
      .filter((p) => {
        const matchesTenant = p.tenant_id === selectedTenantId;
        const matchesEvent = !selectedEventId || p.event_id === selectedEventId;
        const isNotCaixa = p.nome !== 'Caixa Central';
        return matchesTenant && matchesEvent && isNotCaixa;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allPdvs, selectedTenantId, selectedEventId]);

  // Auto-select first event if event is cleared or invalid
  useEffect(() => {
    if (availableEvents.length > 0 && (!selectedEventId || !availableEvents.some((e) => e.id === selectedEventId))) {
      setSelectedEventId(availableEvents[0].id);
    }
  }, [availableEvents, selectedEventId]);

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload: Record<string, any> = {
        role: selectedRole,
      };

      // Handle PDV assignment
      if (selectedRole === 'PDV') {
        if (!selectedPdvId) {
          toast({
            variant: 'destructive',
            title: 'Atenção',
            description: 'Selecione a barraca que este operador irá atender.',
          });
          setIsSaving(false);
          return;
        }
        updatePayload.pdvId = selectedPdvId;
      } else {
        updatePayload.pdvId = deleteField();
      }

      // Handle Tenant linking & event permissions
      if (selectedTenantId) {
        let tenantRole: TenantRole = 'OPERADOR';
        if (selectedRole === 'SUPERADMIN' || selectedRole === 'ADMIN_ORGANIZACAO') {
          tenantRole = 'ADMIN';
        } else if (selectedRole === 'CAIXA') {
          tenantRole = 'CAIXA';
        } else if (selectedRole === 'PDV') {
          tenantRole = 'PDV';
        }

        let allowedEventIds: string[] = [];
        if (selectedRole === 'PDV') {
          // PDV is restricted to its event
          allowedEventIds = selectedEventId ? [selectedEventId] : [];
        } else if (eventsMode === 'SPECIFIC' && specificEventIds.length > 0) {
          allowedEventIds = specificEventIds;
        } else {
          allowedEventIds = []; // empty array means all events in FestaPay context
        }

        updatePayload[`tenants.${selectedTenantId}`] = {
          role: tenantRole,
          allowedEventIds,
        };
      }

      // Clear pending approval request fields
      updatePayload.requestedTenantId = deleteField();
      updatePayload.requestedEventId = deleteField();
      updatePayload.requestedRole = deleteField();
      updatePayload.requestedPdvId = deleteField();

      await updateDoc(doc(firestore, 'users', user.id), updatePayload);

      toast({
        title: 'Permissões Salvas!',
        description: `Acesso de ${user.name} configurado com sucesso.`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Erro ao salvar permissões do usuário:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar as permissões deste usuário.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isVisitante = user.role === 'VISITANTE';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : isVisitante ? (
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Liberar Acesso
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 font-medium hover:bg-muted"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            Configurar Acesso
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-5 overflow-hidden">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configurar Acesso &bull; {user.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {user.email ? `${user.email} &bull; ` : ''}
            Defina a organização, a função e a barraca deste voluntário em passos simples.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 min-h-0 text-sm">
          {/* PASSO 1: Organização */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              1. Organização (Igreja ou Entidade)
            </Label>
            <Select
              value={selectedTenantId}
              onValueChange={(val) => {
                setSelectedTenantId(val);
                setSelectedPdvId('');
              }}
            >
              <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                <SelectValue placeholder="Selecione a organização..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PASSO 2: Função / O que ela vai fazer */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">
              2. Qual será a função desta pessoa?
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Opção PDV */}
              <button
                type="button"
                onClick={() => setSelectedRole('PDV')}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  selectedRole === 'PDV'
                    ? 'border-orange-500 bg-orange-50/80 dark:bg-orange-950/30 ring-2 ring-orange-500/20'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-bold text-xs text-orange-900 dark:text-orange-300 flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-orange-600" />
                    Operador de Barraca (PDV)
                  </span>
                  {selectedRole === 'PDV' && (
                    <Check className="h-4 w-4 text-orange-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Lança pedidos e baixa estoque de uma barraca específica (ex: Hamburguer, Pastel).
                </p>
              </button>

              {/* Opção Caixa */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('CAIXA');
                  setSelectedPdvId('');
                }}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  selectedRole === 'CAIXA'
                    ? 'border-green-500 bg-green-50/80 dark:bg-green-950/30 ring-2 ring-green-500/20'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-bold text-xs text-green-900 dark:text-green-300 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    Caixa Central
                  </span>
                  {selectedRole === 'CAIXA' && (
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Faz recargas de cartões, consultas de saldo e estornos financeiros no evento.
                </p>
              </button>

              {/* Opção Admin */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('ADMIN_ORGANIZACAO');
                  setSelectedPdvId('');
                }}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  selectedRole === 'ADMIN_ORGANIZACAO' || selectedRole === 'ADMIN_EVENTO'
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-bold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Administrador
                  </span>
                  {(selectedRole === 'ADMIN_ORGANIZACAO' || selectedRole === 'ADMIN_EVENTO') && (
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Gerencia cardápios, preços, relatórios gerais e configurações da organização.
                </p>
              </button>

              {/* Opção Visitante */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('VISITANTE');
                  setSelectedPdvId('');
                }}
                className={`flex flex-col text-left p-3 rounded-lg border transition-all ${
                  selectedRole === 'VISITANTE'
                    ? 'border-gray-500 bg-gray-50/80 dark:bg-gray-900/30 ring-2 ring-gray-500/20'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-bold text-xs text-muted-foreground flex items-center gap-1.5">
                    <UserX className="h-4 w-4 text-muted-foreground" />
                    Visitante (Bloqueado)
                  </span>
                  {selectedRole === 'VISITANTE' && (
                    <Check className="h-4 w-4 text-foreground shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Sem acesso aos terminais de venda até ser aprovado por um administrador.
                </p>
              </button>
            </div>
          </div>

          {/* PASSO 3: Configuração Especial para Operador de PDV */}
          {selectedRole === 'PDV' && (
            <div className="rounded-lg border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 p-3.5 space-y-3 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                <Store className="h-4 w-4 text-orange-600" />
                3. Onde este operador vai trabalhar?
              </span>

              {/* Escolha do Evento */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-orange-900 dark:text-orange-300 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Qual é o Evento da festa?
                </Label>
                <Select
                  value={selectedEventId}
                  onValueChange={(val) => {
                    setSelectedEventId(val);
                    setSelectedPdvId('');
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-orange-200">
                    <SelectValue placeholder="Selecione o evento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.length === 0 ? (
                      <SelectItem value="__none__" disabled className="text-xs">
                        Nenhum evento cadastrado nesta organização
                      </SelectItem>
                    ) : (
                      availableEvents.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id} className="text-xs font-medium">
                          {ev.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Escolha da Barraca */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-orange-900 dark:text-orange-300 flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  Qual Barraca / PDV ela vai operar?
                </Label>
                <Select
                  value={selectedPdvId}
                  onValueChange={setSelectedPdvId}
                  disabled={availablePdvs.length === 0}
                >
                  <SelectTrigger className="h-8 text-xs bg-background border-orange-300 font-bold text-foreground">
                    <SelectValue
                      placeholder={
                        availablePdvs.length === 0
                          ? 'Nenhuma barraca neste evento'
                          : 'Selecione a barraca (ex: Hamburguer, Pastel...)'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePdvs.map((pdv) => (
                      <SelectItem key={pdv.id} value={pdv.id} className="text-xs font-semibold">
                        {pdv.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availablePdvs.length === 0 && (
                  <p className="text-[11px] text-orange-700">
                    Crie barracas primeiro na tela de PDVs para vincular voluntários.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PASSO 4: Para Caixa ou Admin — Seleção Simples de Eventos */}
          {(selectedRole === 'CAIXA' ||
            selectedRole === 'ADMIN_ORGANIZACAO' ||
            selectedRole === 'ADMIN_EVENTO') &&
            availableEvents.length > 0 && (
              <div className="rounded-lg border p-3 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    Eventos Permitidos
                  </Label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEventsMode('ALL')}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        eventsMode === 'ALL'
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Todos os Eventos
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventsMode('SPECIFIC')}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        eventsMode === 'SPECIFIC'
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Escolher Específicos
                    </button>
                  </div>
                </div>

                {eventsMode === 'ALL' ? (
                  <p className="text-xs text-muted-foreground">
                    Este usuário terá acesso a <strong>todos os eventos</strong> desta organização (atual e futuros).
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {availableEvents.map((ev) => {
                      const isChecked = specificEventIds.includes(ev.id);
                      return (
                        <label
                          key={ev.id}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs transition-colors ${
                            isChecked
                              ? 'bg-primary/5 border-primary font-semibold text-foreground'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSpecificEventIds((prev) => [...prev, ev.id]);
                              } else {
                                setSpecificEventIds((prev) => prev.filter((id) => id !== ev.id));
                              }
                            }}
                          />
                          <span className="truncate">{ev.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        </div>

        <DialogFooter className="pt-3 border-t shrink-0 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            className="font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSave}
            disabled={isSaving || !selectedTenantId}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Salvar e Liberar Acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
