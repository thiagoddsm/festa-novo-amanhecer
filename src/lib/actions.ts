'use server';

import { z } from 'zod';
import { generateRandomId } from './data';
import { initializeApp, getApps, getApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Card, Order, Transaction, OrderItem } from './definitions';
import { notifyCardCreation, notifyRecharge, notifySale, notifyCustomMessage } from './flows/notify-flow';
import { notifyOrderReady } from './flows/notify-order-flow';
import { formatCurrency } from './utils';


// Helper to ensure Firebase Admin is initialized only once
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
   // This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
  return initializeApp({
    credential: applicationDefault(),
  });
}

const adminApp = getAdminApp();
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);


export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  data?: any;
};

// --- Card Creation ---
const CreateCardSchema = z.object({
  saldo_inicial: z.coerce.number().min(0, 'Valor deve ser positivo.'),
  nome_cliente: z.string().optional(),
  telefone_cliente: z.string().min(1, 'O telefone é obrigatório.'),
  usuario_responsavel: z.string().min(1, 'Usuário responsável é obrigatório.'),
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
      usuario_responsavel: formData.get('usuario_responsavel'),
    });

    if (!validatedFields.success) {
      return {
        status: 'error',
        message: 'Dados inválidos.',
        data: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { saldo_inicial, nome_cliente, telefone_cliente, usuario_responsavel } = validatedFields.data;
    const saldo_centavos = saldo_inicial * 100;
    const qr_code_id = `festa-2025-${generateRandomId().slice(0, 18)}`;

    const cardData = {
        qr_code_id: qr_code_id,
        saldo_centavos: saldo_centavos,
        nome_cliente: nome_cliente ?? '',
        telefone_cliente: telefone_cliente ?? '',
        status: 'ATIVO',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
    };

    const cardDocRef = db.collection("cards").doc();
    
    // We create the card first
    await cardDocRef.set(cardData);

    // Then, if there's an initial balance, we create the transaction
    if (saldo_centavos > 0) {
        const transactionRef = db.collection("transactions").doc();
        await transactionRef.set({
            cartao_id: cardDocRef.id,
            pdv_id: 'caixa_central', // Caixa Central
            tipo: 'RECARGA',
            valor_centavos: saldo_centavos,
            created_at: Timestamp.now(),
            usuario_responsavel: usuario_responsavel,
        });
    }

     // Trigger notification flow (non-blocking), now with QR code image enabled.
    notifyCardCreation(cardDocRef.id).catch(console.error);

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

// --- Card Details Update ---
const UpdateCardDetailsSchema = z.object({
    cardId: z.string().min(1, 'ID do cartão é obrigatório.'),
    nome_cliente: z.string().optional(),
    telefone_cliente: z.string().min(1, 'O telefone é obrigatório.'),
});

export async function updateCardDetails(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const validatedFields = UpdateCardDetailsSchema.safeParse({
            cardId: formData.get('cardId'),
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

        const { cardId, nome_cliente, telefone_cliente } = validatedFields.data;

        const cardRef = db.collection('cards').doc(cardId);
        await cardRef.update({
            nome_cliente: nome_cliente ?? '',
            telefone_cliente: telefone_cliente,
            updated_at: Timestamp.now(),
        });
        
        return { status: 'success', message: 'Dados do cartão atualizados.' };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao atualizar cartão: ${errorMessage}` };
    }
}


// --- Recharge ---
const RechargeSchema = z.object({
  qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
  valor_recarga: z.coerce.number().positive('Valor da recarga deve ser positivo.'),
  usuario_responsavel: z.string().min(1, 'Usuário responsável é obrigatório.'),
});

export async function rechargeCard(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const validatedFields = RechargeSchema.safeParse({
      qr_code_id: formData.get('qr_code_id'),
      valor_recarga: formData.get('valor_recarga'),
      usuario_responsavel: formData.get('usuario_responsavel'),
    });

    if (!validatedFields.success) {
      return {
        status: 'error',
        message: 'Dados inválidos.',
        data: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { qr_code_id, valor_recarga, usuario_responsavel } = validatedFields.data;
    
    const cardsRef = db.collection('cards');
    const q = cardsRef.where('qr_code_id', '==', qr_code_id);
    const querySnapshot = await q.get();

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

    const cardDocRef = db.collection('cards').doc(cardDoc.id);
    
    const batch = db.batch();
    
    batch.update(cardDocRef, {
        saldo_centavos: novo_saldo_centavos,
        updated_at: Timestamp.now()
    });

    const transactionRef = db.collection("transactions").doc();
    batch.set(transactionRef, {
      cartao_id: cardDoc.id,
      pdv_id: 'caixa_central', // Caixa Central
      tipo: 'RECARGA',
      valor_centavos: valor_recarga_centavos,
      created_at: Timestamp.now(),
      usuario_responsavel: usuario_responsavel,
    });
    
    await batch.commit();

    // Trigger notification flow (non-blocking)
    notifyRecharge(cardDoc.id, valor_recarga_centavos).catch(console.error);

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
const SaleItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    observation: z.string().optional(),
    ingredientes: z.array(z.string()).optional(),
});

const SaleSchema = z.object({
    qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
    pdv_id: z.string().min(1, 'Ponto de Venda é obrigatório.'),
    pdv_nome: z.string().min(1, 'Nome do Ponto de Venda é obrigatório.'),
    items: z.array(SaleItemSchema).min(1, "O carrinho está vazio."),
    total_venda: z.coerce.number().positive('Valor da venda deve ser positivo.'),
    usuario_responsavel: z.string().min(1, 'Usuário responsável é obrigatório.'),
});

export async function processSale(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const items = JSON.parse(formData.get('items') as string);
        const total_venda = parseFloat(formData.get('total_venda') as string);

        const validatedFields = SaleSchema.safeParse({
            qr_code_id: formData.get('qr_code_id'),
            pdv_id: formData.get('pdv_id'),
            pdv_nome: formData.get('pdv_nome'),
            items: items,
            total_venda: total_venda,
            usuario_responsavel: formData.get('usuario_responsavel'),
        });

        if (!validatedFields.success) {
            console.log(validatedFields.error.flatten().fieldErrors);
            return {
              status: 'error',
              message: 'Dados da venda inválidos.',
              data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { qr_code_id, pdv_id, pdv_nome, total_venda: valor_venda_centavos, usuario_responsavel } = validatedFields.data;

        const cardsRef = db.collection('cards');
        const q = cardsRef.where('qr_code_id', '==', qr_code_id);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        
        const cardDoc = querySnapshot.docs[0];
        const card = cardDoc.data() as Card;

        if (card.status !== 'ATIVO') {
            return { status: 'error', message: `Cartão com status ${card.status}` };
        }

        if(card.saldo_centavos < valor_venda_centavos) {
            return { status: 'error', message: 'Saldo insuficiente.' };
        }

        const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;
        
        const batch = db.batch();

        // 1. Update card balance
        const cardDocRef = db.collection('cards').doc(cardDoc.id);
        batch.update(cardDocRef, {
            saldo_centavos: novo_saldo_centavos,
            updated_at: Timestamp.now()
        });
        
        // 2. Create transaction record
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          cartao_id: cardDoc.id,
          pdv_id: pdv_id,
          tipo: 'VENDA',
          valor_centavos: valor_venda_centavos,
          created_at: Timestamp.now(),
          items: validatedFields.data.items, // This now includes observations
          usuario_responsavel: usuario_responsavel,
        });

        // 3. Create order record
        const orderRef = db.collection('orders').doc();
        const orderId = orderRef.id;
        batch.set(orderRef, {
            pdv_id: pdv_id,
            pdv_nome: pdv_nome,
            transaction_id: transactionRef.id,
            cliente_nome: card.nome_cliente || 'Cliente',
            status: 'EM_PREPARO', // Initial status
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            items: validatedFields.data.items, // This now includes observations
            order_number: `#${orderId.substring(0, 4).toUpperCase()}`,
        });

        await batch.commit();

        // Trigger notification flow (non-blocking)
        notifySale(cardDoc.id, valor_venda_centavos, pdv_nome).catch(console.error);


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

// --- Transaction Reversal ---
export async function reverseTransaction(transactionId: string, responsibleUser: string): Promise<ActionState> {
    try {
        const txRef = db.collection('transactions').doc(transactionId);
        const reversalResult = await db.runTransaction(async (t) => {
            // --- 1. READ PHASE ---
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) {
                throw new Error("Transação original não encontrada.");
            }
            const originalTx = txDoc.data() as Transaction;

            const cardRef = db.collection('cards').doc(originalTx.cartao_id);
            const cardDoc = await t.get(cardRef);
            if (!cardDoc.exists) {
                throw new Error("Cartão associado não encontrado.");
            }
            const cardData = cardDoc.data() as Card;

            const reversalsQuery = db.collection('transactions').where('reversed_tx_id', '==', transactionId);
            const reversalsSnapshot = await t.get(reversalsQuery);
            
            let orderToCancelRef: FirebaseFirestore.DocumentReference | null = null;
            if (originalTx.tipo === 'VENDA') {
                const ordersQuery = db.collection('orders').where('transaction_id', '==', transactionId).limit(1);
                const ordersSnapshot = await t.get(ordersQuery);
                if (!ordersSnapshot.empty) {
                    orderToCancelRef = ordersSnapshot.docs[0].ref;
                }
            }
            
            // --- 2. VALIDATION PHASE ---
            if (originalTx.tipo === 'REEMBOLSO') {
                throw new Error("Não é possível estornar um estorno.");
            }
            if (!reversalsSnapshot.empty) {
                throw new Error("Esta transação já foi estornada.");
            }

            let newBalance;
            if (originalTx.tipo === 'VENDA') {
                newBalance = cardData.saldo_centavos + originalTx.valor_centavos;
            } else if (originalTx.tipo === 'RECARGA') {
                newBalance = cardData.saldo_centavos - originalTx.valor_centavos;
                if (newBalance < 0) {
                    throw new Error("Estornar esta recarga resultaria em saldo negativo.");
                }
            } else {
                 throw new Error(`Tipo de transação '${originalTx.tipo}' não suporta estorno.`);
            }

            // --- 3. WRITE PHASE ---
            t.update(cardRef, { saldo_centavos: newBalance, updated_at: Timestamp.now() });

            if (orderToCancelRef) {
                t.update(orderToCancelRef, { status: 'CANCELADO', updated_at: Timestamp.now() });
            }

            const reversalTxRef = db.collection('transactions').doc();
            const reversalData: Omit<Transaction, 'id'> = {
                cartao_id: originalTx.cartao_id,
                pdv_id: originalTx.pdv_id,
                tipo: 'REEMBOLSO',
                valor_centavos: originalTx.valor_centavos,
                created_at: Timestamp.now(),
                usuario_responsavel: responsibleUser,
                reversed_tx_id: transactionId,
                items: originalTx.items || [],
            };
            t.set(reversalTxRef, reversalData);

            return { newBalance };
        });

        return { status: 'success', message: 'Transação estornada com sucesso!', data: { novo_saldo_centavos: reversalResult.newBalance } };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao estornar: ${errorMessage}` };
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
        
        const cardsRef = db.collection('cards');
        const q = cardsRef.where('qr_code_id', '==', qr_code_id);
        
        const querySnapshot = await q.get();
        
        if (querySnapshot.empty) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        
        const cardDoc = querySnapshot.docs[0];
        const cardData = cardDoc.data() as Card;

        const returnData = {
          ...cardData,
          id: cardDoc.id,
          created_at: cardData.created_at ? (cardData.created_at as unknown as Timestamp).toDate().toISOString() : new Date().toISOString(),
          updated_at: cardData.updated_at ? (cardData.updated_at as unknown as Timestamp).toDate().toISOString() : new Date().toISOString(),
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


// --- Balance Transfer ---
const TransferBalanceSchema = z.object({
    origin_qr_code_id: z.string().min(1, 'ID do cartão de origem é obrigatório.'),
    destination_qr_code_id: z.string().min(1, 'ID do cartão de destino é obrigatório.'),
    valor_transferencia: z.coerce.number().positive('O valor deve ser positivo.'),
    usuario_responsavel: z.string().min(1, 'Usuário responsável é obrigatório.'),
}).refine(data => data.origin_qr_code_id !== data.destination_qr_code_id, {
    message: 'O cartão de origem e destino não podem ser os mesmos.',
    path: ['destination_qr_code_id'],
});

export async function transferBalance(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
    try {
        const validatedFields = TransferBalanceSchema.safeParse(Object.fromEntries(formData.entries()));

        if (!validatedFields.success) {
            return {
                status: 'error',
                message: 'Dados inválidos.',
                data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { origin_qr_code_id, destination_qr_code_id, valor_transferencia, usuario_responsavel } = validatedFields.data;
        const valor_centavos = valor_transferencia * 100;

        const result = await db.runTransaction(async (t) => {
            // Get origin card
            const originCardsQuery = db.collection('cards').where('qr_code_id', '==', origin_qr_code_id).limit(1);
            const originSnapshot = await t.get(originCardsQuery);
            if (originSnapshot.empty) throw new Error('Cartão de origem não encontrado.');
            const originCardDoc = originSnapshot.docs[0];
            const originCard = originCardDoc.data() as Card;

            // Get destination card
            const destCardsQuery = db.collection('cards').where('qr_code_id', '==', destination_qr_code_id).limit(1);
            const destSnapshot = await t.get(destCardsQuery);
            if (destSnapshot.empty) throw new Error('Cartão de destino não encontrado.');
            const destCardDoc = destSnapshot.docs[0];
            const destCard = destCardDoc.data() as Card;

            // Check if origin has enough balance
            if (originCard.saldo_centavos < valor_centavos) {
                throw new Error('Saldo insuficiente no cartão de origem.');
            }

            // Update balances
            const newOriginBalance = originCard.saldo_centavos - valor_centavos;
            const newDestBalance = destCard.saldo_centavos + valor_centavos;

            t.update(originCardDoc.ref, { saldo_centavos: newOriginBalance, updated_at: Timestamp.now() });
            t.update(destCardDoc.ref, { saldo_centavos: newDestBalance, updated_at: Timestamp.now() });

            // Create transaction for origin
            const originTxRef = db.collection('transactions').doc();
            t.set(originTxRef, {
                cartao_id: originCardDoc.id,
                pdv_id: 'caixa_central',
                tipo: 'TRANSFER_OUT',
                valor_centavos: valor_centavos,
                created_at: Timestamp.now(),
                usuario_responsavel,
            });

            // Create transaction for destination
            const destTxRef = db.collection('transactions').doc();
            t.set(destTxRef, {
                cartao_id: destCardDoc.id,
                pdv_id: 'caixa_central',
                tipo: 'TRANSFER_IN',
                valor_centavos: valor_centavos,
                created_at: Timestamp.now(),
                usuario_responsavel,
            });

            return { newOriginBalance, newDestBalance };
        });

        return {
            status: 'success',
            message: `Transferência de ${formatCurrency(valor_centavos)} realizada com sucesso!`,
            data: result
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro na transferência: ${errorMessage}` };
    }
}


// --- PDV / Menu ---
export async function getPdvNameById(pdvId: string): Promise<string> {
    if (pdvId === 'caixa_central') return 'Caixa Central';
    const pdvRef = db.collection('pdvs').doc(pdvId);
    const pdvSnap = await pdvRef.get();
    if (pdvSnap.exists) {
        return (pdvSnap.data() as any).nome;
    }
    return `PDV ID: ${pdvId}`;
}

const MenuItemSchema = z.object({
  nome: z.string().min(1, 'Nome do item é obrigatório.'),
  preco_reais: z.coerce.number().positive('Preço deve ser positivo.'),
  ingredientes: z.string().optional(),
  pdvId: z.string(),
  itemId: z.string().optional(),
});

export async function addMenuItem( prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    ingredientes: formData.get('ingredientes'),
    pdvId: formData.get('pdvId'),
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    const { nome, preco_reais, ingredientes, pdvId } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    const ingredientesList = ingredientes ? ingredientes.split(',').map(i => i.trim()).filter(Boolean) : [];
    
    const menuItemsCollection = db.collection('pdvs').doc(pdvId).collection('menuItems');
    await menuItemsCollection.add({ nome, preco_centavos, ingredientes: ingredientesList });

    return { status: 'success', message: 'Item adicionado com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao adicionar item.' };
  }
}

