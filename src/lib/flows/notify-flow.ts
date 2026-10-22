'use server';

import {
  sendRechargeNotification,
  sendCardCreationNotification,
  sendSaleNotification,
  sendReversalNotification,
} from './notification-service';
import {
  sendEvolutionTextMessage,
  sendEvolutionMediaMessage,
  DEFAULT_FALLBACK_INSTANCE,
} from '@/lib/whatsapp';

type NotifyResult = {
  success: boolean;
  message: string;
  error?: string;
};

/**
 * Generic function to send a custom message to a phone number.
 */
export async function notifyCustomMessage(phoneNumber: string, message: string, imageUrl?: string): Promise<NotifyResult> {
  try {
    const textResult = await sendEvolutionTextMessage(DEFAULT_FALLBACK_INSTANCE, phoneNumber, message);
    if (!textResult.success) {
      return { success: false, message: 'Falha ao enviar mensagem.', error: textResult.error };
    }

    if (imageUrl) {
      await sendEvolutionMediaMessage(DEFAULT_FALLBACK_INSTANCE, phoneNumber, imageUrl, 'Seu QR Code');
    }

    return { success: true, message: `Notificação enviada para ${phoneNumber}.` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { success: false, message: 'Falha no envio.', error: msg };
  }
}

export async function notifyCardCreation(cardId: string): Promise<NotifyResult> {
  const res = await sendCardCreationNotification(cardId);
  return { success: res.success, message: res.success ? 'Boas-vindas enviadas.' : 'Falha.', error: res.error };
}

export async function notifyRecharge(cardId: string, rechargeAmountCents: number): Promise<NotifyResult> {
  const res = await sendRechargeNotification(cardId, rechargeAmountCents);
  return { success: res.success, message: res.success ? 'Comprovante enviado.' : 'Falha.', error: res.error };
}

export async function notifySale(cardId: string, saleAmountCents: number, pdvName: string): Promise<NotifyResult> {
  const res = await sendSaleNotification(cardId, saleAmountCents, pdvName);
  return { success: res.success, message: res.success ? 'Comprovante de venda enviado.' : 'Falha.', error: res.error };
}

export async function notifyReversal(cardId: string, reversalAmountCents: number): Promise<NotifyResult> {
  const res = await sendReversalNotification(cardId, reversalAmountCents);
  return { success: res.success, message: res.success ? 'Aviso de estorno enviado.' : 'Falha.', error: res.error };
}
