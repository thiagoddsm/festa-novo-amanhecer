'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { type Pdv, type Order } from '@/lib/definitions';
import { getPdvIconConfig } from '@/lib/pdv-icons';
import { soundPlayer } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Clock,
  CheckCircle2,
  BellRing,
  Store,
  Flame,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  UtensilsCrossed,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface PublicOrderTrackerProps {
  initialPdvId?: string | null;
  initialQuery?: string | null;
}

function formatTimestamp(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

function calculateGriddleEstimate(position: number, totalCarnes: number) {
  if (position <= 0) return { time: '~3 a 5 min', info: 'Início imediato nas chapas' };
  if (position === 1) return { time: '~5 a 8 min', info: '1ª rodada (na chapa agora)' };
  if (position <= 3) return { time: '~8 a 14 min', info: '1ª ou 2ª rodada nas 2 chapas' };
  if (position <= 6) return { time: '~12 a 18 min', info: '~2ª rodada nas chapas' };
  if (position <= 10) return { time: '~18 a 25 min', info: '~3ª rodada nas chapas' };
  return { time: '+30 min', info: 'Fila intensa nas chapas' };
}

export default function PublicOrderTracker({
  initialPdvId,
  initialQuery = '',
}: PublicOrderTrackerProps) {
  const firestore = useFirestore();

  const [allPdvs, setAllPdvs] = useState<Pdv[] | null>(null);
  const [selectedPdvId, setSelectedPdvId] = useState<string | null>(initialPdvId || null);
  const [orders, setOrders] = useState<Order[] | null>(null);

  // Search input and persisted saved order
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [savedOrderNumber, setSavedOrderNumber] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'PREPARO' | 'PRONTO'>('PREPARO');

  // Load saved order from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('festapay_my_order');
      if (stored && !searchQuery) {
        setSavedOrderNumber(stored);
        setSearchQuery(stored);
      }
    }
  }, []);

  // Save search query to localStorage when user searches a number
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (val.trim()) {
      localStorage.setItem('festapay_my_order', val.trim());
      setSavedOrderNumber(val.trim());
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSavedOrderNumber('');
    localStorage.removeItem('festapay_my_order');
  };

  // 1. Load active PDVs
  useEffect(() => {
    if (!firestore) return;
    const pdvRef = collection(firestore, 'pdvs');
    const q = query(pdvRef, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pdv));
        setAllPdvs(fetched);

        // If no PDV selected, default to first or let user choose
        if (!selectedPdvId && fetched.length > 0 && initialPdvId) {
          setSelectedPdvId(initialPdvId);
        }
      },
      (err) => {
        console.error('Error fetching PDVs for tracker:', err);
        setAllPdvs([]);
      }
    );

    return () => unsubscribe();
  }, [firestore, initialPdvId]);

  // 2. Load active orders for selected PDV in real-time
  const knownReadyRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!firestore || !selectedPdvId) {
      setOrders(null);
      return;
    }

    const ordersRef = collection(firestore, 'orders');
    const q = query(
      ordersRef,
      where('pdv_id', '==', selectedPdvId),
      where('status', 'in', ['PENDENTE', 'EM_PREPARO', 'PRONTO'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Order)
        );

        // Check if user's tracked order became ready to play audio chime
        if (initialLoadRef.current && soundEnabled && searchQuery.trim()) {
          const cleanQuery = searchQuery.trim().replace('#', '').toUpperCase();
          const newlyReady = fetchedOrders.find(
            (o) =>
              o.status === 'PRONTO' &&
              !knownReadyRef.current.has(o.id) &&
              (o.order_number?.toUpperCase().includes(cleanQuery) ||
                o.cliente_nome?.toUpperCase().includes(cleanQuery))
          );

          if (newlyReady) {
            soundPlayer.playReadyChime();
          }
        }

        knownReadyRef.current = new Set(
          fetchedOrders.filter((o) => o.status === 'PRONTO').map((o) => o.id)
        );
        initialLoadRef.current = true;
        setOrders(fetchedOrders);
      },
      (error) => {
        console.error('Error fetching public tracker orders:', error);
      }
    );

    return () => unsubscribe();
  }, [firestore, selectedPdvId, soundEnabled, searchQuery]);

  // Split and sort orders
  const { inPrepOrders, readyOrders, totalItemsInPrep } = useMemo(() => {
    if (!orders) return { inPrepOrders: [], readyOrders: [], totalItemsInPrep: 0 };

    // FIFO: Oldest order first
    const inPrep = orders
      .filter((o) => o.status === 'PENDENTE' || o.status === 'EM_PREPARO')
      .sort((a, b) => {
        const da = formatTimestamp(a.created_at).getTime();
        const db = formatTimestamp(b.created_at).getTime();
        return da - db;
      });

    // Newest ready first
    const ready = orders
      .filter((o) => o.status === 'PRONTO')
      .sort((a, b) => {
        const da = formatTimestamp(a.ready_at || a.updated_at || a.created_at).getTime();
        const db = formatTimestamp(b.ready_at || b.updated_at || b.created_at).getTime();
        return db - da;
      });

    let itemsCount = 0;
    inPrep.forEach((o) => {
      if (Array.isArray(o.items)) {
        itemsCount += o.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      }
    });

    return { inPrepOrders: inPrep, readyOrders: ready, totalItemsInPrep: itemsCount };
  }, [orders]);

  // Find user's searched order
  const matchedOrderInfo = useMemo(() => {
    if (!searchQuery.trim() || !orders) return null;
    const qClean = searchQuery.trim().replace('#', '').toUpperCase();

    // Look in ready orders first (highest excitement!)
    const readyMatch = readyOrders.find(
      (o) =>
        o.order_number?.toUpperCase().includes(qClean) ||
        o.cliente_nome?.toUpperCase().includes(qClean)
    );
    if (readyMatch) {
      return {
        order: readyMatch,
        status: 'PRONTO' as const,
        position: 0,
        estimate: { time: 'Pronto agora', info: 'Pode retirar no balcão!' },
      };
    }

    // Look in in-prep orders
    const prepIndex = inPrepOrders.findIndex(
      (o) =>
        o.order_number?.toUpperCase().includes(qClean) ||
        o.cliente_nome?.toUpperCase().includes(qClean)
    );

    if (prepIndex >= 0) {
      const match = inPrepOrders[prepIndex];
      const position = prepIndex + 1;
      const estimate = calculateGriddleEstimate(prepIndex, totalItemsInPrep);
      return {
        order: match,
        status: 'EM_PREPARO' as const,
        position,
        estimate,
      };
    }

    return null;
  }, [searchQuery, orders, readyOrders, inPrepOrders, totalItemsInPrep]);

  const activePdv = (allPdvs || []).find((p) => p.id === selectedPdvId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
              FP
            </div>
            <div>
              <p className="text-xs font-bold text-white tracking-tight leading-none group-hover:text-purple-400 transition-colors">
                Festa Novo Amanhecer
              </p>
              <p className="text-[10px] text-purple-400 font-semibold leading-tight">
                Acompanhamento ao Vivo
              </p>
            </div>
          </Link>

          {/* Sound Toggle & Switch Booth */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar avisos sonoros' : 'Ativar avisos sonoros'}
              className={`p-2 rounded-xl border text-xs transition-colors flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden sm:inline text-[11px] font-semibold">
                {soundEnabled ? 'Aviso Sonoro' : 'Mudo'}
              </span>
            </button>

            {selectedPdvId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPdvId(null)}
                className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 text-xs h-8 px-2.5 rounded-xl"
              >
                <Store className="h-3.5 w-3.5 mr-1 text-purple-400" />
                Trocar Barraca
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* If no PDV selected, show Booth Selector */}
        {!selectedPdvId && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="text-center space-y-2 pt-2">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-purple-600/20 text-purple-400 items-center justify-center border border-purple-500/30 mb-1">
                <Store className="h-7 w-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                Onde você comprou?
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Selecione a barraca para acompanhar a fila de preparo e o chamado da sua senha em tempo real:
              </p>
            </div>

            {/* List of Booths */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {allPdvs === null ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse"
                  />
                ))
              ) : allPdvs.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-sm">
                  Nenhuma barraca com pedidos ativos no momento.
                </div>
              ) : (
                allPdvs.map((pdv) => {
                  const config = getPdvIconConfig(pdv.icon, pdv.nome);
                  const Icon = config.icon;

                  return (
                    <button
                      key={pdv.id}
                      onClick={() => setSelectedPdvId(pdv.id)}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-850 transition-all text-left shadow-md hover:scale-[1.01] cursor-pointer"
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
                          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Acompanhar ao vivo
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* When a PDV is Selected: Live Order Tracker */}
        {selectedPdvId && activePdv && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Booth Header Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const config = getPdvIconConfig(activePdv.icon, activePdv.nome);
                  const Icon = config.icon;
                  return (
                    <div
                      className={`h-12 w-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0 shadow-sm`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-white truncate uppercase">
                      {activePdv.nome}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ao Vivo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {inPrepOrders.length === 0
                      ? 'Chapas livres sem fila de espera'
                      : `${inPrepOrders.length} ${
                          inPrepOrders.length === 1 ? 'pedido' : 'pedidos'
                        } em preparo (${totalItemsInPrep} lanches)`}
                  </p>
                </div>
              </div>
            </div>

            {/* Smart Search Bar (Search your Order Number / Name) */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-purple-400 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Digite sua Senha (#84F1) ou seu Nome..."
                  className="pl-10 pr-10 h-12 bg-slate-900 border-slate-800 focus:border-purple-500 rounded-xl text-white placeholder:text-slate-500 text-sm font-medium shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3.5 p-1 rounded-md text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 px-1">
                Dica: Digite apenas os números da sua senha para destacar seu pedido instantaneamente.
              </p>
            </div>

            {/* PINNED STATUS CARD: If user searched and order is found! */}
            {matchedOrderInfo && (
              <div
                className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 shadow-xl ${
                  matchedOrderInfo.status === 'PRONTO'
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400 ring-2 ring-emerald-400/50 text-white animate-pulse'
                    : 'bg-gradient-to-br from-slate-900 to-purple-950/70 border-purple-500/60 ring-1 ring-purple-500/40 text-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                      {matchedOrderInfo.status === 'PRONTO' ? '🎉 SEU PEDIDO ESTÁ PRONTO!' : '⏳ SEU PEDIDO NA FILA'}
                    </span>
                  </div>
                  <span className="font-mono text-xs opacity-80">
                    Pedido #{matchedOrderInfo.order.order_number}
                  </span>
                </div>

                <div className="my-2">
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {matchedOrderInfo.order.cliente_nome || 'Cliente'}
                  </h3>

                  {matchedOrderInfo.status === 'PRONTO' ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm sm:text-base font-bold text-emerald-100 flex items-center gap-1.5">
                        <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
                        Pode retirar agora na bancada de entrega!
                      </p>
                      <p className="text-xs text-white/80">
                        Apresente seu cartão ou comprovante da compra.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold">
                        <Flame className="h-4 w-4 text-amber-400" />
                        <span>Você é o #{matchedOrderInfo.position} da fila de preparo</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300">
                        Tempo estimado nas chapas: <strong className="text-white font-bold">{matchedOrderInfo.estimate.time}</strong>{' '}
                        <span className="opacity-75">({matchedOrderInfo.estimate.info})</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Items in the user's order */}
                {Array.isArray(matchedOrderInfo.order.items) && (
                  <div className="mt-3 pt-3 border-t border-white/15 text-xs opacity-90">
                    <p className="font-semibold mb-1">Itens do seu pedido:</p>
                    <ul className="space-y-0.5">
                      {matchedOrderInfo.order.items.map((it, idx) => (
                        <li key={idx} className="flex items-center justify-between">
                          <span>
                            <strong>{it.quantity}x</strong> {it.name}
                          </span>
                          {it.observation && (
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                              {it.observation}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* If searched but NOT found */}
            {searchQuery.trim() && !matchedOrderInfo && orders && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                Nenhum pedido ativo encontrado para <strong className="text-white">"{searchQuery}"</strong> nesta barraca.
                Verifique se selecionou a barraca correta ou se o pedido já foi entregue.
              </div>
            )}

            {/* Mobile Tabs Switcher: Em Preparo (X) vs Prontos (Y) */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('PREPARO')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'PREPARO'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="h-4 w-4" />
                <span>Em Preparo ({inPrepOrders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('PRONTO')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'PRONTO'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BellRing className="h-4 w-4" />
                <span>Pronto p/ Retirada ({readyOrders.length})</span>
              </button>
            </div>

            {/* TAB 1: EM PREPARO (FIFO) */}
            {activeTab === 'PREPARO' && (
              <div className="space-y-2.5">
                {inPrepOrders.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-sm">
                    <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-600" />
                    <p className="font-bold text-slate-300">Nenhum pedido no fogo agora</p>
                    <p className="text-xs text-slate-500 mt-0.5">As chapas estão livres para novos pedidos.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {inPrepOrders.map((order, idx) => {
                      const isTracked = matchedOrderInfo?.order.id === order.id;

                      return (
                        <div
                          key={order.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isTracked
                              ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/50'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-black text-xl text-amber-300">
                              #{order.order_number}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              #{idx + 1} da fila
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                            <span className="font-bold text-slate-200 truncate">
                              {order.cliente_nome || 'Cliente'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              Pedido às{' '}
                              {formatTimestamp(order.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Quick details */}
                          <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>
                              {order.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1} item(ns)
                            </span>
                            <span className="text-amber-400/90 font-medium">
                              {calculateGriddleEstimate(idx, totalItemsInPrep).time}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PRONTOS PARA RETIRADA */}
            {activeTab === 'PRONTO' && (
              <div className="space-y-2.5">
                {readyOrders.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-sm">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40 text-emerald-600" />
                    <p className="font-bold text-slate-300">Aguardando próximos pedidos prontos...</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Quando seu lanche estiver pronto, ele aparecerá aqui com destaque!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {readyOrders.map((order, idx) => {
                      const isTracked = matchedOrderInfo?.order.id === order.id;

                      return (
                        <div
                          key={order.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isTracked
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 scale-[1.02] shadow-lg'
                              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100 hover:border-emerald-400 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isTracked
                                  ? 'bg-white text-emerald-900'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              RETIRAR NO BALCÃO
                            </span>
                            <span className="text-[10px] font-mono opacity-80">
                              {formatTimestamp(order.ready_at || order.updated_at || order.created_at).toLocaleTimeString(
                                'pt-BR',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </span>
                          </div>

                          <div className="my-1">
                            <span className="font-mono font-black text-3xl sm:text-4xl tracking-tight block">
                              #{order.order_number}
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-white/20 flex items-center justify-between">
                            <p className="font-bold text-sm truncate uppercase">
                              {order.cliente_nome || 'Cliente'}
                            </p>
                            {order.prep_time_formatted && (
                              <span className="text-[10px] font-medium opacity-80">
                                ⏱ {order.prep_time_formatted}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Helper */}
      <footer className="border-t border-slate-900 bg-slate-950/80 p-4 text-center text-xs text-slate-500">
        <p>
          Festa Novo Amanhecer 2026 • Apresente seu comprovante ou cartão na bancada de retirada.
        </p>
      </footer>
    </div>
  );
}
