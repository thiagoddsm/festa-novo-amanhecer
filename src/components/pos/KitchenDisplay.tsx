'use client';

import { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { type Order, type OrderItem, type Pdv } from '@/lib/definitions';
import { updateOrderStatus, updateOrderPreparer } from '@/lib/actions';
import CancelOrderButton from './CancelOrderButton';
import { useToast } from '@/hooks/use-toast';
import { soundPlayer } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChefHat,
  Clock,
  Check,
  CheckCircle2,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRightCircle,
  Loader2,
  Utensils,
  Layers,
  ArrowLeft,
  UserCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  detectBoothCategory,
  calculateQueueTotals,
  type BoothCategory,
} from '@/lib/queue-estimator';

interface KitchenDisplayProps {
  pdvId?: string;
  pdvNome?: string;
  onBack?: () => void;
  isEmbedded?: boolean;
}

type FilterMode = 'ATIVOS' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE';

function formatTimestamp(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

function ElapsedTimeBadge({ createdAt }: { createdAt: unknown }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const createdDate = formatTimestamp(createdAt);
    const update = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 1000));
      setElapsedSeconds(diffSec);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  // Color alert thresholds
  if (minutes >= 15) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse shadow-sm">
        <AlertTriangle className="h-3.5 w-3.5 stroke-[2.5]" />
        {minutes}m {seconds.toString().padStart(2, '0')}s
      </span>
    );
  }

  if (minutes >= 8) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-sm">
        <Clock className="h-3.5 w-3.5" />
        {minutes}m {seconds.toString().padStart(2, '0')}s
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800/90 text-emerald-400 border border-slate-700">
      <Clock className="h-3.5 w-3.5 text-emerald-400" />
      {minutes}m {seconds.toString().padStart(2, '0')}s
    </span>
  );
}

