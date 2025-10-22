'use server';

import { z } from 'zod';
import {
  findCardByQrCodeId,
  updateCardBalance,
  createTransaction,
  getSalesReport,
  generateRandomId,
} from './data';
import { summarizeSalesReport } from '@/ai/flows/sales-report-summarization';

// HACK: FIPEabase services are not available in server components yet
// We will replace this with a proper admin SDK implementation later
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);


export type ActionState = {
  status: 'success' | 'error';
  message: string;
  data?: any;
};

// --- Card Creation ---
const CreateCardSchema = z.object({
  saldo_inicial: z.coerce.number().min(0, 'Valor deve ser positivo.'),
  nome_cliente: z.string().optional(),
  telefone_cliente: z.string().optional(),
});

export async function createCard(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const validatedFields = CreateCardSchema.safeParse({
      saldo_inicial: formData.get('saldo_inicial'),
      nome_cliente: formData.get('nome_cliente'),
      telefone_cliente: formData.get('telefone_cliente'),
    });

    if (!validatedFields.success) {
      return {
        status: 'error',
        message: 'Dados inválidos.',
        data: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { saldo_inicial, nome_cliente, telefone_cliente } = validatedFields.data;
    const saldo_centavos = saldo_inicial * 100;
    const qr_code_id = `festa-2025-${generateRandomId().slice(0, 18)}`;

    const cardData = {
        qr_code_id: qr_code_id,
        saldo_centavos: saldo_centavos,
        nome_cliente: nome_cliente ?? '',
        telefone_cliente: telefone_cliente ?? '',
        status: 'ATIVO',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "cards"), cardData);

    //TODO: create transaction should also write to firestore
    if (saldo_centavos > 0) {
        // createTransaction({
        //     cartao_id: docRef.id,
        //     pdv_id: 1, // Caixa Central
        //     tipo: 'RECARGA',
        //     valor_centavos: saldo_centavos,
        // });
    }

    return {
      status: 'success',
      message: 'Cartão criado com sucesso!',
      data: {
        id: docRef.id,
        ...cardData,
      },
    };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { status: 'error', message: `Erro ao criar cartão: ${errorMessage}` };
  }
}

// --- Recharge ---
const RechargeSchema = z.object({
  qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
  valor_recarga: z.coerce.number().positive('Valor da recarga deve ser positivo.'),
});

export async function rechargeCard(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const validatedFields = RechargeSchema.safeParse({
      qr_code_id: formData.get('qr_code_id'),
      valor_recarga: formData.get('valor_recarga'),
    });

    if (!validatedFields.success) {
      return {
        status: 'error',
        message: 'Dados inválidos.',
        data: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { qr_code_id, valor_recarga } = validatedFields.data;
    const card = findCardByQrCodeId(qr_code_id);

    if (!card) {
      return { status: 'error', message: 'Cartão não encontrado.' };
    }
    if (card.status !== 'ATIVO') {
      return { status: 'error', message: `Cartão com status ${card.status}` };
    }

    const valor_recarga_centavos = valor_recarga * 100;
    const novo_saldo_centavos = card.saldo_centavos + valor_recarga_centavos;

    updateCardBalance(card.id, novo_saldo_centavos);
    createTransaction({
      cartao_id: card.id,
      pdv_id: 1, // Caixa Central
      tipo: 'RECARGA',
      valor_centavos: valor_recarga_centavos,
    });

    return {
      status: 'success',
      message: 'Recarga efetuada com sucesso!',
      data: { novo_saldo_centavos },
    };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao recarregar.' };
  }
}

// --- Sale ---
const SaleSchema = z.object({
    qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
    valor_venda: z.coerce.number().positive('Valor da venda deve ser positivo.'),
    pdv_id: z.coerce.number().min(1, 'Ponto de Venda é obrigatório.')
});

export async function processSale(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const validatedFields = SaleSchema.safeParse({
            qr_code_id: formData.get('qr_code_id'),
            valor_venda: formData.get('valor_venda'),
            pdv_id: formData.get('pdv_id'),
        });

        if (!validatedFields.success) {
            return {
              status: 'error',
              message: 'Dados inválidos.',
              data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { qr_code_id, valor_venda, pdv_id } = validatedFields.data;
        const card = findCardByQrCodeId(qr_code_id);

        if (!card) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        if (card.status !== 'ATIVO') {
            return { status: 'error', message: `Cartão com status ${card.status}` };
        }

        const valor_venda_centavos = valor_venda * 100;

        if(card.saldo_centavos < valor_venda_centavos) {
            return { status: 'error', message: 'Saldo insuficiente.' };
        }

        const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;

        updateCardBalance(card.id, novo_saldo_centavos);
        createTransaction({
            cartao_id: card.id,
            pdv_id: pdv_id,
            tipo: 'VENDA',
            valor_centavos: valor_venda_centavos,
        });

        return {
            status: 'success',
            message: 'Venda aprovada!',
            data: { novo_saldo_centavos }
        }

    } catch (error) {
        console.error(error);
        return { status: 'error', message: 'Erro ao processar venda.' };
    }
}


// --- AI Summary ---
export async function generateSummary(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const salesData = getSalesReport();
        
        if (salesData.total_vendido_centavos === 0 && salesData.total_recarregado_centavos === 0) {
            return {
                status: 'success',
                message: 'Nenhuma venda registrada para gerar o relatório.',
                data: { summary: "Não há dados de vendas ou recargas para gerar um resumo. Realize algumas transações e tente novamente."}
            }
        }
        
        const summaryResponse = await summarizeSalesReport({ salesData });

        return {
            status: 'success',
            message: 'Relatório gerado.',
            data: { summary: summaryResponse.summary }
        };

    } catch(error) {
        console.error(error);
        return { status: 'error', message: 'Erro ao gerar relatório com IA.' };
    }
}
