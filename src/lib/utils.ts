import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amountInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountInCents / 100);
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

/**
 * Extrai o `qr_code_id` puro de qualquer leitura de QR Code ou digitação:
 * - Compatível 100% com o QR antigo (texto puro: `festa-novo-amanhec-xxxx`)
 * - Compatível 100% com o QR novo (URL curta: `https://.../c/festa-novo-amanhec-xxxx`)
 * - Compatível com query string (`https://.../meu-cartao?c=festa-novo-amanhec-xxxx`)
 */
export function extractCardQrCode(rawInput: string | null | undefined): string {
  if (!rawInput) return '';
  const trimmed = String(rawInput).trim();
  if (!trimmed) return '';

  // 1. Check if it contains /c/{code} path pattern
  const pathMatch = trimmed.match(/\/c\/([^/?#\s]+)/i);
  if (pathMatch && pathMatch[1]) {
    try {
      return decodeURIComponent(pathMatch[1].trim());
    } catch {
      return pathMatch[1].trim();
    }
  }

  // 2. Check if it is a URL with ?c=, ?card=, or ?code=
  if (trimmed.includes('?') && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/'))) {
    try {
      const urlObj = new URL(trimmed, 'https://festanovoamanhecer.com.br');
      const paramCode =
        urlObj.searchParams.get('c') ||
        urlObj.searchParams.get('card') ||
        urlObj.searchParams.get('code') ||
        urlObj.searchParams.get('qr');
      if (paramCode && paramCode.trim()) {
        return paramCode.trim();
      }
    } catch {
      // Fallback to raw trimmed string
    }
  }

  return trimmed;
}

/**
 * Gera a URL curta oficial para abrir o Web App "Meu Cartão" diretamente pela câmera do celular
 * mantendo o código identificável por `extractCardQrCode` em qualquer leitor do sistema.
 */
export function buildCardAppUrl(qrCodeId: string, customOrigin?: string): string {
  const cleanCode = extractCardQrCode(qrCodeId);
  const baseOrigin =
    customOrigin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://festanovoamanhecer.com.br');
  return `${baseOrigin.replace(/\/$/, '')}/c/${encodeURIComponent(cleanCode)}`;
}

/**
 * Calcula o repasse exato da taxa do Asaas para que a igreja receba 100% do valor líquido da recarga:
 * - PIX: Taxa fixa do Asaas de R$ 1,99 (199 centavos)
 * - Cartão (1x): Taxa do Asaas de 2,99% + R$ 0,49 calculada por dentro ((valorLiquido + 49) / (1 - 0,0299))
 */
export function calculateAsaasRechargeFee(
  netAmountCents: number,
  method: 'PIX' | 'CARD'
): {
  netCents: number;
  feeCents: number;
  totalChargedCents: number;
  feeLabel: string;
} {
  const safeNet = Math.max(0, Math.round(netAmountCents));
  if (safeNet === 0) {
    return {
      netCents: 0,
      feeCents: 0,
      totalChargedCents: 0,
      feeLabel:
        method === 'PIX'
          ? 'Taxa PIX da operadora (R$ 1,99 fixo)'
          : 'Taxa Cartão 1x da operadora (2,99% + R$ 0,49)',
    };
  }

  if (method === 'PIX') {
    const feeCents = 199; // R$ 1,99 fixo no Asaas
    return {
      netCents: safeNet,
      feeCents,
      totalChargedCents: safeNet + feeCents,
      feeLabel: 'Taxa PIX da operadora (R$ 1,99 fixo)',
    };
  }

  // Cartão 1x: 2,99% + R$ 0,49 calculado por dentro para sobrar 100% do valor líquido
  const totalChargedCents = Math.round((safeNet + 49) / (1 - 0.0299));
  const feeCents = totalChargedCents - safeNet;

  return {
    netCents: safeNet,
    feeCents,
    totalChargedCents,
    feeLabel: 'Taxa Cartão 1x da operadora (2,99% + R$ 0,49)',
  };
}
