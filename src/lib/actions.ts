'use server';

import { z } from 'zod';
import {
  generateRandomId,
} from './data';
import { summarizeSalesReport } from '@/ai/flows/sales-report-summarization';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, where, query, getDocs, doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import type { Card } from './definitions';

// Helper function to initialize Firebase on the server
function getFirebaseServer() {
  if (getApps().length > 0) {
    return { app: getApp(), db: getFirestore(getApp()) };
  }
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  return { app, db };
}


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
    const { db } = getFirebaseServer();
    const batch = writeBatch(db);

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

    const cardDocRef = doc(collection(db, "cards"));
    batch.set(cardDocRef, cardData);

    if (saldo_centavos > 0) {
        const transactionRef = doc(collection(db, "transactions"));
        batch.set(transactionRef, {
            cartao_id: cardDocRef.id,
            pdv_id: 1, // Caixa Central
            tipo: 'RECARGA',
            valor_centavos: saldo_centavos,
            created_at: serverTimestamp()
        });
    }
    
    await batch.commit();

    const returnData = {
      id: cardDocRef.id,
      qr_code_id: cardData.qr_code_id,
      saldo_centavos: cardData.saldo_centavos,
      nome_cliente: cardData.nome_cliente,
      telefone_cliente: cardData.telefone_cliente,
      status: cardData.status,
    };

    return {
      status: 'success',
      message: 'Cartão criado com sucesso!',
      data: returnData,
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
    const { db } = getFirebaseServer();
    const batch = writeBatch(db);

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
    
    const cardsRef = collection(db, 'cards');
    const q = query(cardsRef, where('qr_code_id', '==', qr_code_id));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { status: 'error', message: 'Cartão não encontrado.' };
    }
        
    const cardDoc = querySnapshot.docs[0];
    const card = cardDoc.data() as Card;

    if (card.status !== 'ATIVO') {
      return { status: 'error', message: `Cartão com status ${card.status}` };
    }

    const valor_recarga_centavos = valor_recarga * 100;
    const novo_saldo_centavos = card.saldo_centavos + valor_recarga_centavos;

    const cardDocRef = doc(db, 'cards', cardDoc.id);
    batch.update(cardDocRef, {
        saldo_centavos: novo_saldo_centavos,
        updated_at: serverTimestamp()
    });

    const transactionRef = doc(collection(db, "transactions"));
    batch.set(transactionRef, {
      cartao_id: cardDoc.id,
      pdv_id: 1, // Caixa Central
      tipo: 'RECARGA',
      valor_centavos: valor_recarga_centavos,
      created_at: serverTimestamp()
    });
    
    await batch.commit();

    return {
      status: 'success',
      message: 'Recarga efetuada com sucesso!',
      data: { novo_saldo_centavos },
    };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { status: 'error', message: `Erro ao recarregar: ${errorMessage}` };
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
        const { db } = getFirebaseServer();
        const batch = writeBatch(db);

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

        const cardsRef = collection(db, 'cards');
        const q = query(cardsRef, where('qr_code_id', '==', qr_code_id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        
        const cardDoc = querySnapshot.docs[0];
        const card = cardDoc.data() as Card;

        if (card.status !== 'ATIVO') {
            return { status: 'error', message: `Cartão com status ${card.status}` };
        }

        const valor_venda_centavos = valor_venda * 100;

        if(card.saldo_centavos < valor_venda_centavos) {
            return { status: 'error', message: 'Saldo insuficiente.' };
        }

        const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;

        const cardDocRef = doc(db, 'cards', cardDoc.id);
        batch.update(cardDocRef, {
            saldo_centavos: novo_saldo_centavos,
            updated_at: serverTimestamp()
        });
        
        const transactionRef = doc(collection(db, "transactions"));
        batch.set(transactionRef, {
          cartao_id: cardDoc.id,
          pdv_id: pdv_id,
          tipo: 'VENDA',
          valor_centavos: valor_venda_centavos,
          created_at: serverTimestamp()
        });

        await batch.commit();

        return {
            status: 'success',
            message: 'Venda aprovada!',
            data: { novo_saldo_centavos }
        }

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao processar venda: ${errorMessage}` };
    }
}


// --- AI Summary ---
export async function generateSummary(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const { db } = getFirebaseServer();
        // TODO: This should be a proper 'use client' component that reads from a hook
        const salesData = await getSalesReportFromFirestore();
        
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

// --- Check Balance ---
const CheckBalanceSchema = z.object({
  qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
});

export async function getCardBalance(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
    try {
        const { db } = getFirebaseServer();
        const validatedFields = CheckBalanceSchema.safeParse({
            qr_code_id: formData.get('qr_code_id'),
        });

        if (!validatedFields.success) {
            return {
                status: 'error',
                message: validatedFields.error.flatten().fieldErrors.qr_code_id?.[0] || 'QR Code ID inválido.',
            };
        }
        
        const { qr_code_id } = validatedFields.data;
        
        const cardsRef = collection(db, 'cards');
        const q = query(cardsRef, where('qr_code_id', '==', qr_code_id));
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        
        const cardDoc = querySnapshot.docs[0];
        const cardData = cardDoc.data() as Card;

        const returnData = {
          ...cardData,
          id: cardDoc.id,
          created_at: cardData.created_at ? (cardData.created_at as Timestamp).toDate().toISOString() : new Date().toISOString(),
          updated_at: cardData.updated_at ? (cardData.updated_at as Timestamp).toDate().toISOString() : new Date().toISOString(),
        }

        return {
            status: 'success',
            message: 'Cartão encontrado.',
            data: returnData
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao consultar saldo: ${errorMessage}` };
    }
}

// --- REPORTING (SERVER-SIDE) ---
async function getSalesReportFromFirestore() {
    const { db } = getFirebaseServer();
    const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
    const allTransactions = transactionsSnapshot.docs.map(doc => doc.data());

    const total_vendido_centavos = allTransactions
        .filter(t => t.tipo === 'VENDA')
        .reduce((sum, t) => sum + t.valor_centavos, 0);

    const total_recarregado_centavos = allTransactions
        .filter(t => t.tipo === 'RECARGA')
        .reduce((sum, t) => sum + t.valor_centavos, 0);

    // This is simplified. A real implementation would fetch PDVs from Firestore as well.
    const pdvs = [
      { id: 2, nome: 'Barraca de Salgados' },
      { id: 3, nome: 'Barraca de Bebidas' },
      { id: 4, nome: 'Food Truck de Burger' },
    ];

    const vendas_por_pdv = pdvs
        .map(pdv => {
            const total_centavos = allTransactions
                .filter(t => t.pdv_id === pdv.id && t.tipo === 'VENDA')
                .reduce((sum, t) => sum + t.valor_centavos, 0);
            return {
                pdv_id: pdv.id,
                nome: pdv.nome,
                total_centavos,
            }
        });

    return { total_vendido_centavos, total_recarregado_centavos, vendas_por_pdv: vendas_por_pdv };
}
