import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { confirmAndCreditOnlineRecharge } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

function getWebDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

interface AsaasWebhookPayment {
  id?: string;
  status?: string;
  externalReference?: string | null;
  description?: string | null;
  billingType?: string;
  value?: number;
}

/**
 * Verifica se a cobrança recebida no Webhook pertence à Festa Novo Amanhecer (FestaPay).
 * Ignora imediatamente cobranças de outros sistemas da igreja (Oiko, IBM Camp, Ação Social, etc.)
 * retornando 200 OK para nunca travar a fila do Asaas.
 */
async function isFestaPayPayment(payment: AsaasWebhookPayment): Promise<boolean> {
  if (!payment?.id) return false;

  // 1. Checagem rápida pelo externalReference ou descrição definidos pelo FestaPay
  if (
    typeof payment.externalReference === 'string' &&
    payment.externalReference.startsWith('festapay_card_')
  ) {
    return true;
  }

  if (
    typeof payment.description === 'string' &&
    payment.description.includes('FestaPay')
  ) {
    return true;
  }

  // 2. Fallback: verifica se o ID do pagamento existe na coleção `online_recharges` do FestaPay
  try {
    const db = getWebDb();
    const snap = await getDoc(doc(db, 'online_recharges', payment.id));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = (body?.event as string | undefined) || 'UNKNOWN_EVENT';
    const payment = body?.payment as AsaasWebhookPayment | undefined;

    // Se não for evento de pagamento (ex: transferência, nota fiscal, assinatura de outro sistema), ignora com 200 OK
    if (!payment?.id) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'no_payment_object',
        event,
      });
    }

    // Filtra exclusivamente cobranças da Festa (FestaPay)
    const belongsToFesta = await isFestaPayPayment(payment);
    if (!belongsToFesta) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: 'not_festapay_payment',
        paymentId: payment.id,
        event,
      });
    }

    // Se o pagamento foi confirmado/recebido, credita o saldo atomicamente no cartão
    const isPaidEvent =
      event === 'PAYMENT_RECEIVED' ||
      event === 'PAYMENT_CONFIRMED' ||
      payment.status === 'RECEIVED' ||
      payment.status === 'CONFIRMED' ||
      payment.status === 'RECEIVED_IN_CASH';

    if (isPaidEvent) {
      const result = await confirmAndCreditOnlineRecharge(payment.id, payment.status);
      return NextResponse.json({
        received: true,
        festaPay: true,
        event,
        paymentId: payment.id,
        credited: result.credited,
        alreadyCredited: result.alreadyCredited,
        novoSaldoCentavos: result.novoSaldoCentavos,
      });
    }

    // Para demais eventos da Festa (PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_CHECKOUT_VIEWED, PAYMENT_DELETED, etc.),
    // atualiza o status no documento `online_recharges/{payment.id}` para rastreio em tempo real
    try {
      const db = getWebDb();
      const rechargeRef = doc(db, 'online_recharges', payment.id);
      const snap = await getDoc(rechargeRef);
      if (snap.exists()) {
        const currentStatus = snap.data()?.status;
        const nextStatus =
          (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') &&
          currentStatus !== 'CREDITED'
            ? 'CANCELLED'
            : currentStatus;

        await updateDoc(rechargeRef, {
          asaas_status: payment.status || event,
          last_webhook_event: event,
          status: nextStatus,
          updated_at: Timestamp.now(),
        });
      }
    } catch (updateErr) {
      console.warn('[API /api/asaas/webhook] Aviso ao atualizar status intermediário:', updateErr);
    }

    return NextResponse.json({
      received: true,
      festaPay: true,
      event,
      paymentId: payment.id,
      asaasStatus: payment.status,
    });
  } catch (error: unknown) {
    console.error('[API /api/asaas/webhook] Erro no processamento do webhook Asaas:', error);
    // Sempre retorna 200 para evitar penalização/interrupção da fila no Asaas
    return NextResponse.json({
      received: true,
      warning: 'Handled exception cleanly',
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'FestaPay Asaas Online Recharge Webhook (Filtered for Festa Novo Amanhecer 2026)',
  });
}
