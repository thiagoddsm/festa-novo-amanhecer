'use client';

import { useState, useEffect } from 'react';
import CreateCardForm from '@/components/cashier/CreateCardForm';
import RechargeForm from '@/components/cashier/RechargeForm';
import CheckBalanceForm from '@/components/cashier/CheckBalanceForm';
import TransferBalanceForm from '@/components/cashier/TransferBalanceForm';
import EventWhatsappDialog from '@/components/cashier/EventWhatsappDialog';
import { useTenant } from '@/hooks/use-tenant-context';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, CheckCircle, WalletCards, ShieldCheck } from 'lucide-react';
import type { TenantEvent } from '@/lib/definitions';
import { checkEventWhatsappStatus } from '@/lib/actions';
import { getPdvInstanceName } from '@/lib/whatsapp';

export default function CashierPage() {
  const { currentTenant, currentEvent } = useTenant();
  const firestore = useFirestore();

  const [liveEvent, setLiveEvent] = useState<TenantEvent | null>(currentEvent);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [activeCashierTab, setActiveCashierTab] = useState<'novo' | 'recarga' | 'saldo' | 'transferir'>('novo');

  // Auto-sync status from Evolution API on mount
  useEffect(() => {
    if (!currentTenant?.id || !currentEvent?.id) return;

    const targetInstance =
      currentEvent.whatsapp?.instanceName ||
      getPdvInstanceName(currentTenant.name, currentEvent.name, 'caixa');

    checkEventWhatsappStatus(
      currentTenant.id,
      currentEvent.id,
      targetInstance,
      currentEvent.whatsapp?.token
    ).catch((err) => console.warn('[Cashier] Auto-sync WhatsApp status error:', err));
  }, [currentTenant?.id, currentTenant?.name, currentEvent?.id, currentEvent?.name, currentEvent?.whatsapp?.instanceName, currentEvent?.whatsapp?.token]);

  // Real-time listener for current event's WhatsApp state in Firestore
  useEffect(() => {
    if (!firestore || !currentTenant?.id || !currentEvent?.id) {
      setLiveEvent(currentEvent);
      return;
    }

    const eventDocRef = doc(firestore, 'tenants', currentTenant.id, 'events', currentEvent.id);
    const unsubscribe = onSnapshot(eventDocRef, (snap) => {
      if (snap.exists()) {
        setLiveEvent({ id: snap.id, ...snap.data() } as TenantEvent);
      }
    });

    return () => unsubscribe();
  }, [firestore, currentTenant?.id, currentEvent?.id, currentEvent]);

  const whatsappStatus = liveEvent?.whatsapp?.status || 'DISCONNECTED';
  const phoneNumber = liveEvent?.whatsapp?.phoneNumber;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <WalletCards className="h-6 w-6 text-primary" />
            Caixa Central
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentTenant?.name ? `${currentTenant.name} • ` : ''}
            {currentEvent?.name || 'Selecione um evento'}
          </p>
        </div>

        {currentTenant && liveEvent && (
          <div className="flex items-center gap-3">
            {whatsappStatus === 'CONNECTED' ? (
              <button
                type="button"
                onClick={() => setWhatsappDialogOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-300 bg-green-50 text-green-800 text-xs font-semibold hover:bg-green-100 transition-colors shadow-sm"
                title="Clique para gerenciar ou desconectar o WhatsApp"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
                </span>
                <MessageSquare className="h-3.5 w-3.5 text-green-700" />
                <span>WhatsApp Conectado</span>
                {phoneNumber && <span className="font-mono font-normal opacity-90">({phoneNumber})</span>}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setWhatsappDialogOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs shadow-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Conectar WhatsApp do Evento
                </Button>
                <Badge variant="outline" className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-blue-600" /> Fallback IBM
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Operation Selector */}
      <div className="md:hidden flex items-center p-1 bg-muted rounded-xl gap-1">
        {[
          { id: 'novo', label: 'Novo Cartão' },
          { id: 'recarga', label: 'Recarregar' },
          { id: 'saldo', label: 'Consultar' },
          { id: 'transferir', label: 'Transferir' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCashierTab(tab.id as any)}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all ${
              activeCashierTab === tab.id
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile Form Active View */}
      <div className="md:hidden">
        {activeCashierTab === 'novo' && <CreateCardForm />}
        {activeCashierTab === 'recarga' && <RechargeForm />}
        {activeCashierTab === 'saldo' && <CheckBalanceForm />}
        {activeCashierTab === 'transferir' && <TransferBalanceForm />}
      </div>

      {/* Desktop / Tablet Forms Grid */}
      <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <CreateCardForm />
        <RechargeForm />
        <CheckBalanceForm />
        <TransferBalanceForm />
      </div>

      {/* WhatsApp Modal for Event / Caixa */}
      {currentTenant && liveEvent && (
        <EventWhatsappDialog
          tenantId={currentTenant.id}
          tenantName={currentTenant.name}
          event={liveEvent}
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
        />
      )}
    </div>
  );
}
