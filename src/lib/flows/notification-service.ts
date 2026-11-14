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

const GREETINGS = ['Olá', 'Oi', 'Tudo bem'];
let roundRobinCounter = 0;

function pickGreeting(clientName?: string): string {
  const g = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  return clientName ? `${g}, ${clientName}` : g;
}

/**
 * Generates a unique, subtle footer reference (time + short code) so that every outgoing
 * WhatsApp message has a distinct content hash on Meta's anti-spam filters.
 */
function buildAntiSpamFooter(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const token = Math.random().toString(36).substring(2, 6);
  return `\n\n_Ref: ${hh}:${mm} • #${token}_`;
}

/**
 * Dispatches an order ready notification with atomic Firestore lock,
 * exclusively via the PDV WhatsApp instance (if connected).
 */
export async function sendOrderReadyNotification(orderId: string): Promise<NotificationResult> {
  const db = getDb();
  const orderRef = doc(db, 'orders', orderId);

  // 1. ATOMIC LOCK (PENDING -> SENDING)
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

    const greeting = pickGreeting(card.nome_cliente);
    const message = `${greeting}! 👋\n\nSeu pedido *${order.order_number}* feito em *${order.pdv_nome}* está pronto para retirada! 😋\n\nPor favor, dirija-se ao balcão para retirar.${buildAntiSpamFooter()}`;

    // 3. Routing: EXCLUSIVELY the WhatsApp instance connected to the PDV.
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

type WppCandidate = {
  instance: string;
  token?: string;
  slot: number;
  tenantId?: string;
  eventId?: string;
};

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
            candidates.push({
              instance: eData.whatsapp.instanceName,
              token: eData.whatsapp.token,
              slot: 0,
              tenantId,
              eventId,
            });
          }
          const backups = eData.whatsapp_backups || {};
          Object.keys(backups)
            .sort((x, y) => Number(x) - Number(y))
            .forEach((k) => {
              const cfg = backups[k];
              if (cfg?.instanceName) {
                candidates.push({
                  instance: cfg.instanceName,
                  token: cfg.token,
                  slot: Number(k),
                  tenantId,
                  eventId,
                });
              }
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
 * Distributes sends across all connected Caixa instances (Round-Robin) to divide the volume
 * per chip, and automatically falls over to the next connected instance if one is offline/fails.
 */
async function sendWithEventFailover(
  candidates: WppCandidate[],
  send: (instance: string, token?: string) => Promise<{ success: boolean; error?: string }>
): Promise<{ success: boolean; error?: string; instanceUsed?: string }> {
  let lastError: string | undefined;

  if (candidates.length > 0) {
    const startIdx = (roundRobinCounter++ + Math.floor(Math.random() * candidates.length)) % candidates.length;
    const rotated = [
      ...candidates.slice(startIdx),
      ...candidates.slice(0, startIdx),
    ];

    for (const c of rotated) {
      try {
        const state = await getEvolutionConnectionState(c.instance, c.token);
        if (state.state !== 'open') {
          lastError = `Instância ${c.instance} desconectada.`;
          // Auto-mark disconnected in Firestore immediately
          if (c.tenantId && c.eventId) {
            const prefix = c.slot === 0 ? 'whatsapp' : `whatsapp_backups.${c.slot}`;
            const db = getDb();
            updateDoc(doc(db, 'tenants', c.tenantId, 'events', c.eventId), {
              [`${prefix}.status`]: 'DISCONNECTED',
              [`${prefix}.phoneNumber`]: null,
              [`${prefix}.updatedAt`]: Timestamp.now(),
            }).catch(() => {});
          }
          continue;
        }
        const res = await send(c.instance, c.token);
        if (res.success) return { success: true, instanceUsed: c.instance };
        lastError = res.error;
        console.warn(`[NotificationService] Instance ${c.instance} failed, trying next backup:`, res.error);

        // If error indicates session dropped/connection closed, auto-mark disconnected
        if (
          res.error &&
          (res.error.toLowerCase().includes('close') ||
            res.error.toLowerCase().includes('session') ||
            res.error.toLowerCase().includes('disconnect') ||
            res.error.toLowerCase().includes('not connected') ||
            res.error.toLowerCase().includes('connection closed'))
        ) {
          if (c.tenantId && c.eventId) {
            const prefix = c.slot === 0 ? 'whatsapp' : `whatsapp_backups.${c.slot}`;
            const db = getDb();
            updateDoc(doc(db, 'tenants', c.tenantId, 'events', c.eventId), {
              [`${prefix}.status`]: 'DISCONNECTED',
              [`${prefix}.phoneNumber`]: null,
              [`${prefix}.updatedAt`]: Timestamp.now(),
            }).catch(() => {});
          }
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Erro desconhecido.';
      }
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
 * Sends balance recharge receipt via WhatsApp (Event instance with Round-Robin + Failover).
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

    const greeting = pickGreeting(card.nome_cliente || 'cliente');
    const message = `${greeting}!\n\nSua recarga${eventHeader} foi efetuada com sucesso. ✅\n\n*Valor da Recarga:* ${formatCurrency(rechargeAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}\n\n📍 *Acompanhe seus pedidos em tempo real:*\nhttps://festanovoamanhecer.com.br/igreja-batista-da-manha/pedidos${buildAntiSpamFooter()}`;

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
 * Sends card creation welcome message with QR Code in a SINGLE message (image + caption)
 * to cut message volume in half and prevent 0ms double-message bans.
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

    const greeting = pickGreeting(card.nome_cliente);
    const caption = `${greeting}! 🥳\n\n${eventWelcome}\nSeu cartão cashless foi criado com sucesso.\n\n*ID do Cartão:* \`${card.qr_code_id}\`\n*Saldo Inicial:* ${formatCurrency(card.saldo_centavos)}\n\nAcima está o seu QR Code para pagamentos. Guarde-o com segurança!\n\n📍 *Acompanhe seus pedidos em tempo real:*\nhttps://festanovoamanhecer.com.br/igreja-batista-da-manha/pedidos${buildAntiSpamFooter()}`;

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(card.qr_code_id)}`;

    // Send as 1 single media message (QR Code image + full welcome caption)
    const mediaRes = await sendWithEventFailover(candidates, async (inst, tok) => {
      const mRes = await sendEvolutionMediaMessage(
        inst,
        card.telefone_cliente as string,
        qrImageUrl,
        caption,
        tok
      );
      if (mRes.success) return mRes;
      // If media fetch fails for any reason, fallback to single text message on the same instance
      return sendEvolutionTextMessage(inst, card.telefone_cliente as string, caption, tok);
    });

    return { success: mediaRes.success, error: mediaRes.error, instanceUsed: mediaRes.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar boas-vindas.';
    return { success: false, error: msg };
  }
}

/**
 * Purchase receipt per stall sale is intentionally disabled on the Caixa WhatsApp
 * to protect the Caixa numbers from high-frequency spam bans across all stalls.
 */
export async function sendSaleNotification(_cardId: string, _saleAmountCents: number, _pdvName: string): Promise<NotificationResult> {
  return { success: true };
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

    const greeting = pickGreeting(card.nome_cliente || 'cliente');
    const message = `${greeting}!\n\nUma transação foi estornada e seu saldo foi ajustado.\n\n*Valor do Estorno:* ${formatCurrency(reversalAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}\n\nEm caso de dúvidas, procure o caixa central.${buildAntiSpamFooter()}`;

    const res = await sendWithEventFailover(candidates, (inst, tok) =>
      sendEvolutionTextMessage(inst, card.telefone_cliente as string, message, tok)
    );
    return { success: res.success, error: res.error, instanceUsed: res.instanceUsed };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar aviso de estorno.';
    return { success: false, error: msg };
  }
}
