import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import {
  findOrCreateAsaasCustomer,
  createAsaasRechargePayment,
  getAsaasPixQrCode,
} from '@/lib/asaas';
import { formatCurrency, calculateAsaasRechargeFee } from '@/lib/utils';
import { formatWhatsAppNumber } from '@/lib/whatsapp';
import { generateRandomId } from '@/lib/data';

export const dynamic = 'force-dynamic';

const TARGET_TENANT_ID = 'igreja-batista-da-manha';
const TARGET_EVENT_ID = 'DoKmbiQ8pd3M71yTC9iA';

function getWebDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerName,
      phone,
      cpfCnpj,
      initialAmountReais,
      method,
    }: {
      customerName?: string;
      phone?: string;
      cpfCnpj?: string;
      initialAmountReais?: number;
      method?: 'PIX' | 'CARD';
    } = body;

    const trimmedName = (customerName || '').trim();
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: 'Por favor, digite seu nome para identificar o cartão.' },
        { status: 400 }
      );
    }

    const rawPhoneDigits = (phone || '').replace(/\D/g, '');
    if (rawPhoneDigits.length < 10) {
      return NextResponse.json(
        { error: 'Por favor, digite seu celular com DDD (ex: 21 99999-8888).' },
        { status: 400 }
      );
    }
    const normalizedPhone = formatWhatsAppNumber(rawPhoneDigits);

    const cleanCpfCnpj = (cpfCnpj || '').replace(/\D/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      return NextResponse.json(
        { error: 'Por favor, digite um CPF válido (11 números) para emitir o pagamento.' },
        { status: 400 }
      );
    }

    const numericReais = Number(initialAmountReais);
    if (!Number.isFinite(numericReais) || numericReais < 5) {
      return NextResponse.json(
        { error: 'O saldo inicial mínimo para criar o cartão online é de R$ 5,00.' },
        { status: 400 }
      );
    }

    if (numericReais > 2000) {
      return NextResponse.json(
        { error: 'O valor máximo por operação online é de R$ 2.000,00.' },
        { status: 400 }
      );
    }

    const chosenMethod: 'PIX' | 'CARD' = method === 'CARD' ? 'CARD' : 'PIX';

    // 1. Pré-gerar IDs do novo cartão (só será gravado em /cards após confirmação do pagamento!)
    const db = getWebDb();
    const preReservedCardRef = doc(collection(db, 'cards'));
    const cardId = preReservedCardRef.id;
    const qrCodeId = `festa_novo_amanhec-${generateRandomId().slice(0, 16)}`;

    // 2. Cálculo exato do Saldo Inicial + Repasse exato da taxa Asaas
    const rawNetCents = Math.round(numericReais * 100);
    const {
      netCents: valorRecargaCentavos,
      feeCents: taxaCentavos,
      totalChargedCents: valorTotalCobradoCentavos,
    } = calculateAsaasRechargeFee(rawNetCents, chosenMethod);
    const grossValueReais = Number((valorTotalCobradoCentavos / 100).toFixed(2));

    // 3. Buscar ou criar o cliente no Asaas (notificationDisabled: true)
    const asaasCustomer = await findOrCreateAsaasCustomer({
      name: trimmedName,
      cpfCnpj: cleanCpfCnpj,
      phone: normalizedPhone,
      externalReference: cardId,
    });

    // 4. Criar a cobrança no Asaas (PIX ou CREDIT_CARD 1x à vista)
    const billingType = chosenMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD';
    const description = `Novo Cartao FestaPay (${trimmedName} - ${qrCodeId}) - Saldo inicial: ${formatCurrency(valorRecargaCentavos)} (+ taxa operadora ${formatCurrency(taxaCentavos)})`;

    const payment = await createAsaasRechargePayment({
      customerId: asaasCustomer.id,
      billingType,
      valueReais: grossValueReais,
      description,
      externalReference: `festapay_card_${cardId}`,
    });

    // 5. Se for PIX, buscar o QR Code e Copia e Cola imediatamente
    let pixQrCodeBase64: string | null = null;
    let pixCopyPaste: string | null = null;

    if (chosenMethod === 'PIX') {
      const pixData = await getAsaasPixQrCode(payment.id);
      pixQrCodeBase64 = pixData.encodedImage;
      pixCopyPaste = pixData.payload;
    }

    // 6. Salvar pré-reserva em `online_recharges/{payment.id}` com tipo_operacao: 'CREATE_CARD'
    const now = Timestamp.now();
    await setDoc(doc(db, 'online_recharges', payment.id), {
      tipo_operacao: 'CREATE_CARD',
      cartao_id: cardId,
      qr_code_id: qrCodeId,
      nome_cliente: trimmedName,
      telefone_cliente: normalizedPhone,
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
      tenant_id: TARGET_TENANT_ID,
      event_id: TARGET_EVENT_ID,
    });

    return NextResponse.json({
      paymentId: payment.id,
      cardId,
      qrCodeId,
      method: chosenMethod,
      netAmountCents: valorRecargaCentavos,
      feeCents: taxaCentavos,
      totalChargedCents: valorTotalCobradoCentavos,
      pixQrCodeBase64,
      pixCopyPaste,
      invoiceUrl: payment.invoiceUrl || null,
    });
  } catch (error: unknown) {
    console.error('[API /api/asaas/create-card] Erro ao gerar novo cartão online:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Não foi possível gerar o pagamento para o novo cartão agora. Tente novamente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
