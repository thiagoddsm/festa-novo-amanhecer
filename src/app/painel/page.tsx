'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FirebaseClientProvider, useFirestore } from '@/firebase';
import CustomerDisplay from '@/components/pos/CustomerDisplay';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { type Pdv } from '@/lib/definitions';
import { Store, Tv, Loader2, ArrowRight } from 'lucide-react';
import { getPdvIconConfig } from '@/lib/pdv-icons';

function PainelContent() {
  const searchParams = useSearchParams();
  const pdvParam = searchParams.get('pdv');

  const firestore = useFirestore();
  const [allPdvs, setAllPdvs] = useState<Pdv[] | null>(null);
  const [selectedPdvId, setSelectedPdvId] = useState<string | null>(pdvParam);

  // Sync param if changed
  useEffect(() => {
    if (pdvParam) {
      setSelectedPdvId(pdvParam);
    }
  }, [pdvParam]);

  // Load all PDVs for the selector fallback
  useEffect(() => {
    if (!firestore) return;
    const pdvRef = collection(firestore, 'pdvs');
    const q = query(pdvRef, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv));
        setAllPdvs(fetched);
      },
      (err) => {
        console.error('Error fetching PDVs for TV panel:', err);
        setAllPdvs([]);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  const activePdv = (allPdvs || []).find((p) => p.id === selectedPdvId);

  // If a PDV is selected (via URL query or picker), show full-screen Customer TV Display
  if (selectedPdvId && activePdv) {
    return (
      <CustomerDisplay
        pdvId={activePdv.id}
        pdvNome={activePdv.nome}
        eventName="Festa Novo Amanhecer 2026"
        onBack={() => setSelectedPdvId(null)}
      />
    );
  }

  // If still loading PDVs
  if (allPdvs === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-sm font-semibold">Carregando barracas para o Painel TV...</p>
      </div>
    );
  }

  // Booth Selector Screen for TV Setup
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 rounded-3xl bg-purple-600/20 text-purple-400 items-center justify-center border border-purple-500/30 mb-2">
            <Tv className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
            Painel de Chamada TV
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
            Selecione qual barraca será exibida nesta tela ou Smart TV para os clientes acompanharem
            os pedidos:
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
                className="group flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-800/80 transition-all text-left shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`h-12 w-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-white truncate group-hover:text-purple-300 transition-colors">
                      {pdv.nome}
                    </h3>
                    <p className="text-xs text-slate-400">Exibir chamadas ao vivo</p>
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </button>
            );
          })}
        </div>

        {/* Helper footer */}
        <div className="text-center text-xs text-slate-500 pt-2">
          Dica: Você pode salvar o link direto desta tela adicionando{' '}
          <code className="text-purple-400 bg-slate-900 px-1.5 py-0.5 rounded">?pdv=ID_DO_PDV</code>{' '}
          no navegador da TV.
        </div>
      </div>
    </div>
  );
}

export default function PainelPage() {
  return (
    <FirebaseClientProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        }
      >
        <PainelContent />
      </Suspense>
    </FirebaseClientProvider>
  );
}