export async function updateMenuItem(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    ingredientes: formData.get('ingredientes'),
    pdvId: formData.get('pdvId'),
    itemId: formData.get('itemId'),
  });

  if (!validatedFields.success || !validatedFields.data.itemId) {
    return { status: 'error', message: 'Dados inválidos para atualização.' };
  }
  
  try {
    const { nome, preco_reais, ingredientes, pdvId, itemId } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    const ingredientesList = ingredientes ? ingredientes.split(',').map(i => i.trim()).filter(Boolean) : [];

    const itemRef = db.collection('pdvs').doc(pdvId).collection('menuItems').doc(itemId);
    await itemRef.update({ nome, preco_centavos, ingredientes: ingredientesList });

    return { status: 'success', message: 'Item atualizado com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao atualizar item.' };
  }
}

export async function deleteMenuItem(pdvId: string, itemId: string): Promise<ActionState> {
  if (!pdvId || !itemId) {
    return { status: 'error', message: 'IDs inválidos.' };
  }

  try {
    const itemRef = db.collection('pdvs').doc(pdvId).collection('menuItems').doc(itemId);
    await itemRef.delete();

    return { status: 'success', message: 'Item excluído com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao excluir item.' };
  }
}

// --- Order Status ---
const UpdateOrderStatusSchema = z.object({
  orderId: z.string(),
  newStatus: z.enum(['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO']),
});

