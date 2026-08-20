'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';

export default function MigrationButton() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  const handleRunMigration = async () => {
    if (!firestore) return;
    setIsMigrating(true);
    setLogs([]);
    addLog('🚀 Iniciando migração de dados existentes via SDK Client...');

    const targetTenantSlug = 'igreja-batista-da-manha';
    const targetTenantName = 'Igreja Batista da Manhã';
    const targetEventName = 'Festa Novo Amanhecer 2026';

    try {
      // 1. Criar ou obter Tenant
      const tenantRef = doc(firestore, 'tenants', targetTenantSlug);
      await setDoc(
        tenantRef,
        {
          name: targetTenantName,
          slug: targetTenantSlug,
          plan: 'PRO',
          status: 'ACTIVE',
          created_at: Timestamp.now(),
        },
        { merge: true }
      );
      addLog(`✅ Organização '${targetTenantName}' verificada/criada.`);

      // 2. Criar ou obter Evento
      const eventsRef = collection(firestore, 'tenants', targetTenantSlug, 'events');
      const eventsSnap = await getDocs(eventsRef);
      let targetEventId = '';

      const existingEvent = eventsSnap.docs.find((d) => d.data().name === targetEventName);
      if (existingEvent) {
        targetEventId = existingEvent.id;
        addLog(`ℹ️ Evento '${targetEventName}' encontrado (ID: ${targetEventId}).`);
      } else {
        const newEventDoc = doc(eventsRef);
        targetEventId = newEventDoc.id;
        await setDoc(newEventDoc, {
          tenant_id: targetTenantSlug,
          name: targetEventName,
          status: 'ACTIVE',
          created_at: Timestamp.now(),
        });
        addLog(`✅ Evento '${targetEventName}' criado (ID: ${targetEventId}).`);
      }

      // 3. Migrar Cartões (cards)
      const cardsSnap = await getDocs(collection(firestore, 'cards'));
      let cardsCount = 0;
      let batch = writeBatch(firestore);

      for (const cardDoc of cardsSnap.docs) {
        batch.update(cardDoc.ref, {
          tenant_id: targetTenantSlug,
          event_id: targetEventId,
        });
        cardsCount++;
      }
      await batch.commit();
      addLog(`✅ ${cardsCount} cartões vinculados a '${targetEventName}'.`);

      // 4. Migrar Transações (transactions)
      const txSnap = await getDocs(collection(firestore, 'transactions'));
      let txCount = 0;
      batch = writeBatch(firestore);

      for (const txDoc of txSnap.docs) {
        batch.update(txDoc.ref, {
          tenant_id: targetTenantSlug,
          event_id: targetEventId,
        });
        txCount++;
      }
      await batch.commit();
      addLog(`✅ ${txCount} transações vinculadas a '${targetEventName}'.`);

      // 5. Migrar PDVs (pdvs)
      const pdvSnap = await getDocs(collection(firestore, 'pdvs'));
      let pdvCount = 0;
      batch = writeBatch(firestore);

      for (const pdvDoc of pdvSnap.docs) {
        batch.update(pdvDoc.ref, {
          tenant_id: targetTenantSlug,
          event_id: targetEventId,
        });
        pdvCount++;
      }
      await batch.commit();
      addLog(`✅ ${pdvCount} PDVs vinculados a '${targetEventName}'.`);

      addLog('🎉 Migração concluída com sucesso!');
      toast({
        title: 'Migração Concluída!',
        description: `Todos os dados foram associados à ${targetTenantName} - ${targetEventName}.`,
      });
    } catch (err: any) {
      console.error(err);
      addLog(`❌ Erro na migração: ${err.message}`);
      toast({
        variant: 'destructive',
        title: 'Erro na Migração',
        description: err.message,
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 my-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <RefreshCw className="h-4 w-4" /> Migrador de Dados Antigos
        </CardTitle>
        <CardDescription>
          Clique no botão abaixo para associar todos os cartões, transações e PDVs antigos à{' '}
          <strong>Igreja Batista da Manhã</strong> / <strong>Festa Novo Amanhecer 2026</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleRunMigration}
          disabled={isMigrating}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9"
        >
          {isMigrating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Migrar Dados Existentes Agora
        </Button>

        {logs.length > 0 && (
          <div className="bg-black/90 text-emerald-400 font-mono text-xs p-3 rounded-md space-y-1 max-h-40 overflow-y-auto">
            {logs.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