export default function KitchenDisplay({
  pdvId,
  pdvNome = 'Cozinha',
  onBack,
  isEmbedded = false,
}: KitchenDisplayProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [equipePreparo, setEquipePreparo] = useState<string[]>([]);
  const [selectedPreparerFilter, setSelectedPreparerFilter] = useState<string>('ALL');
  const [editingPreparerOrderId, setEditingPreparerOrderId] = useState<string | null>(null);
  const [customPreparerInput, setCustomPreparerInput] = useState<string>('');
  const [filterMode, setFilterMode] = useState<FilterMode>('ATIVOS');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Listen to PDV equipe_preparo
  useEffect(() => {
    if (!firestore || !pdvId) return;
    const unsubscribe = onSnapshot(doc(firestore, 'pdvs', pdvId), (snap) => {
      if (snap.exists()) {
        const pdvData = snap.data() as Pdv;
        setEquipePreparo(pdvData.equipe_preparo || []);
      }
    });
    return () => unsubscribe();
  }, [firestore, pdvId]);

  // Track known order IDs to play alert chime on genuinely new orders
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // Digital clock
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

  // Listen to orders
  useEffect(() => {
    if (!firestore || !pdvId) return;

    const ordersRef = collection(firestore, 'orders');
    const q = query(
      ordersRef,
      where('pdv_id', '==', pdvId),
      where('status', 'in', ['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Order)
        );

        // Sort FIFO: oldest created first
        fetchedOrders.sort((a, b) => {
          const dateA = formatTimestamp(a.created_at);
          const dateB = formatTimestamp(b.created_at);
          return dateA.getTime() - dateB.getTime();
        });

        // Detect new orders for sound chime
        if (initialLoadDoneRef.current && soundEnabled) {
          const hasNewActiveOrder = fetchedOrders.some(
            (o) =>
              (o.status === 'PENDENTE' || o.status === 'EM_PREPARO') &&
              !knownOrderIdsRef.current.has(o.id)
          );
          if (hasNewActiveOrder) {
            soundPlayer.playNewOrderAlert();
          }
        }

        // Update known IDs
        fetchedOrders.forEach((o) => knownOrderIdsRef.current.add(o.id));
        initialLoadDoneRef.current = true;

        setOrders(fetchedOrders);
      },
      (error) => {
        console.error('Error fetching KDS orders:', error);
        toast({
          variant: 'destructive',
          title: 'Erro na Cozinha',
          description: 'Falha ao sincronizar pedidos da chapa.',
        });
      }
    );

    return () => unsubscribe();
  }, [firestore, pdvId, soundEnabled, toast]);

  // Fullscreen handler
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

  // Handle order status advance
  const handleUpdateStatus = async (order: Order, newStatus: Order['status']) => {
    setUpdatingOrderId(order.id);
    try {
      const res = await updateOrderStatus(order.id, newStatus);
      if (res?.status === 'error') {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: res.message,
        });
      } else {
        if (newStatus === 'PRONTO') {
          soundPlayer.playReadyChime();
        }
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar pedido',
        description: 'Tente novamente.',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAssignPreparer = async (orderId: string, name: string | null) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await updateOrderPreparer(orderId, name);
      if (res?.status === 'error') {
        toast({
          variant: 'destructive',
          title: 'Erro ao direcionar preparo',
          description: res.message,
        });
      } else {
        setEditingPreparerOrderId(null);
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const availablePreparers = useMemo(() => {
    const set = new Set<string>(equipePreparo);
    (orders || []).forEach((o) => {
      if (o.responsavel_preparo?.trim()) {
        set.add(o.responsavel_preparo.trim());
      }
    });
    return Array.from(set);
  }, [equipePreparo, orders]);

  // Categorize
  const counts = useMemo(() => {
    if (!orders) return { emPreparo: 0, pronto: 0, entregue: 0, totalAtivos: 0 };
    let emPreparo = 0;
    let pronto = 0;
    let entregue = 0;

    orders.forEach((o) => {
      if (o.status === 'PENDENTE' || o.status === 'EM_PREPARO') emPreparo++;
      else if (o.status === 'PRONTO') pronto++;
      else if (o.status === 'ENTREGUE') entregue++;
    });

    return {
      emPreparo,
      pronto,
      entregue,
      totalAtivos: emPreparo + pronto,
    };
  }, [orders]);

  const category = useMemo(() => detectBoothCategory(pdvNome), [pdvNome]);
  const inPrepOrders = useMemo(() => {
    return (orders || []).filter((o) => o.status === 'PENDENTE' || o.status === 'EM_PREPARO');
  }, [orders]);
  const queueTotals = useMemo(() => {
    return calculateQueueTotals(inPrepOrders, category);
  }, [inPrepOrders, category]);

  // Filtered orders com ordenação estrita pela hora do pedido (FIFO)
  const { visibleOrders, inPrepList } = useMemo(() => {
    if (!orders) return { visibleOrders: [], inPrepList: [] };

    // Fila estritamente ordenada por ordem de chegada (hora do pedido ascendente)
    const inPrep = orders
      .filter((o) => o.status === 'PENDENTE' || o.status === 'EM_PREPARO')
      .sort((a, b) => {
        const da = formatTimestamp(a.created_at).getTime();
        const db = formatTimestamp(b.created_at).getTime();
        return da - db; // FIFO: mais antigo primeiro
      });

    // Prontos ordenados pelos mais recentes primeiro
    const prontos = orders
      .filter((o) => o.status === 'PRONTO')
      .sort((a, b) => {
        const da = formatTimestamp(a.ready_at || a.updated_at || a.created_at).getTime();
        const db = formatTimestamp(b.ready_at || b.updated_at || b.created_at).getTime();
        return db - da;
      });

    // Entregues
    const entregues = orders
      .filter((o) => o.status === 'ENTREGUE')
      .sort((a, b) => {
        const da = formatTimestamp(a.delivered_at || a.updated_at || a.created_at).getTime();
        const db = formatTimestamp(b.delivered_at || b.updated_at || b.created_at).getTime();
        return db - da;
      })
      .slice(0, 30);

    let list: Order[] = [];
    if (filterMode === 'ATIVOS') {
      list = [...inPrep, ...prontos];
    } else if (filterMode === 'EM_PREPARO') {
      list = inPrep;
    } else if (filterMode === 'PRONTO') {
      list = prontos;
    } else if (filterMode === 'ENTREGUE') {
      list = entregues;
    } else {
      list = orders;
    }

    if (selectedPreparerFilter !== 'ALL') {
      list = list.filter((o) => {
        if (selectedPreparerFilter === 'UNASSIGNED') return !o.responsavel_preparo?.trim();
        return o.responsavel_preparo?.trim().toLowerCase() === selectedPreparerFilter.toLowerCase();
      });
    }

    return { visibleOrders: list, inPrepList: inPrep };
  }, [orders, filterMode, selectedPreparerFilter]);

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none ${
        isEmbedded ? 'rounded-2xl border border-slate-800 p-2 sm:p-4' : 'p-3 sm:p-5'
      }`}
    >
      {/* Top Bar Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
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

          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ChefHat className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase">
                {pdvNome}
              </h1>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[11px] font-bold">
                KDS • PRODUÇÃO
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>
                {category === 'HAMBURGUER'
                  ? queueTotals.totalSlots > 0
                    ? `Fila de montagem • ${queueTotals.totalSlots} carnes na chapa`
                    : 'Fila de montagem & chapa'
                  : category === 'PASTEL'
                  ? `Fritadeiras & tachos • ${queueTotals.totalUnits} pastéis`
                  : category === 'BATATA_FRITA'
                  ? `Fritadeiras & cestos • ${queueTotals.totalUnits} porções`
                  : category === 'PIZZA'
                  ? `Forno de pizza • ${queueTotals.totalUnits} pizzas`
                  : category === 'CHURRASCO'
                  ? `Grelha & brasa • ${queueTotals.totalUnits} espetos`
                  : category === 'CALDO'
                  ? `Caldeirões & rechauds • ${queueTotals.totalUnits} caldos`
                  : category === 'CACHORRO_QUENTE'
                  ? `Prensas de hot dog • ${queueTotals.totalUnits} lanches`
                  : 'Fila de produção & montagem'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-mono font-medium">{currentTime}</span>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
            className={`h-9 px-3 rounded-xl border text-xs font-semibold ${
              soundEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 mr-1.5" />
                Som Ativo
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 mr-1.5" />
                Mudo
              </>
            )}
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 h-9 px-3 rounded-xl text-xs font-semibold"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4 mr-1.5" />
                Sair Tela Cheia
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 mr-1.5" />
                Tela Cheia
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Filter Tabs & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterMode('ATIVOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'ATIVOS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fila Ativa ({counts.totalAtivos})
          </button>
          <button
            onClick={() => setFilterMode('EM_PREPARO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'EM_PREPARO'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Em Preparo ({counts.emPreparo})
          </button>
          <button
            onClick={() => setFilterMode('PRONTO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'PRONTO'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Prontos ({counts.pronto})
          </button>
          <button
            onClick={() => setFilterMode('ENTREGUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'ENTREGUE'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Entregues ({counts.entregue})
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total na tela: <span className="text-white font-bold">{visibleOrders.length}</span>
        </div>
      </div>

      {/* Preparer Filter Bar (when stall uses preparer assignment) */}
      {availablePreparers.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-slate-800/80">
          <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
            <UserCheck className="h-3.5 w-3.5 text-violet-400" /> Filtrar responsável:
          </span>
          <button
            type="button"
            onClick={() => setSelectedPreparerFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0 ${
              selectedPreparerFilter === 'ALL'
                ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            Todos
          </button>
          {availablePreparers.map((nome) => {
            const isSelected = selectedPreparerFilter.toLowerCase() === nome.toLowerCase();
            const activeCount = (orders || []).filter(
              (o) =>
                (o.status === 'PENDENTE' || o.status === 'EM_PREPARO') &&
                o.responsavel_preparo?.trim().toLowerCase() === nome.toLowerCase()
            ).length;
            return (
              <button
                key={nome}
                type="button"
                onClick={() => setSelectedPreparerFilter(isSelected ? 'ALL' : nome)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                    : 'bg-slate-900 text-slate-200 hover:bg-violet-500/20 border-slate-800'
                }`}
              >
                👨‍🍳 {nome} ({activeCount})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setSelectedPreparerFilter(selectedPreparerFilter === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')
            }
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0 ${
              selectedPreparerFilter === 'UNASSIGNED'
                ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
            }`}
          >
            Sem responsável
          </button>
        </div>
      )}

      {/* Main Grid of Orders */}
      <main className="flex-1 py-4 overflow-y-auto">
        {orders === null ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm font-medium">Carregando pedidos da cozinha...</p>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-center p-6 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
            <Utensils className="h-12 w-12 text-slate-700 mb-3" />
            <h3 className="text-base font-bold text-slate-300">Nenhum pedido nesta fila</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Quando novos pedidos forem lançados no caixa, eles aparecerão aqui instantaneamente
              com alerta sonoro.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
            {visibleOrders.map((order) => {
              const isEmPreparo =
                order.status === 'PENDENTE' || order.status === 'EM_PREPARO';
              const isPronto = order.status === 'PRONTO';
              const isEntregue = order.status === 'ENTREGUE';
              const isUpdating = updatingOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className={`flex flex-col justify-between rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg ${
                    isPronto
                      ? 'bg-slate-900/90 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : isEntregue
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  {(() => {
                    const queuePos = inPrepList.findIndex((o) => o.id === order.id);
                    return (
                      <div
                        className={`p-3.5 border-b flex items-start justify-between gap-2 ${
                          isPronto
                            ? 'bg-emerald-950/40 border-emerald-500/30'
                            : 'bg-slate-800/40 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-2xl sm:text-3xl tracking-tight text-white font-mono">
                              #{order.order_number}
                            </span>
                            {isEmPreparo && queuePos >= 0 && (
                              <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 shadow-xs">
                                #{queuePos + 1} NA FILA
                              </Badge>
                            )}
                            {isPronto && (
                              <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 shadow-xs">
                                PRONTO
                              </Badge>
                            )}
                            {isEntregue && (
                              <Badge className="bg-slate-700 text-slate-300 font-bold text-[10px] px-2">
                                ENTREGUE
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-300 truncate max-w-[170px] sm:max-w-[200px] mt-0.5">
                            {order.cliente_nome || 'Cliente'}
                          </p>
                          <div className="mt-1.5">
                            {order.responsavel_preparo ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingPreparerOrderId === order.id) {
                                    setEditingPreparerOrderId(null);
                                  } else {
                                    setCustomPreparerInput(order.responsavel_preparo || '');
                                    setEditingPreparerOrderId(order.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-violet-600 text-white border border-violet-400/50 shadow-xs hover:bg-violet-500 transition-colors"
                                title="Clique para alterar ou remover responsável pelo preparo"
                              >
                                <span>👨‍🍳 PREPARO: {order.responsavel_preparo.toUpperCase()}</span>
                              </button>
                            ) : isEmPreparo ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingPreparerOrderId === order.id) {
                                    setEditingPreparerOrderId(null);
                                  } else {
                                    setCustomPreparerInput('');
                                    setEditingPreparerOrderId(order.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800/80 text-slate-400 hover:text-violet-300 border border-dashed border-slate-700 hover:border-violet-500/40 transition-colors"
                              >
                                <UserCheck className="h-3 w-3" />
                                <span>Direcionar preparo</span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isEmPreparo ? (
                            <ElapsedTimeBadge createdAt={order.created_at} />
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <Check className="h-3 w-3 stroke-[3]" />
                              {order.prep_time_formatted ? `Pronto em ${order.prep_time_formatted}` : 'Pronto'}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span>Pedido:</span>
                            <strong className="text-slate-300 font-semibold">
                              {formatTimestamp(order.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </strong>
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card Items List */}
                  <div className="p-3.5 flex-1 space-y-2.5">
                    {editingPreparerOrderId === order.id && (
                      <div className="p-2.5 rounded-xl border border-violet-500/40 bg-violet-950/30 space-y-2 mb-2">
                        {equipePreparo.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {equipePreparo.map((nome) => {
                              const active =
                                order.responsavel_preparo?.toLowerCase() === nome.toLowerCase();
                              return (
                                <button
                                  key={nome}
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleAssignPreparer(order.id, active ? null : nome)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                    active
                                      ? 'bg-violet-600 text-white border-violet-400'
                                      : 'bg-slate-900 hover:bg-violet-500/20 text-slate-200 border-slate-700'
                                  }`}
                                >
                                  👨‍🍳 {nome}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={customPreparerInput}
                            onChange={(e) => setCustomPreparerInput(e.target.value)}
                            placeholder="Nome do responsável..."
                            className="h-8 text-xs bg-slate-900 border-slate-700 text-white"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAssignPreparer(order.id, customPreparerInput.trim() || null);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() =>
                              handleAssignPreparer(order.id, customPreparerInput.trim() || null)
                            }
                            className="h-8 px-2.5 text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold"
                          >
                            Salvar
                          </Button>
                          {order.responsavel_preparo && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() => handleAssignPreparer(order.id, null)}
                              className="h-8 px-2 text-xs text-rose-400 hover:text-rose-300"
                              title="Remover responsável"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    <ul className="space-y-2 divide-y divide-slate-800/60">
                      {order.items.map((item: OrderItem, idx: number) => {
                        const hasCustomObs = !!item.observation;
                        const isExclusion =
                          item.observation &&
                          (item.observation.toUpperCase().includes('SEM') ||
                            item.observation.toUpperCase().includes('NÃO'));

                        return (
                          <li key={`${item.id}-${idx}`} className="pt-2 first:pt-0">
                            <div className="flex items-start gap-2">
                              <span className="font-black text-lg sm:text-xl text-amber-400 font-mono shrink-0">
                                {item.quantity}x
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-bold text-sm sm:text-base leading-snug ${item.requer_preparo === false ? 'text-slate-400 line-through' : 'text-white'}`}>
                                    {item.name}
                                  </span>
                                  {item.requer_preparo === false && (
                                    <Badge className="bg-slate-800 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 shrink-0">
                                      ⚡ Balcão
                                    </Badge>
                                  )}
                                </div>

                                {/* Prominent Observation Box for Cooks */}
                                {hasCustomObs && (
                                  <div
                                    className={`mt-1.5 p-1.5 rounded-lg text-xs font-bold border flex items-start gap-1.5 ${
                                      isExclusion
                                        ? 'bg-rose-950/70 border-rose-600/80 text-rose-300'
                                        : 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                                    }`}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 stroke-[2.5]" />
                                    <span className="leading-tight uppercase tracking-wide">
                                      {item.observation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex flex-col gap-2">
                    {isEmPreparo && (
                      <Button
                        size="lg"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(order, 'PRONTO')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm h-12 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Check className="h-5 w-5 stroke-[3]" />
                        )}
                        PRONTO P/ RETIRADA
                      </Button>
                    )}

                    {isPronto && (
                      <div className="grid grid-cols-5 gap-1.5 w-full">
                        <Button
                          size="lg"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order, 'ENTREGUE')}
                          className="col-span-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm h-11 rounded-xl shadow-md flex items-center justify-center gap-1.5"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                          )}
                          ENTREGAR
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order, 'EM_PREPARO')}
                          title="Voltar para preparo"
                          className="col-span-2 bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold h-11 rounded-xl flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Voltar
                        </Button>
                      </div>
                    )}

                    {isEntregue && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Entregue
                        </span>
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdateStatus(order, 'PRONTO')}
                          className="text-[11px] text-slate-400 hover:text-white underline"
                        >
                          Reabrir
                        </button>
                      </div>
                    )}
                    <CancelOrderButton
                      order={order}
                      className="h-9 w-full text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 gap-1.5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
