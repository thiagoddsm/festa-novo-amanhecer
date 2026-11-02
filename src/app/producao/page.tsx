'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FirebaseClientProvider, useFirestore } from '@/firebase';
import KitchenDisplay from '@/components/pos/KitchenDisplay';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { type Pdv } from '@/lib/definitions';
import { ChefHat, Loader2, ArrowRight } from 'lucide-react';
import { getPdvIconConfig } from '@/lib/pdv-icons';

function ProducaoContent() {
  const searchParams = useSearchParams();
  const pdvParam = searchParams.get('pdv');
  const tenantParam = searchParams.get('tenant') || 'igreja-batista-da-manha';
  const eventParam = searchParams.get('event') || 'DoKmbiQ8pd3M71yTC9iA';

  const firestore = useFirestore();
  const [allPdvs, setAllPdvs] = useState<Pdv[] | null>(null);
  const [selectedPdvId, setSelectedPdvId] = useState<string | null>(pdvParam);

  // Sync param if changed
  useEffect(() => {
    if (pdvParam) {
      setSelectedPdvId(pdvParam);
    }
  }, [pdvParam]);

  // Load all PDVs for the selector fallback, filtered by tenant and active event
  useEffect(() => {
    if (!firestore) return;
    const pdvRef = collection(firestore, 'pdvs');
    const q = query(
      pdvRef,
      where('tenant_id', '==', tenantParam),
      where('event_id', '==', eventParam)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Pdv))
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setAllPdvs(fetched);
      },
      (err) => {
        console.error('Error fetching PDVs for KDS:', err);
        setAllPdvs([]);
      }
    );

    return () => unsubscribe();
  }, [firestore, tenantParam, eventParam]);

  const activePdv = (allPdvs || []).find((p) => p.id === selectedPdvId);

  // If a PDV is selected (via URL query or picker), show full-screen KDS
  if (selectedPdvId && activePdv) {
    return (
      <KitchenDisplay
        pdvId={activePdv.id}
        pdvNome={activePdv.nome}
        onBack={() => setSelectedPdvId(null)}
      />
    );
  }

  // If still loading PDVs
  if (allPdvs === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando barracas para a Tela de Produção...</p>
      </div>
    );
  }

  // Booth Selector Screen for Kitchen Staff
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 rounded-3xl bg-amber-500/20 text-amber-400 items-center justify-center border border-amber-500/30 mb-2">
            <ChefHat className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
            Tela de Produção (KDS)
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
            Selecione qual cozinha/barraca será operada nesta tela ou tablet para controle de pedidos:
          </p>
        </div>

        {/* PDV List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[60vh] overflow-y-auto p-1">
          {allPdvs.map((pdv) => {
            const config = getPdvIconConfig(pdv.icon, pdv.nome);
            const Icon = config.icon;

            return (
              <button
                key={pdv.id}
                onClick={() => setSelectedPdvId(pdv.id)}
                className="group flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/80 transition-all text-left shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`h-12 w-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-white truncate group-hover:text-amber-300 transition-colors">
                      {pdv.nome}
                    </h3>
                    <p className="text-xs text-slate-400">Abrir tela da chapa / cozinha</p>
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </button>
            );
          })}
        </div>

        {/* Helper footer */}
        <div className="text-center text-xs text-slate-500 pt-2">
          Dica: Você pode salvar o link direto desta tela adicionando{' '}
          <code className="text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded">?pdv=ID_DO_PDV</code>{' '}
          no navegador do tablet da cozinha.
        </div>
      </div>
    </div>
  );
}

export default function ProducaoPage() {
  return (
    <FirebaseClientProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        }
      >
        <ProducaoContent />
      </Suspense>
    </FirebaseClientProvider>
  );
}
