'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Card as CardType } from '@/lib/definitions';
import { formatCurrency, calculateAsaasRechargeFee } from '@/lib/utils';
import { formatWhatsAppNumber } from '@/lib/whatsapp';
import { soundPlayer } from '@/lib/audio';
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  User,
  Phone,
  Wallet,
} from 'lucide-react';

const TARGET_EVENT_ID = 'DoKmbiQ8pd3M71yTC9iA';
const STORAGE_CPF_KEY = 'festapay_customer_cpf';
const STORAGE_CARD_KEY = 'festapay_customer_card_qr_2026';
const STORAGE_AUTH_MODE_KEY = 'festapay_customer_auth_mode_2026';
const STORAGE_AUTO_OPEN_QR_KEY = 'festapay_auto_open_qr_modal';
export const STORAGE_PENDING_CREATE_CARD_KEY = 'festapay_pending_create_card_payment';

interface CreateOnlineCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  largeFont?: boolean;
  soundEnabled?: boolean;
  onOpenExistingCard?: (qrCodeId: string) => void;
}

interface GeneratedCreateCardPayment {
  paymentId: string;
  cardId: string;
  qrCodeId: string;
  method: 'PIX' | 'CARD';
  netAmountCents: number;
  feeCents: number;
  totalChargedCents: number;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  invoiceUrl: string | null;
}

const PRESET_AMOUNTS = [20, 30, 50, 100];

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

function formatCpfCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export default function CreateOnlineCardDialog({
  open,
  onOpenChange,
  largeFont = false,
  soundEnabled = true,
  onOpenExistingCard,
}: CreateOnlineCardDialogProps) {
  const router = useRouter();
  const firestore = useFirestore();

  const [step, setStep] = useState<'FORM' | 'EXISTING_WARNING' | 'PAYMENT'>('FORM');
  const [customerName, setCustomerName] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [cpfInput, setCpfInput] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(50);
  const [customAmountStr, setCustomAmountStr] = useState<string>('50');
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');

  const [existingCardsForPhone, setExistingCardsForPhone] = useState<CardType[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<GeneratedCreateCardPayment | null>(null);

  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);

  const hasRedirectedRef = useRef<boolean>(false);

  // Load saved CPF on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCpf = localStorage.getItem(STORAGE_CPF_KEY);
    if (savedCpf) {
      setCpfInput(formatCpfCnpjMask(savedCpf));
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setCopiedPix(false);
    }
  }, [open]);

  // Parse net amount & exact Asaas fee
  const parsedReais = Number(customAmountStr.replace(',', '.')) || 0;
  const rawNetCents = Math.max(0, Math.round(parsedReais * 100));
  const { netCents, feeCents, totalChargedCents, feeLabel } = calculateAsaasRechargeFee(
    rawNetCents,
    method
  );

  const handleSelectPreset = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmountStr(String(amount));
    setErrorMsg(null);
  };

  const handleCustomAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.,]/g, '');
    setCustomAmountStr(cleaned);
    const num = Number(cleaned.replace(',', '.'));
    if (PRESET_AMOUNTS.includes(num)) {
      setSelectedPreset(num);
    } else {
      setSelectedPreset(null);
    }
    setErrorMsg(null);
  };

  const finalizeAndRedirectToCard = useCallback(
    (qrCodeId: string) => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_CARD_KEY, qrCodeId);
        localStorage.setItem(STORAGE_AUTH_MODE_KEY, 'QR_VERIFIED');
        localStorage.setItem(STORAGE_AUTO_OPEN_QR_KEY, 'true');
        localStorage.removeItem(STORAGE_PENDING_CREATE_CARD_KEY);
      }

      if (soundEnabled) {
        soundPlayer.playReadyChime();
      }

      onOpenChange(false);
      router.push(`/c/${encodeURIComponent(qrCodeId)}`);
    },
    [onOpenChange, router, soundEnabled]
  );

  const checkPaymentStatus = useCallback(
    async (paymentId: string, fallbackQrCodeId: string, manualClick = false) => {
      if (!paymentId) return;
      if (manualClick) {
        setIsCheckingStatus(true);
        setErrorMsg(null);
      }

      try {
        const res = await fetch(`/api/asaas/recharge/status?id=${encodeURIComponent(paymentId)}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (res.ok && data.credited) {
          const targetQr = data.qrCodeId || fallbackQrCodeId;
          if (targetQr) {
            finalizeAndRedirectToCard(targetQr);
            return;
          }
        }

        if (manualClick) {
          setErrorMsg(
            'Ainda aguardando a confirmação do banco (geralmente leva de 3 a 10 segundos após o pagamento). Assim que confirmar, seu cartão abrirá sozinho na tela!'
          );
        }
      } catch (err) {
        console.warn('Erro ao consultar status do novo cartão:', err);
      } finally {
        if (manualClick) {
          setIsCheckingStatus(false);
        }
      }
    },
    [finalizeAndRedirectToCard]
  );

  // Automatic polling every 3s while in PAYMENT step + check immediately when user returns from banking app
  useEffect(() => {
    if (!open || step !== 'PAYMENT' || !paymentData?.paymentId) return;

    const pid = paymentData.paymentId;
    const qid = paymentData.qrCodeId;

    const intervalId = setInterval(() => {
      checkPaymentStatus(pid, qid, false);
    }, 3000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkPaymentStatus(pid, qid, false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [open, step, paymentData?.paymentId, paymentData?.qrCodeId, checkPaymentStatus]);

  const executeCreateCardPayment = async () => {
    setErrorMsg(null);
    setIsGenerating(true);
    hasRedirectedRef.current = false;

    const cleanCpf = cpfInput.replace(/\D/g, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CPF_KEY, cleanCpf);
    }

    try {
      const response = await fetch('/api/asaas/create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          phone: phoneInput,
          cpfCnpj: cleanCpf,
          initialAmountReais: parsedReais,
          method,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(
          data.error || 'Não foi possível gerar o pagamento. Confira seus dados e tente novamente.'
        );
        setStep('FORM');
        return;
      }

      const generated: GeneratedCreateCardPayment = {
        paymentId: data.paymentId,
        cardId: data.cardId,
        qrCodeId: data.qrCodeId,
        method: data.method,
        netAmountCents: data.netAmountCents,
        feeCents: data.feeCents,
        totalChargedCents: data.totalChargedCents,
        pixQrCodeBase64: data.pixQrCodeBase64,
        pixCopyPaste: data.pixCopyPaste,
        invoiceUrl: data.invoiceUrl,
      };

      setPaymentData(generated);
      setStep('PAYMENT');

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          STORAGE_PENDING_CREATE_CARD_KEY,
          JSON.stringify({
            paymentId: generated.paymentId,
            qrCodeId: generated.qrCodeId,
            cardId: generated.cardId,
            createdAt: Date.now(),
          })
        );
      }
    } catch (err) {
      console.error('Erro ao criar cartão online:', err);
      setErrorMsg('Erro de conexão ao gerar o cartão. Tente novamente.');
      setStep('FORM');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (customerName.trim().length < 2) {
      setErrorMsg('Por favor, digite seu nome completo.');
      return;
    }

    const rawPhoneDigits = phoneInput.replace(/\D/g, '');
    if (rawPhoneDigits.length < 10) {
      setErrorMsg('Por favor, digite seu celular com DDD (ex: 21 99999-8888).');
      return;
    }

    const cleanCpf = cpfInput.replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      setErrorMsg('Por favor, digite seu CPF (11 números) para emitir o pagamento.');
      return;
    }

    if (parsedReais < 5) {
      setErrorMsg('O saldo inicial mínimo para criar o cartão é de R$ 5,00.');
      return;
    }

    // Check if there is already an active card for this phone in Festa Novo Amanhecer 2026
    if (firestore) {
      setIsGenerating(true);
      try {
        const normalized = formatWhatsAppNumber(rawPhoneDigits);
        const last8 = rawPhoneDigits.slice(-8);
        const qEventCards = query(
          collection(firestore, 'cards'),
          where('event_id', '==', TARGET_EVENT_ID)
        );
        const snap = await getDocs(qEventCards);
        const found = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CardType))
          .filter((c) => {
            if (c.status !== 'ATIVO' || !c.telefone_cliente) return false;
            if (c.telefone_cliente === normalized) return true;
            const cDigits = c.telefone_cliente.replace(/\D/g, '');
            return cDigits.length >= 8 && cDigits.endsWith(last8);
          });

        if (found.length > 0) {
          setExistingCardsForPhone(found);
          setStep('EXISTING_WARNING');
          setIsGenerating(false);
          return;
        }
      } catch (err) {
        console.warn('Aviso ao verificar telefone existente:', err);
      }
    }

    await executeCreateCardPayment();
  };

  const handleCopyPix = async () => {
    if (!paymentData?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 5000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = paymentData.pixCopyPaste;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 5000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 bg-white border-2 border-slate-300 text-slate-900">
        <DialogHeader className="text-left space-y-1 border-b-2 border-slate-100 pb-3">
          <DialogTitle
            className={`font-black text-slate-900 flex items-center gap-2 ${
              largeFont ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
            }`}
          >
            <Sparkles className="h-6 w-6 text-purple-700 shrink-0" />
            <span>Criar Meu Cartão Digital</span>
          </DialogTitle>
          <DialogDescription className="text-slate-600 font-semibold text-sm">
            Festa Novo Amanhecer 2026 • Crie seu cartão pelo celular e compre direto nas barracas sem fila!
          </DialogDescription>
        </DialogHeader>

        {/* ================================================================= */}
        {/* STEP 1: CUSTOMER INFO + INITIAL AMOUNT + PAYMENT METHOD           */}
        {/* ================================================================= */}
        {step === 'FORM' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-1">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-400 text-red-900 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold leading-snug">{errorMsg}</p>
              </div>
            )}

            {/* 1. Dados do Titular */}
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="new-card-name"
                  className="block font-black text-slate-900 text-sm mb-1"
                >
                  1. Seu Nome e Sobrenome:
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-700 pointer-events-none" />
                  <input
                    id="new-card-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Maria Oliveira"
                    required
                    className="w-full pl-11 pr-4 h-12 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-card-phone"
                    className="block font-black text-slate-900 text-sm mb-1"
                  >
                    2. Seu Celular (com DDD):
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-700 pointer-events-none" />
                    <input
                      id="new-card-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(formatPhoneMask(e.target.value))}
                      placeholder="(21) 99999-8888"
                      required
                      className="w-full pl-11 pr-3 h-12 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 text-base"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-card-cpf"
                    className="block font-black text-slate-900 text-sm mb-1"
                  >
                    3. Seu CPF:
                  </label>
                  <input
                    id="new-card-cpf"
                    type="tel"
                    inputMode="numeric"
                    value={cpfInput}
                    onChange={(e) => setCpfInput(formatCpfCnpjMask(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                    className="w-full px-3.5 h-12 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 text-base"
                  />
                </div>
              </div>
            </div>

            {/* 2. Saldo Inicial */}
            <div className="space-y-2">
              <label
                htmlFor="new-card-amount"
                className="block font-black text-slate-900 text-sm"
              >
                4. Quanto de saldo inicial você quer colocar no cartão?
              </label>

              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-2.5 px-2 rounded-2xl border-2 font-black transition-all cursor-pointer text-base ${
                        isSelected
                          ? 'bg-purple-700 border-purple-900 text-white shadow-sm scale-[1.02]'
                          : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-purple-50'
                      }`}
                    >
                      R$ {amt}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-500 text-lg">
                  R$
                </span>
                <input
                  id="new-card-amount"
                  type="number"
                  inputMode="decimal"
                  min={5}
                  max={2000}
                  step="1"
                  value={customAmountStr}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="Outro valor (ex: 40)"
                  className="w-full pl-12 pr-4 h-12 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 text-xl"
                />
              </div>
            </div>

            {/* 3. Escolha como pagar: PIX ou Cartão 1x */}
            <div className="space-y-2">
              <span className="block font-black text-slate-900 text-sm">
                5. Como você prefere pagar?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('PIX')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    method === 'PIX'
                      ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/30'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      method === 'PIX'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-tight">
                      PIX (Na Hora)
                    </p>
                    <p className="text-xs font-bold text-emerald-800">
                      Taxa fixa: R$ 1,99
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('CARD')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    method === 'CARD'
                      ? 'bg-purple-50 border-purple-700 ring-2 ring-purple-500/30'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      method === 'CARD'
                        ? 'bg-purple-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-tight">
                      Cartão (1x à vista)
                    </p>
                    <p className="text-xs font-bold text-purple-800">
                      Taxa: 2,99% + R$ 0,49
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. EXPLICIT ASAAS FEE BREAKDOWN BOX */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-1.5">
              <div className="flex items-center justify-between text-slate-800 font-bold text-sm">
                <span>Saldo inicial que entra no cartão:</span>
                <span className="font-black text-emerald-800">
                  {formatCurrency(netCents)}
                </span>
              </div>

              <div className="flex items-center justify-between text-amber-950 font-bold text-xs">
                <span>{feeLabel}:</span>
                <span className="font-black">+ {formatCurrency(feeCents)}</span>
              </div>

              <div className="border-t-2 border-amber-300 pt-1.5 flex items-center justify-between text-slate-950">
                <span className="font-black text-sm uppercase">
                  Total a pagar agora:
                </span>
                <span className="font-black text-purple-900 text-xl">
                  {formatCurrency(totalChargedCents)}
                </span>
              </div>

              <p className="text-[11px] font-semibold text-amber-900 leading-tight pt-0.5">
                * Assim que o pagamento confirmar, seu Cartão Digital abrirá automaticamente na tela com o QR Code liberado para comprar nas barracas!
              </p>
            </div>

            <Button
              type="submit"
              disabled={isGenerating || netCents < 500}
              className="w-full h-14 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-base sm:text-lg shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Preparando seu cartão digital...</span>
                </>
              ) : (
                <span>
                  Pagar {formatCurrency(totalChargedCents)} e Criar Cartão
                </span>
              )}
            </Button>
          </form>
        )}

        {/* ================================================================= */}
        {/* STEP 1B: EXISTING CARD WARNING FOR THIS PHONE NUMBER              */}
        {/* ================================================================= */}
        {step === 'EXISTING_WARNING' && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-500 space-y-2">
              <p className="font-black text-amber-950 text-base sm:text-lg flex items-center gap-2">
                <Wallet className="h-6 w-6 text-amber-700 shrink-0" />
                <span>Você já tem um cartão ativo na Festa 2026!</span>
              </p>
              <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-relaxed">
                Encontramos o cartão abaixo cadastrado com este telefone. Você prefere abrir seu cartão atual para recarregar ou criar um segundo cartão separado?
              </p>

              <div className="space-y-2 pt-1">
                {existingCardsForPhone.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-white border-2 border-amber-300 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-black text-slate-900 text-base">
                        {c.nome_cliente || 'Cartão sem nome'}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        Final ••••-{c.qr_code_id.slice(-4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-slate-500">
                        Saldo Atual
                      </span>
                      <span className="font-black text-emerald-700 text-lg">
                        {formatCurrency(c.saldo_centavos)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <Button
                type="button"
                onClick={() => {
                  const first = existingCardsForPhone[0];
                  if (first && onOpenExistingCard) {
                    onOpenChange(false);
                    onOpenExistingCard(first.qr_code_id);
                  }
                }}
                className="w-full h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base shadow-md cursor-pointer"
              >
                Abrir Meu Cartão Existente para Recarregar
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isGenerating}
                onClick={() => executeCreateCardPayment()}
                className="w-full h-12 rounded-2xl border-2 border-purple-700 text-purple-900 hover:bg-purple-50 font-black text-sm cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span>Gerando novo cartão...</span>
                  </>
                ) : (
                  <span>Quero criar um NOVO cartão separado mesmo assim</span>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('FORM')}
                className="w-full h-10 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: AWAITING PAYMENT -> AUTO-REDIRECT TO /c/[qr_code_id]      */}
        {/* ================================================================= */}
        {step === 'PAYMENT' && paymentData && (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Saldo inicial do cartão:
                </p>
                <p className="text-lg font-black text-emerald-800">
                  {formatCurrency(paymentData.netAmountCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Total com taxa da operadora:
                </p>
                <p className="text-lg font-black text-slate-900">
                  {formatCurrency(paymentData.totalChargedCents)}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-bold leading-snug">{errorMsg}</p>
              </div>
            )}

            {paymentData.method === 'PIX' ? (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-left space-y-2">
                  <p className="font-black text-emerald-950 text-sm sm:text-base">
                    📱 Pague o PIX para ativar seu Cartão Digital:
                  </p>
                  <ol className="text-xs sm:text-sm font-bold text-emerald-900 space-y-1 list-decimal list-inside">
                    <li>Toque no botão verde abaixo para copiar o código PIX;</li>
                    <li>Abra o app do seu banco em &ldquo;Pix Copia e Cola&rdquo; e pague;</li>
                    <li>Volte para esta tela: seu Cartão Digital abrirá sozinho na hora!</li>
                  </ol>

                  <Button
                    type="button"
                    onClick={handleCopyPix}
                    className={`w-full mt-2 h-14 rounded-2xl font-black text-base shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                      copiedPix
                        ? 'bg-emerald-900 text-white'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                  >
                    {copiedPix ? (
                      <>
                        <Check className="h-6 w-6 shrink-0" />
                        <span>CÓDIGO PIX COPIADO! ABRA SEU BANCO</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-6 w-6 shrink-0" />
                        <span>COPIAR CÓDIGO PIX (COPIA E COLA)</span>
                      </>
                    )}
                  </Button>
                </div>

                {paymentData.pixQrCodeBase64 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-600">
                      Ou escaneie o QR Code abaixo com outro celular:
                    </p>
                    <div className="inline-block p-3 bg-white rounded-2xl border-2 border-slate-300 shadow-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${paymentData.pixQrCodeBase64}`}
                        alt="QR Code PIX"
                        className="w-44 h-44 mx-auto object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-400 text-center space-y-3.5">
                <div className="inline-flex h-12 w-12 rounded-2xl bg-purple-700 text-white items-center justify-center mx-auto">
                  <CreditCard className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-purple-950 text-lg">
                    Pagamento com Cartão (1x à vista)
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-purple-900">
                    Toque no botão abaixo para pagar com Cartão (1x) no ambiente seguro do Asaas. Assim que concluir, volte para esta tela que seu Cartão Digital abrirá na hora!
                  </p>
                </div>

                {paymentData.invoiceUrl && (
                  <Button
                    asChild
                    className="w-full h-14 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-base shadow-md"
                  >
                    <a
                      href={paymentData.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>Abrir Pagamento Seguro de Cartão (1x)</span>
                      <ExternalLink className="h-5 w-5 ml-2" />
                    </a>
                  </Button>
                )}

                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-800">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Processado com segurança pelo Asaas (Banco Central)</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t-2 border-slate-200 space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700 shrink-0" />
                <span>Aguardando pagamento para abrir seu Cartão Digital...</span>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isCheckingStatus}
                onClick={() =>
                  checkPaymentStatus(paymentData.paymentId, paymentData.qrCodeId, true)
                }
                className="w-full h-12 rounded-2xl border-2 border-emerald-600 text-emerald-900 hover:bg-emerald-50 font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCheckingStatus ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Verificando pagamento...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-5 w-5" />
                    <span>Já paguei! Abrir meu Cartão Digital agora</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep('FORM');
                  setPaymentData(null);
                  setErrorMsg(null);
                }}
                className="w-full h-10 rounded-xl text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar e alterar dados</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