export async function updateOrderStatus(orderId: string, newStatus: Order['status']): Promise<ActionState> {
    const validated = UpdateOrderStatusSchema.safeParse({ orderId, newStatus });

    if (!validated.success) {
        return { status: 'error', message: 'Dados inválidos para atualizar o pedido.'};
    }

    try {
        const orderRef = db.collection('orders').doc(validated.data.orderId);
        await orderRef.update({
            status: validated.data.newStatus,
            updated_at: Timestamp.now(),
        });
        
        // If the order is ready, trigger a notification
        if (validated.data.newStatus === 'PRONTO') {
            notifyOrderReady(validated.data.orderId).catch(console.error);
        }

        return { status: 'success', message: 'Status do pedido atualizado.' };
    } catch (error) {
        console.error("Error updating order status:", error);
        return { status: 'error', message: 'Não foi possível atualizar o status do pedido.' };
    }
}


// --- Bulk Whatsapp ---
const BulkNotificationSchema = z.object({
  message: z.string().min(1, 'A mensagem não pode estar vazia.'),
});

export async function sendBulkNotification(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const validatedFields = BulkNotificationSchema.safeParse({
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Mensagem inválida.' };
  }
  
  const { message } = validatedFields.data;

  try {
    const cardsSnapshot = await db.collection('cards').get();
    if (cardsSnapshot.empty) {
      return { status: 'error', message: 'Nenhum cartão cadastrado para notificar.' };
    }

    const phoneNumbers = new Set<string>();
    cardsSnapshot.forEach(doc => {
      const card = doc.data() as Card;
      if (card.telefone_cliente) {
        phoneNumbers.add(card.telefone_cliente);
      }
    });

    if (phoneNumbers.size === 0) {
        return { status: 'error', message: 'Nenhum número de telefone encontrado nos cartões cadastrados.' };
    }
    
    // Non-blocking notifications
    let successCount = 0;
    const promises = Array.from(phoneNumbers).map(number => 
        notifyCustomMessage(number, message)
            .then(() => successCount++)
            .catch(e => console.error(`Failed to send to ${number}:`, e))
    );

    await Promise.allSettled(promises);

    return { 
        status: 'success', 
        message: `Notificações enviadas. ${successCount} de ${phoneNumbers.size} tiveram sucesso.` 
    };

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { status: 'error', message: `Erro ao enviar notificações: ${errorMessage}` };
  }
}


// --- Bulk Deletion ---
export async function deleteCards(cardIds: string[]): Promise<ActionState> {
    if (!cardIds || cardIds.length === 0) {
        return { status: 'error', message: 'Nenhum cartão selecionado.' };
    }
    try {
        const batch = db.batch();
        cardIds.forEach(id => {
            const docRef = db.collection('cards').doc(id);
            batch.delete(docRef);
        });
        await batch.commit();
        return { status: 'success', message: `${cardIds.length} cartão(ões) excluído(s) com sucesso.` };
    } catch (error) {
        console.error("Error deleting cards:", error);
        return { status: 'error', message: 'Erro ao excluir cartões.' };
    }
}

export async function deleteTransactions(transactionIds: string[]): Promise<ActionState> {
    if (!transactionIds || transactionIds.length === 0) {
        return { status: 'error', message: 'Nenhuma transação selecionada.' };
    }

    try {
        const batch = db.batch();
        
        // Find associated orders to delete them as well
        const ordersRef = db.collection('orders');
        const ordersQuery = ordersRef.where('transaction_id', 'in', transactionIds);
        const ordersSnapshot = await ordersQuery.get();

        ordersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete the transactions themselves
        transactionIds.forEach(id => {
            const docRef = db.collection('transactions').doc(id);
            batch.delete(docRef);
        });

        await batch.commit();
        return { 
            status: 'success', 
            message: `${transactionIds.length} transação(ões) e ${ordersSnapshot.size} pedido(s) associado(s) foram excluído(s) com sucesso.` 
        };
    } catch (error) {
        console.error("Error deleting transactions:", error);
        return { status: 'error', message: 'Erro ao excluir transações e pedidos associados.' };
    }
}
 
export async function createUser(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
    const UserSchema = z.object({
        email: z.string().email('Email inválido.'),
        password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
        name: z.string().min(1, 'O nome é obrigatório.'),
        role: z.enum(['ADMIN', 'CAIXA', 'PDV'], { required_error: 'A função é obrigatória.' }),
        pdvId: z.string().optional(),
    }).refine(data => data.role !== 'PDV' || !!data.pdvId, {
        message: "PDV é obrigatório para a função PDV",
        path: ["pdvId"],
    });

    const validatedFields = UserSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { status: 'error', message: 'Dados inválidos.', data: validatedFields.error.flatten().fieldErrors };
    }

    const { email, password, name, role, pdvId } = validatedFields.data;

    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
        });

        await auth.setCustomUserClaims(userRecord.uid, { role });

        const userProfile = {
            name,
            email,
            role,
            pdvId: role === 'PDV' ? pdvId : null,
        };

        await db.collection('users').doc(userRecord.uid).set(userProfile);

        return { status: 'success', message: 'Usuário criado com sucesso!' };

    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            return { status: 'error', message: 'Este email já está em uso.' };
        }
        return { status: 'error', message: 'Erro ao criar usuário.' };
    }
}
