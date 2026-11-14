'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  Timestamp,
  limit,
} from 'firebase/firestore';
import type { Card as CardType, Transaction, Order, Pdv } from '@/lib/definitions';
import { formatCurrency, extractCardQrCode } from '@/lib/utils';
import { formatWhatsAppNumber } from '@/lib/whatsapp';
import { soundPlayer } from '@/lib/audio';
import {
  detectBoothCategory,
  getItemSlots,
  calculateCustomerWaitEstimate,
} from '@/lib/queue-estimator';
import QrScannerDialog from '@/components/common/QrScannerDialog';
import OnlineRechargeDialog from '@/components/public/OnlineRechargeDialog';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  QrCode,
  Phone,
  Camera,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  Flame,
  ShoppingBag,
  PlusCircle,
  RotateCcw,
  ArrowRightLeft,
  LogOut,
  ZoomIn,
  BellRing,
  Store,
  ChevronRight,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

// Evento Oficial: Festa Novo Amanhecer 2026 - Igreja Batista da Manhã
const TARGET_EVENT_ID = 'DoKmbiQ8pd3M71yTC9iA';

const STORAGE_CARD_KEY = 'festapay_customer_card_qr_2026';
const STORAGE_AUTH_MODE_KEY = 'festapay_customer_auth_mode_2026';
const STORAGE_LARGE_FONT_KEY = 'festapay_senior_large_font';
const STORAGE_SOUND_KEY = 'festapay_customer_sound';

/**
 * Modo de autenticação do cliente:
 * - 'QR_VERIFIED': O cliente leu fisicamente o QR Code do papel (via câmera nativa `/c/[code]` ou leitor do app). Permite exibir o QR Code de pagamento.
 * - 'PHONE_ONLY': O cliente entrou digitando apenas o número de telefone. Mostra Saldo, Pedidos e Extrato, mas OCULTA o QR Code e mascara o ID para evitar uso indevido no PDV.
 */
type CustomerAuthMode = 'QR_VERIFIED' | 'PHONE_ONLY';

interface CustomerWalletAppProps {
  initialCode?: string | null;
  initialPhone?: string | null;
}

function toDate(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
  return new Date();
}

