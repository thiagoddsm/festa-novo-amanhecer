'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { soundPlayer } from '@/lib/audio';
import {
  QrCode,
  CreditCard,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const STORAGE_CPF_KEY = 'festapay_customer_cpf';
const STORAGE_PENDING_PAYMENT_KEY = 'festapay_pending_asaas_payment';

interface OnlineRechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardType;
  largeFont?: boolean;
  soundEnabled?: boolean;
}

interface GeneratedPaymentData {
  paymentId: string;
  method: 'PIX' | 'CARD';
  netAmountCents: number;
  feeCents: number;
  totalChargedCents: number;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  invoiceUrl: string | null;
}

const PRESET_AMOUNTS = [20, 30, 50, 100];

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
  // CNPJ mask fallback
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export default function OnlineRechargeDialog({
  open,
  onOpenChange,
  card,
  largeFont = false,
  soundEnabled = true,
}: OnlineRechargeDialogProps) {
  const [step, setStep] = useState<'FORM' | 'PAYMENT' | 'SUCCESS'>('FORM');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(50);
  const [customAmountStr, setCustomAmountStr] = useState<string>('50');
  const [method, setMethod] = useState<'PIX' | 'CARD'>('PIX');
  const [cpfInput, setCpfInput] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<GeneratedPaymentData | null>(null);

  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [creditedAmountCents, setCreditedAmountCents] = useState<number>(0);
  const [newBalanceCents, setNewBalanceCents] = useState<number | null>(null);

  const hasCelebratedRef = useRef<boolean>(false);

  // Load saved CPF on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCpf = localStorage.getItem(STORAGE_CPF_KEY);
    if (savedCpf) {
      setCpfInput(formatCpfCnpjMask(savedCpf));
    }
  }, []);

  // Reset error when modal opens/closes
  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setCopiedPix(false);
    }
  }, [open]);

  // Parse net amount in Reais & Cents + Exact Asaas Fee Pass-Through
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

  const checkPaymentStatus = useCallback(
    async (paymentId: string, manualClick = false) => {
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
          setCreditedAmountCents(
            data.valorRecargaCentavos || paymentData?.netAmountCents || netCents
          );
          if (typeof data.novoSaldoCentavos === 'number') {
            setNewBalanceCents(data.novoSaldoCentavos);
          }
          setStep('SUCCESS');

          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_PENDING_PAYMENT_KEY);
          }

          if (!hasCelebratedRef.current) {
            hasCelebratedRef.current = true;
            if (soundEnabled) {
              soundPlayer.playReadyChime();
            }
          }
          return;
        }

        if (manualClick) {
          setErrorMsg(
            'Ainda aguardando a confirmação do banco (geralmente leva de 3 a 10 segundos após o pagamento). Assim que confirmar, a tela atualizará sozinha!'
          );
        }
      } catch (err) {
        console.warn('Erro ao consultar status da recarga:', err);
      } finally {
        if (manualClick) {
          setIsCheckingStatus(false);
        }
      }
    },
    [netCents, paymentData?.netAmountCents, soundEnabled]
  );

  // Automatic polling while in PAYMENT step + check immediately when user returns from banking app
  useEffect(() => {
    if (!open || step !== 'PAYMENT' || !paymentData?.paymentId) return;

    const pid = paymentData.paymentId;

    const intervalId = setInterval(() => {
      checkPaymentStatus(pid, false);
    }, 3000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkPaymentStatus(pid, false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [open, step, paymentData?.paymentId, checkPaymentStatus]);

  const handleGeneratePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (parsedReais < 5) {
      setErrorMsg('O valor mínimo para recarga online é de R$ 5,00.');
      return;
    }

    const cleanCpf = cpfInput.replace(/\D/g, '');
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      setErrorMsg('Por favor, digite seu CPF (11 números) para gerar o pagamento.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CPF_KEY, cleanCpf);
    }

    setIsGenerating(true);
    hasCelebratedRef.current = false;

    try {
      const response = await fetch('/api/asaas/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          netAmountReais: parsedReais,
          method,
          cpfCnpj: cleanCpf,
          payerName: card.nome_cliente,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Não foi possível gerar a cobrança. Confira o CPF e tente novamente.');
        return;
      }

      const generated: GeneratedPaymentData = {
        paymentId: data.paymentId,
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
          STORAGE_PENDING_PAYMENT_KEY,
          JSON.stringify({
            paymentId: generated.paymentId,
            cardId: card.id,
            createdAt: Date.now(),
          })
        );
      }
    } catch (err) {
      console.error('Erro ao criar recarga online:', err);
      setErrorMsg('Erro de conexão ao gerar a recarga. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPix = async () => {
    if (!paymentData?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 5000);
    } catch {
      // Fallback textarea copy
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

  const handleResetToForm = () => {
    setStep('FORM');
    setPaymentData(null);
    setErrorMsg(null);
    setCopiedPix(false);
  };

  const handleCloseAfterSuccess = () => {
    setStep('FORM');
    setPaymentData(null);
    setErrorMsg(null);
    onOpenChange(false);
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
            <Sparkles className="h-6 w-6 text-emerald-600 shrink-0" />
            <span>Recarregar Cartão Online</span>
          </DialogTitle>
          <DialogDescription className="text-slate-600 font-semibold text-sm">
            Cartão de <strong>{card.nome_cliente || 'Cliente'}</strong> • Sem pegar fila no caixa!
          </DialogDescription>
        </DialogHeader>

        {/* ================================================================= */}
        {/* STEP 1: CHOOSE AMOUNT, SEE EXPLICIT +5% FEE & CHOOSE METHOD       */}
        {/* ================================================================= */}
        {step === 'FORM' && (
          <form onSubmit={handleGeneratePayment} className="space-y-4 pt-1">
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-400 text-red-900 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold leading-snug">{errorMsg}</p>
              </div>
            )}

            {/* 1. Valor que deseja colocar no cartão */}
            <div className="space-y-2.5">
              <label
                htmlFor="recharge-amount-input"
                className={`block font-black text-slate-900 ${
                  largeFont ? 'text-lg' : 'text-base'
                }`}
              >
                1. Quanto de saldo você quer colocar no cartão?
              </label>

              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedPreset === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-3 px-2 rounded-2xl border-2 font-black transition-all cursor-pointer ${
                        largeFont ? 'text-lg' : 'text-base'
                      } ${
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
                  id="recharge-amount-input"
                  type="number"
                  inputMode="decimal"
                  min={5}
                  max={2000}
                  step="1"
                  value={customAmountStr}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="Outro valor (ex: 40)"
                  className={`w-full pl-12 pr-4 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 ${
                    largeFont ? 'h-14 text-2xl' : 'h-12 text-xl'
                  }`}
                />
              </div>
            </div>

            {/* 2. Escolha como pagar: PIX ou Cartão 1x */}
            <div className="space-y-2">
              <span
                className={`block font-black text-slate-900 ${
                  largeFont ? 'text-lg' : 'text-base'
                }`}
              >
                2. Como você prefere pagar?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod('PIX')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    method === 'PIX'
                      ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/30'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      method === 'PIX'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-base leading-tight">
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
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                    method === 'CARD'
                      ? 'bg-purple-50 border-purple-700 ring-2 ring-purple-500/30'
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      method === 'CARD'
                        ? 'bg-purple-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-base leading-tight">
                      Cartão (1x à vista)
                    </p>
                    <p className="text-xs font-bold text-purple-800">
                      Taxa: 2,99% + R$ 0,49
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. EXPLICIT ASAAS FEE BREAKDOWN BOX */}
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-2">
              <div className="flex items-center justify-between text-slate-800 font-bold text-sm sm:text-base">
                <span>Saldo que entra no seu cartão:</span>
                <span className="font-black text-emerald-800">
                  {formatCurrency(netCents)}
                </span>
              </div>

              <div className="flex items-center justify-between text-amber-950 font-bold text-xs sm:text-sm">
                <span>{feeLabel}:</span>
                <span className="font-black">+ {formatCurrency(feeCents)}</span>
              </div>

              <div className="border-t-2 border-amber-300 pt-2 flex items-center justify-between text-slate-950">
                <span className="font-black text-sm sm:text-base uppercase">
                  Total a pagar agora:
                </span>
                <span
                  className={`font-black text-purple-900 ${
                    largeFont ? 'text-2xl' : 'text-xl'
                  }`}
                >
                  {formatCurrency(totalChargedCents)}
                </span>
              </div>

              <p className="text-[11px] font-semibold text-amber-900 leading-tight pt-0.5">
                * Repasse exato do custo da operadora de pagamento online (Asaas). No caixa físico da festa não há taxa.
              </p>
            </div>

            {/* 4. CPF do Pagador (exigido pelo Banco Central / Asaas) */}
            <div className="space-y-1.5">
              <label
                htmlFor="payer-cpf-input"
                className={`block font-black text-slate-900 ${
                  largeFont ? 'text-base' : 'text-sm'
                }`}
              >
                3. Seu CPF (exigido pelo banco para emitir o pagamento):
              </label>
              <input
                id="payer-cpf-input"
                type="tel"
                inputMode="numeric"
                value={cpfInput}
                onChange={(e) => setCpfInput(formatCpfCnpjMask(e.target.value))}
                placeholder="000.000.000-00"
                required
                className={`w-full px-4 rounded-2xl bg-white border-2 border-slate-400 focus:border-purple-700 focus:outline-none font-black text-slate-900 tracking-wide ${
                  largeFont ? 'h-14 text-xl' : 'h-12 text-lg'
                }`}
              />
            </div>

            <Button
              type="submit"
              disabled={isGenerating || netCents < 500}
              className={`w-full rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                largeFont ? 'h-16 text-xl' : 'h-14 text-lg'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Gerando pagamento seguro...</span>
                </>
              ) : (
                <>
                  <span>
                    Gerar {method === 'PIX' ? 'PIX' : 'Link de Cartão (1x)'} de{' '}
                    {formatCurrency(totalChargedCents)}
                  </span>
                </>
              )}
            </Button>
          </form>
        )}

        {/* ================================================================= */}
        {/* STEP 2: AWAITING PAYMENT (PIX COPIA E COLA OR CARD 1X CHECKOUT)   */}
        {/* ================================================================= */}
        {step === 'PAYMENT' && paymentData && (
          <div className="space-y-4 pt-1">
            {/* Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-100 border-2 border-slate-300 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">
                  Vai entrar no cartão:
                </p>
                <p className="text-lg font-black text-emerald-800">
                  + {formatCurrency(paymentData.netAmountCents)}
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
                {/* Step-by-step instructions for using Pix on the same phone */}
                <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-left space-y-2">
                  <p className="font-black text-emerald-950 text-sm sm:text-base">
                    📱 Como pagar pelo próprio celular (3 passos):
                  </p>
                  <ol className="text-xs sm:text-sm font-bold text-emerald-900 space-y-1 list-decimal list-inside">
                    <li>Toque no botão verde abaixo para copiar o código PIX;</li>
                    <li>Abra o aplicativo do seu banco em &ldquo;Pix Copia e Cola&rdquo; e pague;</li>
                    <li>Volte para esta tela: seu saldo sobe sozinho em segundos!</li>
                  </ol>

                  <Button
                    type="button"
                    onClick={handleCopyPix}
                    className={`w-full mt-2 rounded-2xl font-black shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                      copiedPix
                        ? 'bg-emerald-900 text-white'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    } ${largeFont ? 'h-16 text-lg' : 'h-14 text-base'}`}
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

                {/* QR Code image if scanning from another phone */}
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
              /* CARD (1x) CHECKOUT */
              <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-400 text-center space-y-3.5">
                <div className="inline-flex h-12 w-12 rounded-2xl bg-purple-700 text-white items-center justify-center mx-auto">
                  <CreditCard className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-purple-950 text-lg">
                    Pagamento com Cartão (1x à vista)
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-purple-900">
                    Toque no botão abaixo para abrir o ambiente seguro do Asaas e digitar os dados do seu cartão (Crédito 1x ou Débito). Depois é só voltar para esta tela!
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

            {/* Live Polling Indicator + Manual Check Button */}
            <div className="pt-2 border-t-2 border-slate-200 space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700 shrink-0" />
                <span>Aguardando confirmação automática do banco...</span>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isCheckingStatus}
                onClick={() => checkPaymentStatus(paymentData.paymentId, true)}
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
                    <span>Já paguei! Atualizar meu saldo agora</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleResetToForm}
                className="w-full h-10 rounded-xl text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Trocar valor ou forma de pagamento</span>
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: PAYMENT CONFIRMED & BALANCE CREDITED!                     */}
        {/* ================================================================= */}
        {step === 'SUCCESS' && (
          <div className="py-5 px-2 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="inline-flex h-20 w-20 rounded-full bg-emerald-100 border-4 border-emerald-500 text-emerald-700 items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs uppercase tracking-wider">
                Pagamento Confirmado!
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                Recarga realizada com sucesso! 🎉
              </h3>
              <p className="text-sm font-semibold text-slate-600">
                O valor já entrou no seu cartão e você já pode comprar nas barracas!
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-2">
              <div>
                <p className="text-xs font-bold uppercase text-emerald-900">
                  Valor creditado no cartão:
                </p>
                <p className="text-3xl font-black text-emerald-700">
                  + {formatCurrency(creditedAmountCents)}
                </p>
              </div>

              {typeof newBalanceCents === 'number' && (
                <div className="pt-2 border-t border-emerald-300">
                  <p className="text-xs font-bold uppercase text-emerald-900">
                    Novo Saldo Disponível:
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {formatCurrency(newBalanceCents)}
                  </p>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleCloseAfterSuccess}
              className="w-full h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-lg shadow-md cursor-pointer"
            >
              Voltar para o Meu Cartão
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
