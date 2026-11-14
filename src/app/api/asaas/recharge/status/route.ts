import { NextResponse } from 'next/server';
import { confirmAndCreditOnlineRecharge } from '@/lib/asaas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('id')?.trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: 'ID do pagamento não informado.' },
        { status: 400 }
      );
    }

    const result = await confirmAndCreditOnlineRecharge(paymentId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[API /api/asaas/recharge/status] Erro ao verificar status:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao consultar status do pagamento.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
