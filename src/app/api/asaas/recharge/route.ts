import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import type { Card } from '@/lib/definitions';
import {
  findOrCreateAsaasCustomer,
  createAsaasRechargePayment,
  getAsaasPixQrCode,
} from '@/lib/asaas';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getWebDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      cardId,
      netAmountReais,
      method,
      cpfCnpj,
      payerName,
    }: {
      cardId?: string;
      netAmountReais?: number;
      method?: 'PIX' | 'CARD';
      cpfCnpj?: string;
      payerName?: string;
    } = body;

    if (!cardId) {
      return NextResponse.json(
        { error: 'Cartão não informado.' },
        { status: 400 }
      );
    }

    const numericReais = Number(netAmountReais);
    if (!Number.isFinite(numericReais) || numericReais < 5) {
      return NextResponse.json(
        { error: 'O valor mínimo para recarga online é de R$ 5,00.' },
        { status: 400 }
      );
    }

    if (numericReais > 2000) {
      return NextResponse.json(
        { error: 'O valor máximo por recarga online é de R$ 2.000,00.' },
        { status: 400 }
      );
    }

    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      return NextResponse.json(
        { error: 'Por favor, digite um CPF válido (11 números) para emitir o pagamento.' },
        { status: 400 }
      );
    }

    const chosenMethod: 'PIX' | 'CARD' = method === 'CARD' ? 'CARD' : 'PIX';

    // 1. Buscar o cartão no Firestore
    const db = getWebDb();
    const cardRef = doc(db, 'cards', cardId);
    const cardSnap = await getDoc(cardRef);

    if (!cardSnap.exists()) {
      return NextResponse.json(
        { error: 'Cartão não encontrado no sistema.' },
        { status: 404 }
      );
    }

    const cardData = { id: cardSnap.id, ...cardSnap.data() } as Card;
    if (cardData.status !== 'ATIVO') {
      return NextResponse.json(
        { error: 'Este cartão está bloqueado e não pode receber recargas.' },
        { status: 400 }
      );
    }

    // 2. Cálculo exato da Recarga Líquida + Taxa Online de 5%
    const valorRecargaCentavos = Math.round(numericReais * 100);
    const taxaCentavos = Math.round(valorRecargaCentavos * 0.05);
    const valorTotalCobradoCentavos = valorRecargaCentavos + taxaCentavos;
    const grossValueReais = Number((valorTotalCobradoCentavos / 100).toFixed(2));

    // 3. Buscar ou criar o cliente no Asaas (sem notificações SMS/WhatsApp pagas do Asaas)
    const customerName =
      (payerName && payerName.trim()) ||
      cardData.nome_cliente ||
      'Cliente Festa Novo Amanhecer';

    const asaasCustomer = await findOrCreateAsaasCustomer({
      name: customerName,
      cpfCnpj: cleanCpfCnpj,
      phone: cardData.telefone_cliente,
      externalReference: cardData.id,
    });

    // 4. Criar a cobrança no Asaas (Apenas PIX ou CREDIT_CARD 1x à vista - sem installmentCount)
    const billingType = chosenMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD';
    const description = `Recarga FestaPay (${cardData.nome_cliente || cardData.qr_code_id}) - Credito no cartao: ${formatCurrency(valorRecargaCentavos)} (+5% taxa online)`;

    const payment = await createAsaasRechargePayment({
      customerId: asaasCustomer.id,
      billingType,
      valueReais: grossValueReais,
      description,
      externalReference: `festapay_card_${cardData.id}`,
    });

    // 5. Se for PIX, buscar o QR Code e Copia e Cola imediatamente
    let pixQrCodeBase64: string | null = null;
    let pixCopyPaste: string | null = null;

    if (chosenMethod === 'PIX') {
      const pixData = await getAsaasPixQrCode(payment.id);
      pixQrCodeBase64 = pixData.encodedImage;
      pixCopyPaste = pixData.payload;
    }

    // 6. Salvar registro de auditoria e controle de idempotência em `online_recharges/{payment.id}`
    const now = Timestamp.now();
    await setDoc(doc(db, 'online_recharges', payment.id), {
      cartao_id: cardData.id,
      qr_code_id: cardData.qr_code_id,
      nome_cliente: customerName,
      cpf_cliente: cleanCpfCnpj,
      valor_recarga_centavos: valorRecargaCentavos,
      taxa_centavos: taxaCentavos,
      valor_total_cobrado_centavos: valorTotalCobradoCentavos,
      metodo: chosenMethod,
      asaas_payment_id: payment.id,
      asaas_customer_id: asaasCustomer.id,
      asaas_status: payment.status || 'PENDING',
      invoice_url: payment.invoiceUrl || null,
      pix_qr_base64: pixQrCodeBase64,
      pix_copy_paste: pixCopyPaste,
      status: 'PENDING',
      created_at: now,
      tenant_id: cardData.tenant_id ?? null,
      event_id: cardData.event_id ?? null,
    });

    return NextResponse.json({
      paymentId: payment.id,
      method: chosenMethod,
      netAmountCents: valorRecargaCentavos,
      feeCents: taxaCentavos,
      totalChargedCents: valorTotalCobradoCentavos,
      pixQrCodeBase64,
      pixCopyPaste,
      invoiceUrl: payment.invoiceUrl || null,
    });
  } catch (error: unknown) {
    console.error('[API /api/asaas/recharge] Erro ao gerar recarga online:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível gerar a cobrança agora. Tente novamente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