function formatFriendlyTime(ts: unknown): string {
  const date = toDate(ts);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskQrCodeId(qrCodeId: string): string {
  if (!qrCodeId) return '••••';
  const last4 = qrCodeId.slice(-4);
  return `Final ••••-${last4}`;
}

export default function CustomerWalletApp({
  initialCode,
  initialPhone,
}: CustomerWalletAppProps) {
  const firestore = useFirestore();

  // Accessibility & Preferences
  const [largeFont, setLargeFont] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isOnlineRechargeOpen, setIsOnlineRechargeOpen] = useState<boolean>(false);

  // Active Card & Security Mode state
  const [activeQrCodeId, setActiveQrCodeId] = useState<string>('');
  const [authMode, setAuthMode] = useState<CustomerAuthMode>('PHONE_ONLY');
  const [card, setCard] = useState<CardType | null>(null);
  const [isLoadingCard, setIsLoadingCard] = useState<boolean>(true);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Phone search & multi-card selection state
  const [phoneInput, setPhoneInput] = useState<string>(
    initialPhone ? formatPhoneMask(initialPhone) : ''
  );
  const [isSearchingPhone, setIsSearchingPhone] = useState<boolean>(false);
  const [matchingCards, setMatchingCards] = useState<CardType[] | null>(null);

  // Live data for active card
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allActiveOrders, setAllActiveOrders] = useState<Order[]>([]);
  const [pdvMap, setPdvMap] = useState<Record<string, Pdv>>({});

  // Track orders already announced as READY so we don't repeat-chime on every snapshot
  const announcedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const initialOrdersLoadedRef = useRef<boolean>(false);

  // 1. Load saved preferences and saved card on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedLargeFont = localStorage.getItem(STORAGE_LARGE_FONT_KEY);
    if (savedLargeFont === 'true') {
      setLargeFont(true);
    }

    const savedSound = localStorage.getItem(STORAGE_SOUND_KEY);
    if (savedSound === 'false') {
      setSoundEnabled(false);
    }

    // If user arrived via direct QR Code link (/c/[code] or ?c=...) -> QR_VERIFIED!
    if (initialCode && initialCode.trim()) {
      const clean = extractCardQrCode(initialCode);
      if (clean) {
        localStorage.setItem(STORAGE_CARD_KEY, clean);
        localStorage.setItem(STORAGE_AUTH_MODE_KEY, 'QR_VERIFIED');
        setAuthMode('QR_VERIFIED');
        setActiveQrCodeId(clean);
        return;
      }
    }

    const savedQr = localStorage.getItem(STORAGE_CARD_KEY);
    const savedMode = localStorage.getItem(STORAGE_AUTH_MODE_KEY) as CustomerAuthMode | null;

    if (savedQr && savedQr.trim()) {
      setAuthMode(savedMode === 'QR_VERIFIED' ? 'QR_VERIFIED' : 'PHONE_ONLY');
      setActiveQrCodeId(extractCardQrCode(savedQr));
    } else {
      setIsLoadingCard(false);
    }
  }, [initialCode]);

  const toggleLargeFont = () => {
    const next = !largeFont;
    setLargeFont(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LARGE_FONT_KEY, String(next));
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_SOUND_KEY, String(next));
    }
    if (next) {
      soundPlayer.playReadyChime();
    }
  };

  // 2. Load PDVs map strictly for Festa Novo Amanhecer 2026
  useEffect(() => {
    if (!firestore) return;
    const pdvQuery = query(
      collection(firestore, 'pdvs'),
      where('event_id', '==', TARGET_EVENT_ID)
    );
    const unsubscribe = onSnapshot(
      pdvQuery,
      (snap) => {
        const map: Record<string, Pdv> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() } as Pdv;
        });
        setPdvMap(map);
      },
      (err) => {
        console.warn('Error loading PDVs for customer wallet:', err);
      }
    );
    return () => unsubscribe();
  }, [firestore]);

  // 3. Subscribe in real-time to the active card by qr_code_id (strictly validated for Festa Novo Amanhecer 2026)
  useEffect(() => {
    if (!firestore) return;
    if (!activeQrCodeId) {
      setCard(null);
      setIsLoadingCard(false);
      return;
    }

    setIsLoadingCard(true);
    setLookupError(null);

    const cardsRef = collection(firestore, 'cards');
    const q = query(cardsRef, where('qr_code_id', '==', activeQrCodeId), limit(5));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Filter strictly to Festa Novo Amanhecer 2026
        const matchingDocs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as CardType))
          .filter((c) => c.event_id === TARGET_EVENT_ID);

        if (matchingDocs.length > 0) {
          setCard(matchingDocs[0]);
          setIsLoadingCard(false);
          setMatchingCards(null);
        } else {
          setCard(null);
          setIsLoadingCard(false);
          setLookupError(
            'Não encontramos um cartão da Festa Novo Amanhecer 2026 com este código. Confira seu telefone abaixo ou leia o QR Code do seu papel.'
          );
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_CARD_KEY);
            localStorage.removeItem(STORAGE_AUTH_MODE_KEY);
          }
          setActiveQrCodeId('');
        }
      },
      (err) => {
        console.error('Error subscribing to card:', err);
        setIsLoadingCard(false);
        setLookupError('Erro de conexão ao carregar o cartão. Tente novamente.');
      }
    );

    return () => unsubscribe();
  }, [firestore, activeQrCodeId]);

  // 4. Subscribe in real-time to the card's transactions
  useEffect(() => {
    if (!firestore || !card?.id) {
      setTransactions([]);
      return;
    }

    const txRef = collection(firestore, 'transactions');
    const q = query(txRef, where('cartao_id', '==', card.id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Transaction))
          .sort((a, b) => toDate(b.created_at).getTime() - toDate(a.created_at).getTime());
        setTransactions(list);
      },
      (err) => {
        console.error('Error loading card transactions:', err);
      }
    );

    return () => unsubscribe();
  }, [firestore, card?.id]);

  // 5. Subscribe in real-time to active orders in Festa Novo Amanhecer 2026
  useEffect(() => {
    if (!firestore || !card?.id) {
      setAllActiveOrders([]);
      initialOrdersLoadedRef.current = false;
      return;
    }

    const ordersRef = collection(firestore, 'orders');
    const q = query(
      ordersRef,
      where('status', 'in', ['PENDENTE', 'EM_PREPARO', 'PRONTO'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Order))
          .filter((o) => !o.event_id || o.event_id === TARGET_EVENT_ID);
        setAllActiveOrders(fetched);
      },
      (err) => {
        console.error('Error loading active orders for customer wallet:', err);
      }
    );

    return () => unsubscribe();
  }, [firestore, card?.id]);

  // 5b. Auto-check any pending online recharges for this card on load & when returning from banking app
  useEffect(() => {
    if (!firestore || !card?.id) return;

    const checkPendingOnlineRecharges = async () => {
      try {
        const rechargesRef = collection(firestore, 'online_recharges');
        const qPending = query(
          rechargesRef,
          where('cartao_id', '==', card.id),
          where('status', '==', 'PENDING')
        );
        const snap = await getDocs(qPending);
        if (snap.empty) return;

        for (const docSnap of snap.docs) {
          const paymentId = docSnap.id;
          await fetch(`/api/asaas/recharge/status?id=${encodeURIComponent(paymentId)}`, {
            cache: 'no-store',
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Erro ao verificar recargas online pendentes:', err);
      }
    };

    checkPendingOnlineRecharges();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkPendingOnlineRecharges();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [firestore, card?.id]);

  // Compute the set of transaction IDs belonging to this customer (compatible with Day 1 orders)
  const customerTxIds = useMemo(() => {
    return new Set(transactions.map((t) => t.id));
  }, [transactions]);

  // Filter and enrich the customer's active orders with queue position & wait time
  const myActiveOrders = useMemo(() => {
    if (!card) return [];

    const matching = allActiveOrders.filter(
      (o) =>
        o.cartao_id === card.id ||
        (o.qr_code_id && o.qr_code_id === card.qr_code_id) ||
        (o.transaction_id && customerTxIds.has(o.transaction_id))
    );

    return matching
      .map((myOrder) => {
        const pdv = pdvMap[myOrder.pdv_id];
        const category = detectBoothCategory(pdv?.nome || myOrder.pdv_nome, pdv?.icon);

        if (myOrder.status === 'PRONTO') {
          return {
            order: myOrder,
            status: 'PRONTO' as const,
            position: 0,
            estimate: { time: 'Pronto agora!', info: 'Pode retirar no balcão da barraca' },
          };
        }

        // Compute queue position in this specific PDV (FIFO)
        const pdvInPrep = allActiveOrders
          .filter(
            (o) =>
              o.pdv_id === myOrder.pdv_id &&
              (o.status === 'PENDENTE' || o.status === 'EM_PREPARO')
          )
          .sort((a, b) => toDate(a.created_at).getTime() - toDate(b.created_at).getTime());

        const idx = pdvInPrep.findIndex((o) => o.id === myOrder.id);
        const position = idx >= 0 ? idx + 1 : 1;

        let slotsAhead = 0;
        for (let i = 0; i < idx; i++) {
          const ord = pdvInPrep[i];
          if (Array.isArray(ord.items)) {
            ord.items.forEach((it) => {
              if (it.requer_preparo === false) return;
              slotsAhead += getItemSlots(it, category).slots;
            });
          }
        }

        const estimate = calculateCustomerWaitEstimate(
          category,
          Math.max(0, idx),
          slotsAhead
        );

        return {
          order: myOrder,
          status: 'EM_PREPARO' as const,
          position,
          estimate,
        };
      })
      .sort((a, b) => {
        if (a.status === 'PRONTO' && b.status !== 'PRONTO') return -1;
        if (a.status !== 'PRONTO' && b.status === 'PRONTO') return 1;
        return toDate(b.order.created_at).getTime() - toDate(a.order.created_at).getTime();
      });
  }, [card, allActiveOrders, customerTxIds, pdvMap]);

  // Trigger audio chime + voice announcement when an order becomes READY
  useEffect(() => {
    if (!card || myActiveOrders.length === 0) return;

    const readyOrders = myActiveOrders.filter((item) => item.status === 'PRONTO');

    if (!initialOrdersLoadedRef.current) {
      if (readyOrders.length > 0 && soundEnabled) {
        const firstReady = readyOrders[0].order;
        announcedReadyOrderIdsRef.current.add(firstReady.id);
        soundPlayer.announceOrderReady(firstReady.pdv_nome, firstReady.order_number, true);
      }
      readyOrders.forEach((r) => announcedReadyOrderIdsRef.current.add(r.order.id));
      initialOrdersLoadedRef.current = true;
      return;
    }

    readyOrders.forEach(({ order }) => {
      if (!announcedReadyOrderIdsRef.current.has(order.id)) {
        announcedReadyOrderIdsRef.current.add(order.id);
        if (soundEnabled) {
          soundPlayer.announceOrderReady(order.pdv_nome, order.order_number, true);
        }
      }
    });
  }, [myActiveOrders, card, soundEnabled]);

  // Select a card with explicit security mode ('QR_VERIFIED' vs 'PHONE_ONLY')
  const handleSelectCard = (qrCodeId: string, mode: CustomerAuthMode) => {
    const clean = extractCardQrCode(qrCodeId);
    if (!clean) return;
    setLookupError(null);
    setMatchingCards(null);
    setAuthMode(mode);
    if (mode === 'PHONE_ONLY') {
      setShowQrModal(false);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CARD_KEY, clean);
      localStorage.setItem(STORAGE_AUTH_MODE_KEY, mode);
    }
    setActiveQrCodeId(clean);
  };

  // Switch / Logout current card
  const handleSwitchCard = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_CARD_KEY);
      localStorage.removeItem(STORAGE_AUTH_MODE_KEY);
    }
    setActiveQrCodeId('');
    setAuthMode('PHONE_ONLY');
    setShowQrModal(false);
    setCard(null);
    setTransactions([]);
    setMatchingCards(null);
    setLookupError(null);
    announcedReadyOrderIdsRef.current.clear();
    initialOrdersLoadedRef.current = false;
  };

  // Search card by customer's phone number — strictly within Festa Novo Amanhecer 2026!
  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    const rawDigits = phoneInput.replace(/\D/g, '');
    if (rawDigits.length < 8) {
      setLookupError('Por favor, digite seu telefone com DDD (ex: 21 99999-8888).');
      return;
    }

    setIsSearchingPhone(true);
    setLookupError(null);
    setMatchingCards(null);

    try {
      const normalized = formatWhatsAppNumber(rawDigits);
      const last8 = rawDigits.slice(-8);
      const cardsRef = collection(firestore, 'cards');

      // Query ONLY cards belonging to Festa Novo Amanhecer 2026 (TARGET_EVENT_ID)
      const qEventCards = query(cardsRef, where('event_id', '==', TARGET_EVENT_ID));
      const snapEventCards = await getDocs(qEventCards);

      const allEventCards = snapEventCards.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CardType)
      );

      // Match by exact normalized phone OR last 8 digits
      const found = allEventCards.filter((c) => {
        if (!c.telefone_cliente) return false;
        if (c.telefone_cliente === normalized) return true;
        const cDigits = c.telefone_cliente.replace(/\D/g, '');
        return cDigits.length >= 8 && cDigits.endsWith(last8);
      });

      // Filter active cards first, sorted by newest
      const activeFound = found
        .filter((c) => c.status === 'ATIVO')
        .sort((a, b) => toDate(b.created_at).getTime() - toDate(a.created_at).getTime());

      const listToUse = activeFound.length > 0 ? activeFound : found;

      if (listToUse.length === 0) {
        setLookupError(
          'Nenhum cartão da Festa Novo Amanhecer 2026 foi encontrado com este telefone. Confira o número ou clique em "Ler QR Code do Meu Papel".'
        );
      } else if (listToUse.length === 1) {
        // Phone lookup sets mode to PHONE_ONLY (hides QR code for security)
        handleSelectCard(listToUse[0].qr_code_id, 'PHONE_ONLY');
      } else {
        setMatchingCards(listToUse);
      }
    } catch (err) {
      console.error('Error searching card by phone:', err);
      setLookupError('Não foi possível buscar seu cartão agora. Tente novamente.');
    } finally {
      setIsSearchingPhone(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-purple-600 selection:text-white ${
        largeFont ? 'text-lg' : 'text-base'
      }`}
    >
      {/* =================================================================== */}
      {/* STICKY HEADER: CLEAR BRANDING + "A+ LETRA MAIOR" + SOUND TOGGLE     */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-xs px-3 sm:px-5 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-purple-700 text-white font-black flex items-center justify-center text-base shrink-0 shadow-xs">
              FP
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900 leading-tight truncate text-sm sm:text-base">
                Festa Novo Amanhecer 2026
              </p>
              <p className="text-xs font-bold text-purple-700 truncate">
                Igreja Batista da Manhã • Meu Cartão
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Button to increase font size for elderly users */}
            <button
              type="button"
              onClick={toggleLargeFont}
              className={`px-3 py-2 rounded-xl border-2 font-black transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer ${
                largeFont
                  ? 'bg-purple-700 border-purple-800 text-white shadow-sm'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
              title="Aumentar tamanho das letras"
            >
              <ZoomIn className="h-4 w-4 shrink-0" />
              <span>{largeFont ? 'Letra Gigante: ON' : 'A+ Letra Maior'}</span>
            </button>

            {/* Sound & Voice toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className={`px-3 py-2 rounded-xl border-2 font-black transition-all flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                  : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
              title={soundEnabled ? 'Avisos sonoros ativados' : 'Ativar avisos sonoros'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-700 shrink-0" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-500 shrink-0" />
              )}
              <span className="hidden xs:inline">{soundEnabled ? 'Som Ativo' : 'Sem Som'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* MAIN CONTAINER                                                      */}
      {/* =================================================================== */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-3.5 sm:p-6 space-y-5">
        {/* LOADING STATE */}
        {isLoadingCard && (
          <div className="bg-white rounded-3xl border-2 border-slate-200 p-10 text-center space-y-4 shadow-sm my-6">
            <Loader2 className="h-12 w-12 animate-spin text-purple-700 mx-auto" />
            <p className={`font-extrabold text-slate-800 ${largeFont ? 'text-2xl' : 'text-xl'}`}>
              Abrindo o seu cartão...
            </p>
            <p className="text-slate-600 text-sm">Só um instante, buscando seu saldo e pedidos.</p>
          </div>
        )}

        {/* ================================================================= */}
        {/* SCREEN 1: NO CARD SELECTED YET -> ZERO-FRICTION ENTRY             */}
        {/* ================================================================= */}
        {!isLoadingCard && !card && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border-2 border-slate-300 p-5 sm:p-7 shadow-md space-y-5">
              <div className="text-center space-y-2">
                <div className="inline-flex h-16 w-16 rounded-2xl bg-purple-100 text-purple-800 items-center justify-center border-2 border-purple-200 mx-auto">
                  <Wallet className="h-9 w-9" />
                </div>
                <span className="block text-xs font-black uppercase tracking-wider text-purple-700">
                  Festa Novo Amanhecer 2026 • Igreja Batista da Manhã
                </span>
                <h1
                  className={`font-black text-slate-900 tracking-tight leading-snug ${
                    largeFont ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                  }`}
                >
                  Consulte seu Saldo, Compras e Pedidos
                </h1>
                <p
                  className={`text-slate-700 font-medium max-w-md mx-auto leading-relaxed ${
                    largeFont ? 'text-lg' : 'text-base'
                  }`}
                >
                  Sem senha e sem complicação! Escolha uma das 2 opções abaixo para abrir seu cartão:
                </p>
              </div>

              {lookupError && (
                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-400 text-red-900 flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <p className={`font-bold leading-snug ${largeFont ? 'text-lg' : 'text-base'}`}>
                    {lookupError}
                  </p>
                </div>
              )}

              {/* IF MULTIPLE CARDS FOUND FOR THE SAME PHONE IN THIS EVENT */}
              {matchingCards && matchingCards.length > 1 && (
                <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-400 space-y-3">
                  <p
                    className={`font-black text-purple-950 ${
                      largeFont ? 'text-xl' : 'text-lg'
                    }`}
                  >
                    Encontramos {matchingCards.length} cartões da Festa 2026 neste telefone. Toque no seu:
                  </p>
                  <div className="space-y-2.5">
                    {matchingCards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCard(c.qr_code_id, 'PHONE_ONLY')}
                        className="w-full p-4 rounded-2xl bg-white hover:bg-purple-100 border-2 border-purple-300 flex items-center justify-between gap-3 text-left shadow-xs transition-all cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p
                            className={`font-black text-slate-900 truncate ${
                              largeFont ? 'text-xl' : 'text-lg'
                            }`}
                          >
                            {c.nome_cliente || 'Cartão sem nome'}
                          </p>
                          <p className="text-xs font-mono text-slate-600 mt-0.5">
                            {maskQrCodeId(c.qr_code_id)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-xs font-bold text-slate-600 uppercase">
                            Saldo
                          </span>
                          <span
                            className={`font-black text-emerald-700 ${
                              largeFont ? 'text-2xl' : 'text-xl'
                            }`}
                          >
                            {formatCurrency(c.saldo_centavos)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* OPTION 1: SCAN PAPER QR CODE (UNLOCKS EVERYTHING INCLUDING DIGITAL QR) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-3">
                <div className="flex items-center gap-2 text-emerald-950 font-black">
                  <span className="inline-flex h-7 w-7 rounded-full bg-emerald-700 text-white text-sm items-center justify-center font-black">
                    1
                  </span>
                  <span className={largeFont ? 'text-xl' : 'text-lg'}>
                    Tem o papel do cartão em mãos?
                  </span>
                </div>
                <p className={`text-emerald-900 font-medium ${largeFont ? 'text-base' : 'text-sm'}`}>
                  Toque no botão verde abaixo e aponte a câmera para o QR Code do seu papel (libera saldo, pedidos e o QR Code no celular):
                </p>
                <Button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className={`w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-md flex items-center justify-center gap-3 cursor-pointer ${
                    largeFont ? 'h-16 text-xl' : 'h-14 text-lg'
                  }`}
                >
                  <Camera className="h-7 w-7 shrink-0" />
                  <span>Ler QR Code do Meu Papel</span>
                </Button>
              </div>

              <div className="relative flex items-center justify-center py-1">
                <div className="border-t-2 border-slate-200 w-full" />
                <span className="bg-white px-4 text-xs font-black uppercase text-slate-500 tracking-wider">
                  OU
                </span>
                <div className="border-t-2 border-slate-200 w-full" />
              </div>

              {/* OPTION 2: ENTER PHONE NUMBER (VIEW BALANCE, ORDERS & STATEMENT ONLY) */}
              <form
                onSubmit={handlePhoneSearch}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-3.5"
              >
                <div className="flex items-center gap-2 text-slate-900 font-black">
                  <span className="inline-flex h-7 w-7 rounded-full bg-purple-700 text-white text-sm items-center justify-center font-black">
                    2
                  </span>
                  <label
                    htmlFor="customer-phone-input"
                    className={largeFont ? 'text-xl' : 'text-lg'}
                  >
                    Consultar pelo Telefone (WhatsApp):
                  </label>
                </div>

                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-purple-700 pointer-events-none" />
                  <input
                    id="customer-phone-input"
                    type="tel"
                    inputMode="numeric"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(formatPhoneMask(e.target.value))}
                    placeholder="(21) 99999-8888"
                    className={`w-full pl-12 pr-4 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-200 font-black text-slate-900 placeholder:text-slate-400 tracking-wide ${
                      largeFont ? 'h-16 text-2xl' : 'h-14 text-xl'
                    }`}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSearchingPhone}
                  className={`w-full rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    largeFont ? 'h-16 text-xl' : 'h-14 text-lg'
                  }`}
                >
                  {isSearchingPhone ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Procurando seu cartão...</span>
                    </>
                  ) : (
                    <>
                      <span>Ver Saldo, Extrato e Pedidos</span>
                      <ChevronRight className="h-6 w-6" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SCREEN 2: ACTIVE CARD DASHBOARD (SENIOR-FRIENDLY SINGLE SCREEN)   */}
        {/* ================================================================= */}
        {!isLoadingCard && card && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* ============================================================= */}
            {/* BLOCK 1: LIVE ORDERS AT THE VERY TOP (READY OR IN PREP)       */}
            {/* ============================================================= */}
            {myActiveOrders.length > 0 && (
              <section aria-label="Meus Pedidos em Andamento" className="space-y-3.5">
                {myActiveOrders.map(({ order, status, position, estimate }) => {
                  const isReady = status === 'PRONTO';

                  return (
                    <div
                      key={order.id}
                      className={`rounded-3xl p-5 sm:p-6 border-4 shadow-lg transition-all ${
                        isReady
                          ? 'bg-emerald-700 border-emerald-900 text-white ring-4 ring-emerald-400/60'
                          : 'bg-amber-50 border-amber-500 text-slate-900'
                      }`}
                    >
                      {/* Top Status Pill + Order Number */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <span
                          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-black uppercase tracking-wide ${
                            largeFont ? 'text-base' : 'text-sm'
                          } ${
                            isReady
                              ? 'bg-white text-emerald-950 shadow-sm'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isReady ? (
                            <>
                              <BellRing className="h-5 w-5 text-emerald-700 animate-bounce shrink-0" />
                              <span>🎉 SEU PEDIDO FICOU PRONTO!</span>
                            </>
                          ) : (
                            <>
                              <Flame className="h-5 w-5 text-slate-950 shrink-0" />
                              <span>⏳ PEDIDO EM PREPARO</span>
                            </>
                          )}
                        </span>

                        <span
                          className={`font-mono font-black px-3 py-1 rounded-xl ${
                            largeFont ? 'text-xl' : 'text-lg'
                          } ${
                            isReady
                              ? 'bg-emerald-900 text-white'
                              : 'bg-white border-2 border-amber-400 text-slate-900'
                          }`}
                        >
                          Senha {order.order_number}
                        </span>
                      </div>

                      {/* Booth Name in Giant Print */}
                      <div className="space-y-1">
                        <p
                          className={`font-bold uppercase tracking-wide ${
                            isReady ? 'text-emerald-100' : 'text-amber-900'
                          } ${largeFont ? 'text-base' : 'text-xs'}`}
                        >
                          {isReady ? 'Retire agora no balcão da barraca:' : 'Sendo preparado na barraca:'}
                        </p>
                        <h2
                          className={`font-black tracking-tight leading-tight flex items-center gap-2 ${
                            largeFont ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                          } ${isReady ? 'text-white' : 'text-slate-950'}`}
                        >
                          <Store className="h-7 w-7 shrink-0" />
                          <span>{order.pdv_nome}</span>
                        </h2>
                      </div>

                      {/* Instructions or Queue Position */}
                      {isReady ? (
                        <div className="mt-4 p-4 rounded-2xl bg-emerald-800/90 border-2 border-emerald-400 space-y-2">
                          <p
                            className={`font-black text-white flex items-center gap-2 ${
                              largeFont ? 'text-xl' : 'text-lg'
                            }`}
                          >
                            <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                            <span>Pode ir buscar no balcão!</span>
                          </p>
                          <p className={`text-emerald-100 font-medium ${largeFont ? 'text-lg' : 'text-sm'}`}>
                            Basta dizer seu nome (<strong>{order.cliente_nome}</strong>) ou mostrar a{' '}
                            <strong>Senha {order.order_number}</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              soundPlayer.announceOrderReady(
                                order.pdv_nome,
                                order.order_number,
                                true
                              )
                            }
                            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-emerald-950 font-black text-sm shadow-xs hover:bg-emerald-50 cursor-pointer"
                          >
                            <Volume2 className="h-4 w-4 text-emerald-700" />
                            <span>Ouvir Aviso Falado</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 p-4 rounded-2xl bg-white border-2 border-amber-300 space-y-1.5">
                          <p
                            className={`font-black text-slate-900 flex items-center gap-2 ${
                              largeFont ? 'text-xl' : 'text-lg'
                            }`}
                          >
                            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                            <span>
                              Posição na fila: <strong>{position}º da fila</strong>
                            </span>
                          </p>
                          <p className={`text-slate-700 font-semibold ${largeFont ? 'text-lg' : 'text-sm'}`}>
                            Tempo estimado: <strong className="text-slate-950">{estimate.time}</strong>
                          </p>
                          <p className="text-xs font-bold text-emerald-800 pt-1">
                            🔔 Fique tranquilo: esta tela vai ficar VERDE e tocar um aviso quando ficar pronto!
                          </p>
                        </div>
                      )}

                      {/* Order Items List */}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div
                          className={`mt-4 pt-3 border-t-2 ${
                            isReady ? 'border-emerald-600' : 'border-amber-300'
                          }`}
                        >
                          <p
                            className={`font-bold mb-1.5 ${
                              isReady ? 'text-emerald-100' : 'text-slate-700'
                            } ${largeFont ? 'text-base' : 'text-xs uppercase'}`}
                          >
                            Itens deste pedido:
                          </p>
                          <ul className="space-y-1">
                            {order.items.map((it, idx) => (
                              <li
                                key={idx}
                                className={`font-extrabold flex items-center justify-between gap-2 ${
                                  largeFont ? 'text-xl' : 'text-base'
                                } ${isReady ? 'text-white' : 'text-slate-900'}`}
                              >
                                <span>
                                  {it.quantity}x {it.name}
                                </span>
                                {it.observation && (
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                      isReady
                                        ? 'bg-emerald-900 text-emerald-100'
                                        : 'bg-amber-200 text-amber-950'
                                    }`}
                                  >
                                    {it.observation}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* ============================================================= */}
            {/* BLOCK 2: GIANT BALANCE CARD + SECURITY-GATED QR CODE          */}
            {/* ============================================================= */}
            <section
              aria-label="Meu Saldo e Cartão"
              className="bg-white rounded-3xl border-2 border-slate-300 p-5 sm:p-7 shadow-md space-y-5"
            >
              {/* Client Greeting & Live Status Badge */}
              <div className="flex items-start justify-between gap-3 border-b-2 border-slate-100 pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Titular do Cartão • Festa Novo Amanhecer 2026
                  </p>
                  <h1
                    className={`font-black text-slate-900 truncate mt-0.5 ${
                      largeFont ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                    }`}
                  >
                    {card.nome_cliente ? `Olá, ${card.nome_cliente}!` : 'Meu Cartão FestaPay'}
                  </h1>
                  <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
                    {authMode === 'QR_VERIFIED' ? `ID: ${card.qr_code_id}` : maskQrCodeId(card.qr_code_id)}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-900 text-xs font-black shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                  Ao Vivo
                </span>
              </div>

              {/* Giant Balance Display */}
              <div className="p-5 sm:p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-center space-y-1">
                <p
                  className={`font-black uppercase tracking-wider text-emerald-900 ${
                    largeFont ? 'text-lg' : 'text-sm'
                  }`}
                >
                  Saldo Disponível no Cartão
                </p>
                <p
                  className={`font-black text-emerald-800 tracking-tight leading-none py-1 ${
                    largeFont ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'
                  }`}
                >
                  {formatCurrency(card.saldo_centavos)}
                </p>
                <p className={`text-emerald-900 font-semibold pt-1 ${largeFont ? 'text-base' : 'text-xs'}`}>
                  Atualizado automaticamente a cada compra ou recarga
                </p>
              </div>

              {/* ONLINE RECHARGE CTA BUTTON (ASAAS PIX OR CARD 1X) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 space-y-2.5 text-center shadow-xs">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-900">
                  <Sparkles className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>Evite Filas no Caixa • PIX ou Cartão 1x</span>
                </div>
                <Button
                  type="button"
                  onClick={() => setIsOnlineRechargeOpen(true)}
                  className={`w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-md flex items-center justify-center gap-2.5 cursor-pointer ${
                    largeFont ? 'h-16 text-xl' : 'h-14 text-lg'
                  }`}
                >
                  <PlusCircle className="h-6 w-6 shrink-0" />
                  <span>Recarregue Online o seu Cartão</span>
                </Button>
                <p className="text-[11px] font-bold text-emerald-900">
                  Pague pelo celular via PIX ou Cartão (1x) e o saldo entra na hora (+ taxa da operadora)
                </p>
              </div>

              {/* QR CODE SECTION: ONLY DISPLAYED IF VERIFIED BY SCANNING THE PHYSICAL PAPER QR */}
              {authMode === 'QR_VERIFIED' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Cartão verificado pela leitura do QR Code físico</span>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setShowQrModal(!showQrModal)}
                    className={`w-full rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black shadow-md flex items-center justify-center gap-3 cursor-pointer ${
                      largeFont ? 'h-16 text-xl' : 'h-14 text-lg'
                    }`}
                  >
                    <QrCode className="h-7 w-7 shrink-0" />
                    <span>
                      {showQrModal
                        ? 'Esconder QR Code de Pagamento'
                        : 'Mostrar QR Code para Pagar / Recarregar'}
                    </span>
                  </Button>

                  {showQrModal && (
                    <div className="p-6 rounded-3xl bg-white border-4 border-purple-700 text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
                      <div className="space-y-1">
                        <p className={`font-black text-slate-900 ${largeFont ? 'text-2xl' : 'text-xl'}`}>
                          Mostre este código na Barraca ou no Caixa
                        </p>
                        <p className="text-sm font-medium text-slate-600">
                          Você pode pagar usando este QR Code na tela ou usando o seu cartão de papel!
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 inline-block mx-auto shadow-xs">
                        <QRCode value={card.qr_code_id} size={220} level="M" />
                      </div>

                      <div className="space-y-1">
                        <p className="font-mono font-black text-base text-slate-800 bg-slate-100 py-1.5 px-3 rounded-xl inline-block">
                          {card.qr_code_id}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowQrModal(false)}
                        className="w-full h-12 rounded-xl border-2 border-slate-300 font-bold text-slate-700"
                      >
                        Fechar QR Code
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* PHONE_ONLY MODE: QR CODE IS PROTECTED UNTIL PHYSICAL PAPER IS SCANNED */
                <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-300 space-y-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-slate-800 font-black">
                    <Lock className="h-5 w-5 text-purple-700 shrink-0" />
                    <span className={largeFont ? 'text-lg' : 'text-sm'}>
                      QR Code de pagamento protegido por segurança
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    Como você entrou apenas pelo número de telefone, o QR Code para compras fica oculto para sua proteção. Para liberar o QR Code no celular, leia uma vez o QR Code do seu papel:
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full h-12 rounded-xl border-2 border-purple-700 text-purple-800 hover:bg-purple-50 font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="h-5 w-5 shrink-0" />
                    <span>Ler QR Code do Papel para Liberar</span>
                  </Button>
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* BLOCK 3: CLEAR STATEMENT (PURCHASES & RECHARGES HISTORY)      */}
            {/* ============================================================= */}
            <section
              aria-label="Histórico de Compras e Recargas"
              className="bg-white rounded-3xl border-2 border-slate-300 p-5 sm:p-7 shadow-md space-y-4"
            >
              <div className="flex items-center justify-between gap-2 border-b-2 border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      className={`font-black text-slate-900 leading-tight ${
                        largeFont ? 'text-2xl' : 'text-xl'
                      }`}
                    >
                      Minhas Compras e Recargas
                    </h2>
                    <p className="text-xs font-semibold text-slate-600">
                      Tudo o que entrou e saiu do seu cartão
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black bg-slate-100 border border-slate-300 text-slate-800 px-2.5 py-1 rounded-full">
                  {transactions.length} {transactions.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-slate-600">
                  <p className={`font-bold ${largeFont ? 'text-xl' : 'text-base'}`}>
                    Nenhuma movimentação registrada ainda.
                  </p>
                  <p className="text-sm">
                    Suas recargas e compras nas barracas aparecerão aqui na mesma hora!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const isPositive =
                      tx.tipo === 'RECARGA' ||
                      tx.tipo === 'REEMBOLSO' ||
                      tx.tipo === 'TRANSFER_IN';

                    const pdvName =
                      tx.pdv_id === 'caixa_central'
                        ? 'Caixa Central'
                        : pdvMap[tx.pdv_id]?.nome || 'Barraca da Festa';

                    let title = '';
                    let IconComponent = ShoppingBag;
                    let badgeColors = '';

                    if (tx.tipo === 'RECARGA') {
                      title =
                        tx.usuario_responsavel &&
                        tx.usuario_responsavel.toLowerCase().includes('recarga online')
                          ? tx.usuario_responsavel
                          : 'Recarga no Caixa';
                      IconComponent = PlusCircle;
                      badgeColors = 'bg-emerald-100 text-emerald-900 border-emerald-400';
                    } else if (tx.tipo === 'VENDA') {
                      title = `Compra: ${pdvName}`;
                      IconComponent = ShoppingBag;
                      badgeColors = 'bg-slate-100 text-slate-900 border-slate-300';
                    } else if (tx.tipo === 'REEMBOLSO') {
                      title = 'Valor Estornado / Devolvido';
                      IconComponent = RotateCcw;
                      badgeColors = 'bg-blue-100 text-blue-900 border-blue-400';
                    } else if (tx.tipo === 'TRANSFER_IN') {
                      title = 'Saldo Recebido de Outro Cartão';
                      IconComponent = ArrowRightLeft;
                      badgeColors = 'bg-emerald-100 text-emerald-900 border-emerald-400';
                    } else {
                      title = 'Saldo Transferido para Outro Cartão';
                      IconComponent = ArrowRightLeft;
                      badgeColors = 'bg-amber-100 text-amber-900 border-amber-400';
                    }

                    return (
                      <div
                        key={tx.id}
                        className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${badgeColors}`}
                            >
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3
                                className={`font-black text-slate-900 leading-snug ${
                                  largeFont ? 'text-xl' : 'text-base sm:text-lg'
                                }`}
                              >
                                {title}
                              </h3>
                              <p className="text-xs font-bold text-slate-500 mt-0.5">
                                {formatFriendlyTime(tx.created_at)}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`font-black shrink-0 text-right ${
                              largeFont ? 'text-2xl' : 'text-lg sm:text-xl'
                            } ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}
                          >
                            {isPositive ? '+ ' : '- '}
                            {formatCurrency(tx.valor_centavos)}
                          </div>
                        </div>

                        {/* Purchased Items Detail */}
                        {Array.isArray(tx.items) && tx.items.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-200 pl-1">
                            <p className="text-xs font-bold uppercase text-slate-500 mb-1">
                              Itens comprados:
                            </p>
                            <ul className="space-y-1">
                              {tx.items.map((item, idx) => (
                                <li
                                  key={idx}
                                  className={`flex items-center justify-between text-slate-800 font-bold ${
                                    largeFont ? 'text-lg' : 'text-sm'
                                  }`}
                                >
                                  <span>
                                    • <strong>{item.quantity}x</strong> {item.name}
                                  </span>
                                  <span className="text-slate-600 font-semibold">
                                    {formatCurrency(item.price * item.quantity)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* FOOTER ACTIONS: VIEW ALL BOOTHS OR SWITCH CARD                */}
            {/* ============================================================= */}
            <div className="pt-2 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto h-12 rounded-2xl border-2 border-slate-300 bg-white text-slate-800 font-extrabold px-5"
              >
                <Link href="/igreja-batista-da-manha/pedidos">
                  <Store className="h-4 w-4 mr-2 text-purple-700" />
                  <span>Ver Filas de Todas as Barracas</span>
                </Link>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleSwitchCard}
                className="w-full sm:w-auto h-12 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-bold px-4 cursor-pointer"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span>Consultar Outro Cartão</span>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Scanner Dialog: Physical scan unlocks QR_VERIFIED mode! */}
      <QrScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={(scannedCode) => {
          handleSelectCard(scannedCode, 'QR_VERIFIED');
        }}
      />

      {/* Online Recharge Dialog (Asaas PIX or Card 1x) */}
      {card && (
        <OnlineRechargeDialog
          open={isOnlineRechargeOpen}
          onOpenChange={setIsOnlineRechargeOpen}
          card={card}
          largeFont={largeFont}
          soundEnabled={soundEnabled}
        />
      )}
    </div>
  );
}
