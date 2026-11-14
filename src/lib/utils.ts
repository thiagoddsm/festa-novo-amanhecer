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
