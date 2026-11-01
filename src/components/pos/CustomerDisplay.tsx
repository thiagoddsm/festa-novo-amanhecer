'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { type Order } from '@/lib/definitions';
import { soundPlayer } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BellRing,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Store,
  ArrowLeft,
  UtensilsCrossed,
  CheckCircle2,
  Flame,
} from 'lucide-react';

interface CustomerDisplayProps {
  pdvId?: string;
  pdvNome?: string;
  eventName?: string;
  onBack?: () => void;
  isEmbedded?: boolean;
}

function formatTimestamp(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

export default function CustomerDisplay({
  pdvId,
  pdvNome = 'Barraca',
  eventName = 'Festa Novo Amanhecer',
  onBack,
  isEmbedded = false,
}: CustomerDisplayProps) {
  const firestore = useFirestore();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [recentlyReadyId, setRecentlyReadyId] = useState<string | null>(null);

  // Track known ready order IDs to detect when a new order becomes ready
  const knownReadyIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Live Digital Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to active orders
  useEffect(() => {
    if (!firestore || !pdvId) return;

    const ordersRef = collection(firestore, 'orders');
    const q = query(
      ordersRef,
      where('pdv_id', '==', pdvId),
      where('status', 'in', ['PENDENTE', 'EM_PREPARO', 'PRONTO'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Order)
        );

        // Sort by update time or creation time
        fetchedOrders.sort((a, b) => {
          const dateA = formatTimestamp(a.updated_at || a.created_at);
          const dateB = formatTimestamp(b.updated_at || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });

        // Detect newly ready orders
        const currentReadyIds = new Set(
          fetchedOrders.filter((o) => o.status === 'PRONTO').map((o) => o.id)
        );

        if (initialLoadDoneRef.current) {
          // Find any order that is ready now but wasn't before
          const newlyReady = fetchedOrders.find(
            (o) => o.status === 'PRONTO' && !knownReadyIdsRef.current.has(o.id)
          );

          if (newlyReady) {
            setRecentlyReadyId(newlyReady.id);
            if (soundEnabled) {
              soundPlayer.playReadyChime();
            }
            // Clear recent pulse after 20 seconds
            setTimeout(() => {
              setRecentlyReadyId((prev) => (prev === newlyReady.id ? null : prev));
            }, 20000);
          }
        }

        knownReadyIdsRef.current = currentReadyIds;
        initialLoadDoneRef.current = true;
        setOrders(fetchedOrders);
      },
      (error) => {
        console.error('Error fetching TV display orders:', error);
      }
    );

    return () => unsubscribe();
  }, [firestore, pdvId, soundEnabled]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Split into in-prep vs ready
  const { inPrepOrders, readyOrders } = useMemo(() => {
    if (!orders) return { inPrepOrders: [], readyOrders: [] };

    const inPrep = orders
      .filter((o) => o.status === 'PENDENTE' || o.status === 'EM_PREPARO')
      .sort((a, b) => {
        const da = formatTimestamp(a.created_at).getTime();
        const db = formatTimestamp(b.created_at).getTime();
        return da - db; // FIFO
      });

    const ready = orders
      .filter((o) => o.status === 'PRONTO')
      .sort((a, b) => {
        const da = formatTimestamp(a.updated_at || a.created_at).getTime();
        const db = formatTimestamp(b.updated_at || b.created_at).getTime();
        return db - da; // Newest ready first
      });

    return { inPrepOrders: inPrep, readyOrders: ready };
  }, [orders]);

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans select-none ${
        isEmbedded ? 'rounded-2xl border border-slate-800 p-2 sm:p-4' : 'p-3 sm:p-6'
      }`}
    >
      {/* Top Header Bar for TV / Public */}
      <header className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 h-9 px-3 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
          )}

          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shrink-0">
            <Store className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold tracking-wider text-purple-400 uppercase">
                {eventName}
              </span>
              <span className="text-slate-600">•</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Painel ao Vivo
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight uppercase truncate">
              {pdvNome}
            </h1>
          </div>
        </div>

        {/* Header Right: Clock + TV Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight text-white">
              {currentTime}
            </span>
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
              Horário Oficial
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Som ativado (clique para mutar)' : 'Som mutado'}
              className={`p-2.5 rounded-xl border transition-colors ${
                soundEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={toggleFullscreen}
              title="Alternar tela cheia"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Screen (50% Em Preparo / 50% Pronto para Retirada) */}
      <main className="flex-1 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: EM PREPARO (5 cols) */}
        <section className="lg:col-span-5 flex flex-col rounded-3xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 overflow-hidden shadow-inner">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Flame className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-black text-amber-400 uppercase tracking-wider">
                  Em Preparo
                </h2>
                <p className="text-[11px] text-slate-400">Na chapa / montagem</p>
              </div>
            </div>
            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 font-black text-sm px-2.5 py-0.5">
              {inPrepOrders.length}
            </Badge>
          </div>

          {/* List of Orders in Prep */}
          <div className="flex-1 overflow-y-auto pr-1">
            {inPrepOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-600">
                <UtensilsCrossed className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-xs sm:text-sm font-medium">Nenhum pedido no fogo no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                {inPrepOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between shadow-xs transition-transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-black text-xl sm:text-2xl text-amber-300">
                        #{order.order_number}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                    </div>
                    <p className="font-semibold text-xs sm:text-sm text-slate-200 truncate mt-1">
                      {order.cliente_nome || 'Cliente'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: PRONTO PARA RETIRADA (7 cols) - HIGHLIGHTED */}
        <section className="lg:col-span-7 flex flex-col rounded-3xl bg-emerald-950/20 border-2 border-emerald-500/40 p-4 sm:p-5 overflow-hidden shadow-2xl relative">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/30 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
                <BellRing className="h-6 w-6 stroke-[2.5] animate-bounce" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-emerald-400 uppercase tracking-wider">
                  Pronto p/ Retirada
                </h2>
                <p className="text-xs text-emerald-300/80 font-medium">
                  Dirija-se ao balcão de entrega!
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500 text-slate-950 font-black text-base px-3 py-1 shadow-md">
              {readyOrders.length}
            </Badge>
          </div>

          {/* Grid of Ready Orders */}
          <div className="flex-1 overflow-y-auto pr-1">
            {readyOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-emerald-400/40">
                <CheckCircle2 className="h-14 w-14 mb-3 stroke-[1.5]" />
                <p className="text-sm sm:text-base font-bold">
                  Aguardando próximos pedidos prontos...
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Seu número aparecerá com destaque aqui quando pronto.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {readyOrders.map((order, index) => {
                  const isNewest = order.id === recentlyReadyId || index === 0;

                  return (
                    <div
                      key={order.id}
                      className={`relative rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 shadow-xl overflow-hidden ${
                        isNewest
                          ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white ring-4 ring-emerald-400/70 scale-[1.02] animate-pulse'
                          : 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-100 hover:border-emerald-400'
                      }`}
                    >
                      {/* Top Tag */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                            isNewest
                              ? 'bg-white text-emerald-900 shadow-sm'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {isNewest ? '🔔 RETIRAR AGORA' : 'PRONTO'}
                        </span>

                        <span className="text-[11px] font-mono opacity-80">
                          {formatTimestamp(order.updated_at || order.created_at).toLocaleTimeString(
                            'pt-BR',
                            { hour: '2-digit', minute: '2-digit' }
                          )}
                        </span>
                      </div>

                      {/* Giant Order Number */}
                      <div className="my-1">
                        <span className="font-mono font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight block drop-shadow-md">
                          #{order.order_number}
                        </span>
                      </div>

                      {/* Customer Name */}
                      <div className="pt-2 border-t border-white/20">
                        <p className="font-black text-base sm:text-xl lg:text-2xl truncate uppercase tracking-wide">
                          {order.cliente_nome || 'Cliente'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Floating Ticker / Information Banner */}
      <footer className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <span>
            Apresente seu <strong>cartão ou comprovante</strong> no balcão de retirada.
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          FestaPay Live Display • Atualização em tempo real
        </div>
      </footer>
    </div>
  );
}
