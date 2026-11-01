'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { useTenant } from '@/hooks/use-tenant-context';
import KitchenDisplay from '@/components/pos/KitchenDisplay';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { type Pdv } from '@/lib/definitions';
import { ChefHat, Loader2, ArrowRight } from 'lucide-react';
import { getPdvIconConfig } from '@/lib/pdv-icons';

function PosKdsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const searchParams = useSearchParams();
  const pdvParam = searchParams.get('pdv');

  const firestore = useFirestore();
  const [allPdvs, setAllPdvs] = useState<Pdv[] | null>(null);
  const [selectedPdvId, setSelectedPdvId] = useState<string | null>(
    pdvParam || (user?.role === 'PDV' ? user.pdvId || null : null)
  );

  useEffect(() => {
    if (pdvParam) {
      setSelectedPdvId(pdvParam);
    } else if (user?.role === 'PDV' && user.pdvId) {
      setSelectedPdvId(user.pdvId);
    }
  }, [pdvParam, user?.role, user?.pdvId]);

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
        console.error('Error fetching PDVs for KDS:', err);
        setAllPdvs([]);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  const filteredPdvs = (allPdvs || []).filter((p) => {
    if (currentTenant && p.tenant_id && p.tenant_id !== currentTenant.id) return false;
    if (currentEvent && p.event_id && p.event_id !== currentEvent.id) return false;
    return true;
  });

  const activePdv = (allPdvs || []).find((p) => p.id === selectedPdvId);

  if (selectedPdvId && activePdv) {
    return (
      <KitchenDisplay
        pdvId={activePdv.id}
        pdvNome={activePdv.nome}
        onBack={() => {
          if (user?.role === 'PDV') {
            router.push('/pos');
          } else {
            setSelectedPdvId(null);
          }
        }}
      />
    );
  }

  if (allPdvs === null) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando barracas da cozinha...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 rounded-3xl bg-amber-500/10 text-amber-500 items-center justify-center border border-amber-500/20 mb-2 shadow-sm">
          <ChefHat className="h-8 w-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">
          Tela de Produção (KDS)
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Selecione a barraca para acompanhar pedidos em tempo real na chapa/cozinha:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {filteredPdvs.map((pdv) => {
          const config = getPdvIconConfig(pdv.icon, pdv.nome);
          const Icon = config.icon;

          return (
            <button
              key={pdv.id}
              onClick={() => setSelectedPdvId(pdv.id)}
              className="group flex items-center justify-between p-4 rounded-2xl bg-card border border-border/80 hover:border-amber-500/60 hover:bg-accent/40 transition-all text-left shadow-xs hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`h-12 w-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 shadow-xs`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-foreground truncate group-hover:text-amber-600 transition-colors">
                    {pdv.nome}
                  </h3>
                  <p className="text-xs text-muted-foreground">Abrir tela da cozinha</p>
                </div>
              </div>

              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PosKdsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <PosKdsContent />
    </Suspense>
  );
}
