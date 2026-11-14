'use server';

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import type { Card, Order, Transaction, Pdv, TenantEvent } from '../definitions';
import { formatCurrency } from '@/lib/utils';
import {
  sendEvolutionTextMessage,
  sendEvolutionMediaMessage,
  getEvolutionConnectionState,
  DEFAULT_FALLBACK_INSTANCE,
} from '@/lib/whatsapp';

function getDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export type NotificationResult = {
  success: boolean;
  route?: 'PDV' | 'EVENT_FALLBACK';
  instanceUsed?: string;
  error?: string;
};

/**
 * Dispatches an order ready notification with atomic Firestore lock,
 * PDV instance routing, and automatic fallback to event instance.
 */
export async function sendOrderReadyNotification(orderId: string): Promise<NotificationResult> {
  const db = getDb();
  const orderRef = doc(db, 'orders', orderId);

  // 1. ATOMIC LOCK (PENDING -> SENDING)
  // Ensures idempotency so simultaneous clicks never send duplicate messages.
  let acquiredLock = false;
  let orderData: Order | null = null;

  try {
    await runTransaction(db, async (t) => {
      const docSnap = await t.get(orderRef);
      if (!docSnap.exists()) {
        throw new Error(`Pedido ${orderId} não encontrado.`);
      }

      const order = { id: docSnap.id, ...docSnap.data() } as Order;
      orderData = order;

      if (order.notification_status === 'SENT' || order.notification_status === 'SENDING') {
        // Already processed or in flight
        return;
      }

      t.update(orderRef, {
        notification_status: 'SENDING',
        updated_at: Timestamp.now(),
      });
      acquiredLock = true;
    });
  } catch (error) {
    console.error(`[NotificationService] Error acquiring lock for order ${orderId}:`, error);
    return { success: false, error: 'Falha ao adquirir trava de envio.' };
  }

  if (!acquiredLock || !orderData) {
    console.log(`[NotificationService] Order ${orderId} is already notified or in-flight. Skipping.`);
    return { success: true };
  }

  // 2. Fetch Customer Phone & Details (outside transaction)
  const order = orderData as Order;
  try {
    const txSnap = await getDoc(doc(db, 'transactions', order.transaction_id));
    if (!txSnap.exists()) {
      await updateDoc(orderRef, {
        notification_status: 'FAILED',
        notification_error: 'Transação associada não encontrada.',
      });
      return { success: false, error: 'Transação não encontrada.' };
    }

    const transaction = txSnap.data() as Transaction;
    const cardSnap = await getDoc(doc(db, 'cards', transaction.cartao_id));
    if (!cardSnap.exists()) {
      await updateDoc(orderRef, {
        notification_status: 'FAILED',
        notification_error: 'Cartão associado não encontrado.',
      });
      return { success: false, error: 'Cartão não encontrado.' };
    }

    const card = cardSnap.data() as Card;
    if (!card.telefone_cliente) {
      await updateDoc(orderRef, {
        notification_status: 'FAILED',
        notification_error: 'Cartão sem telefone cadastrado.',
      });
      return { success: false, error: 'Telefone ausente.' };
    }

    const clientName = card.nome_cliente ? `, ${card.nome_cliente}` : '';
    const message = `Olá${clientName}! 👋\n\nSeu pedido *${order.order_number}* feito em *${order.pdv_nome}* está pronto para retirada! 😋\n\nPor favor, dirija-se ao balcão para retirar.`;

    // 3. Routing: EXCLUSIVELY the WhatsApp instance connected to the PDV.
    // If the PDV has no connected instance, no notification is sent (no fallback).
    const route: 'PDV' | 'EVENT_FALLBACK' = 'PDV';
    let pdvWhatsappInstance: string | null = null;
    let pdvWhatsappToken: string | undefined = undefined;

    if (order.pdv_id) {
      const pdvSnap = await getDoc(doc(db, 'pdvs', order.pdv_id));
      if (pdvSnap.exists()) {
        const pdvData = pdvSnap.data() as Pdv;
        if (pdvData.whatsapp?.instanceName) {
          pdvWhatsappInstance = pdvData.whatsapp.instanceName;
        }
        if (pdvData.whatsapp?.token) {
          pdvWhatsappToken = pdvData.whatsapp.token;
        }
      }
    }

    if (!pdvWhatsappInstance) {
      await updateDoc(orderRef, {
        notification_status: 'SKIPPED',
        notification_error: 'PDV sem WhatsApp conectado. Notificação não enviada.',
      });
      return { success: false, error: 'PDV sem WhatsApp conectado.' };
    }

    let sendSuccess = false;
    let lastError: string | undefined;
    const instanceToUse = pdvWhatsappInstance;

    const connectionCheck = await getEvolutionConnectionState(pdvWhatsappInstance, pdvWhatsappToken);
    if (connectionCheck.state === 'open') {
      const pdvResult = await sendEvolutionTextMessage(pdvWhatsappInstance, card.telefone_cliente, message, pdvWhatsappToken);
      if (pdvResult.success) {
        sendSuccess = true;
      } else {
        lastError = pdvResult.error;
      }
    } else {
      lastError = 'WhatsApp do PDV desconectado. Notificação não enviada.';
      if (order.pdv_id) {
        await updateDoc(doc(db, 'pdvs', order.pdv_id), {
          'whatsapp.status': 'DISCONNECTED',
          'whatsapp.updatedAt': Timestamp.now(),
        }).catch(() => {});
      }
    }

    // 5. Final State Update in Firestore
    if (sendSuccess) {
      await updateDoc(orderRef, {
        notification_status: 'SENT',
        notification_route: route,
        notified_at: Timestamp.now(),
        notification_error: null,
      });
      console.log(`[NotificationService] Order ${orderId} notification sent via ${route} (${instanceToUse}).`);
      return { success: true, route, instanceUsed: instanceToUse };
    } else {
      await updateDoc(orderRef, {
        notification_status: 'FAILED',
        notification_error: lastError || 'Falha no envio pela instância do PDV.',
      });
      return { success: false, error: lastError };
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido.';
    console.error(`[NotificationService] Exception notifying order ${orderId}:`, errorMsg);
    await updateDoc(orderRef, {
      notification_status: 'FAILED',
      notification_error: errorMsg,
    }).catch(() => {});
    return { success: false, error: errorMsg };
  }
}

type WppCandidate = { instance: string; token?: string };

/**
 * Resolves the event names and the ordered list of Caixa WhatsApp instances:
 * principal first, then backups (slot 1, 2, ...).
 */
async function resolveEventWhatsapp(
  db: any,
  tenantId?: string | null,
  eventId?: string | null
): Promise<{ candidates: WppCandidate[]; orgName: string; eventName: string }> {
  let orgName = '';
  let eventName = '';
  const candidates: WppCandidate[] = [];

  if (tenantId) {
    try {
      const tSnap = await getDoc(doc(db, 'tenants', tenantId));
      if (tSnap.exists()) orgName = tSnap.data().name || '';
      if (eventId) {
        const eSnap = await getDoc(doc(db, 'tenants', tenantId, 'events', eventId));
        if (eSnap.exists()) {
          const eData = eSnap.data() as TenantEvent;
          eventName = eData.name || '';
          if (eData.whatsapp?.instanceName) {
            candidates.push({ instance: eData.whatsapp.instanceName, token: eData.whatsapp.token });
          }
          const backups = eData.whatsapp_backups || {};
          Object.keys(backups)
            .sort((x, y) => Number(x) - Number(y))
            .forEach((k) => {
              const cfg = backups[k];
              if (cfg?.instanceName) candidates.push({ instance: cfg.instanceName, token: cfg.token });
            });
        }
      }
    } catch (e) {
      console.warn('[NotificationService] Failed resolving event WhatsApp:', e);
    }
  }

  return { candidates, orgName, eventName };
}

/**
 * Tries each Caixa instance in order (principal -> backups). An instance is skipped when
 * it is not connected ('open') or when sending fails. Last resort: default IBM instance.
 */
async function sendWithEventFailover(
  candidates: WppCandidate[],
  send: (instance: string, token?: string) => Promise<{ success: boolean; error?: string }>
): Promise<{ success: boolean; error?: string; instanceUsed?: string }> {
  let lastError: string | undefined;

  for (const c of candidates) {
    try {
      const state = await getEvolutionConnectionState(c.instance, c.token);
      if (state.state !== 'open') {
        lastError = `Instância ${c.instance} desconectada.`;
        continue;
      }
      const res = await send(c.instance, c.token);
      if (res.success) return { success: true, instanceUsed: c.instance };
      lastError = res.error;
      console.warn(`[NotificationService] Instance ${c.instance} failed, trying next backup:`, res.error);
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Erro desconhecido.';
    }
  }

  const fallback = await send(DEFAULT_FALLBACK_INSTANCE, undefined);
  return {
    success: fallback.success,
    error: fallback.success ? undefined : fallback.error || lastError,
    instanceUsed: DEFAULT_FALLBACK_INSTANCE,
  };
}

/**
 * Sends balance recharge receipt via WhatsApp (Event instance).
 */
export async function sendRechargeNotification(cardId: string, rechargeAmountCents: number): Promise<NotificationResult> {
  const db = getDb();
  try {
    const cardSnap = await getDoc(doc(db, 'cards', cardId));
    if (!cardSnap.exists()) return { success: false, error: 'Cartão não encontrado.' };

    const card = cardSnap.data() as Card;
    if (!card.telefone_cliente) return { success: true };

    const { candidates, orgName, eventName } = await resolveEventWhatsapp(db, card.tenant_id, card.event_id);

    let eventHeader = '';
    if (eventName) {
      eventHeader = orgName ? ` na *${eventName}* (${orgName})` : ` na *${eventName}*`;
    }

    const message = `Olá, ${card.nome_cliente || 'cliente'}!\n\nSua recarga${eventHeader} foi efetuada com sucesso. ✅\n\n*Valor da Recarga:* ${formatCurrency(rechargeAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}`;

    const res = await sendWithEventFailover(candidates, (inst, tok) =>
      sendEvolutionTextMessage(inst, card.telefone_cliente as string, message, tok)
    );
    return { success: res.success, error: res.error, instanceUsed: res.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar comprovante de recarga.';
    return { success: false, error: msg };
  }
}

/**
 * Sends card creation welcome message with QR Code (Event instance).
 */
export async function sendCardCreationNotification(cardId: string): Promise<NotificationResult> {
  const db = getDb();
  try {
    const cardSnap = await getDoc(doc(db, 'cards', cardId));
    if (!cardSnap.exists()) return { success: false, error: 'Cartão não encontrado.' };

    const card = cardSnap.data() as Card;
    if (!card.telefone_cliente) return { success: true };

    const { candidates, orgName, eventName } = await resolveEventWhatsapp(db, card.tenant_id, card.event_id);

    let eventWelcome = 'Bem-vindo(a) ao FestaPay!';
    if (eventName) {
      eventWelcome = orgName 
        ? `Bem-vindo(a) à *${eventName}* (${orgName})!` 
        : `Bem-vindo(a) à *${eventName}*!`;
    }

    const clientName = card.nome_cliente ? `, ${card.nome_cliente}` : '';
    const message = `Olá${clientName}! 🥳\n\n${eventWelcome}\nSeu cartão cashless foi criado com sucesso.\n\n*ID do Cartão:* \`${card.qr_code_id}\`\n*Saldo Inicial:* ${formatCurrency(card.saldo_centavos)}\n\nAbaixo está o seu QR Code para pagamentos. Guarde-o com segurança!`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(card.qr_code_id)}`;

    const textRes = await sendWithEventFailover(candidates, (inst, tok) =>
      sendEvolutionTextMessage(inst, card.telefone_cliente as string, message, tok)
    );
    if (textRes.success && textRes.instanceUsed) {
      // Send the QR image through the same instance that delivered the text
      const used = candidates.find((c) => c.instance === textRes.instanceUsed);
      await sendEvolutionMediaMessage(
        textRes.instanceUsed,
        card.telefone_cliente,
        qrImageUrl,
        'Seu QR Code de Pagamento',
        used?.token
      );
    }

    return { success: textRes.success, error: textRes.error, instanceUsed: textRes.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar boas-vindas.';
    return { success: false, error: msg };
  }
}

/**
 * Sends purchase receipt (Event instance).
 */
export async function sendSaleNotification(cardId: string, saleAmountCents: number, pdvName: string): Promise<NotificationResult> {
  const db = getDb();
  try {
    const cardSnap = await getDoc(doc(db, 'cards', cardId));
    if (!cardSnap.exists()) return { success: false, error: 'Cartão não encontrado.' };

    const card = cardSnap.data() as Card;
    if (!card.telefone_cliente) return { success: true };

    const { candidates } = await resolveEventWhatsapp(db, card.tenant_id, card.event_id);

    const message = `Nova compra realizada no FestaPay! 🛍️\n\n*Local:* ${pdvName}\n*Valor:* -${formatCurrency(saleAmountCents)}\n*Saldo Restante:* ${formatCurrency(card.saldo_centavos)}\n\nObrigado!`;

    const res = await sendWithEventFailover(candidates, (inst, tok) =>
      sendEvolutionTextMessage(inst, card.telefone_cliente as string, message, tok)
    );
    return { success: res.success, error: res.error, instanceUsed: res.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar comprovante de compra.';
    return { success: false, error: msg };
  }
}

/**
 * Sends transaction reversal notification (Event instance).
 */
export async function sendReversalNotification(cardId: string, reversalAmountCents: number): Promise<NotificationResult> {
  const db = getDb();
  try {
    const cardSnap = await getDoc(doc(db, 'cards', cardId));
    if (!cardSnap.exists()) return { success: false, error: 'Cartão não encontrado.' };

    const card = cardSnap.data() as Card;
    if (!card.telefone_cliente) return { success: true };

    const { candidates } = await resolveEventWhatsapp(db, card.tenant_id, card.event_id);

    const message = `Atenção, ${card.nome_cliente || 'cliente'}!\n\nUma transação foi estornada e seu saldo foi ajustado.\n\n*Valor do Estorno:* ${formatCurrency(reversalAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}\n\nEm caso de dúvidas, procure o caixa central.`;

    const res = await sendWithEventFailover(candidates, (inst, tok) =>
      sendEvolutionTextMessage(inst, card.telefone_cliente as string, message, tok)
    );
    return { success: res.success, error: res.error, instanceUsed: res.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar aviso de estorno.';
    return { success: false, error: msg };
  }
}
