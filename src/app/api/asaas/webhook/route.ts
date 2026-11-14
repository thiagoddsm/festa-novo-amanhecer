import { NextResponse } from 'next/server';
import { confirmAndCreditOnlineRecharge } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = body?.event as string | undefined;
    const payment = body?.payment as { id?: string; status?: string } | undefined;

    if (!payment?.id) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (
      event === 'PAYMENT_RECEIVED' ||
      event === 'PAYMENT_CONFIRMED' ||
      payment.status === 'RECEIVED' ||
      payment.status === 'CONFIRMED'
    ) {
      const result = await confirmAndCreditOnlineRecharge(payment.id, payment.status);
      return NextResponse.json({
        received: true,
        paymentId: payment.id,
        credited: result.credited,
        alreadyCredited: result.alreadyCredited,
      });
    }

    return NextResponse.json({ received: true, event });
  } catch (error: unknown) {
    console.error('[API /api/asaas/webhook] Erro no processamento do webhook Asaas:', error);
    // Retornar 200 para evitar penalização da fila caso seja pagamento de outro sistema na mesma conta Asaas
    return NextResponse.json({ received: true, warning: 'Non-FestaPay or transient error' });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'FestaPay Asaas Online Recharge Webhook',
  });
}
