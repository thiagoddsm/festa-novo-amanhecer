'use server';

import { z } from 'zod';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Card, Order, Transaction, OrderItem } from './definitions';
import { notifySale, notifyCustomMessage, notifyReversal } from './flows/notify-flow';
import { notifyOrderReady } from './flows/notify-order-flow';

function getDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return new Firestore();
}

function getFirebaseAuth() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getAuth();
}


export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  data?: any;
};

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
    const db = getDb();
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
    tenant_id: z.string().optional(),
    event_id: z.string().optional(),
});

export async function processSale(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    const db = getDb();
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
            tenant_id: formData.get('tenant_id') || undefined,
            event_id: formData.get('event_id') || undefined,
        });

        if (!validatedFields.success) {
            console.log(validatedFields.error.flatten().fieldErrors);
            return {
              status: 'error',
              message: 'Dados da venda inválidos.',
              data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { qr_code_id, pdv_id, pdv_nome, total_venda: valor_venda_centavos, usuario_responsavel, tenant_id, event_id } = validatedFields.data;

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
          tenant_id: tenant_id || null,
          event_id: event_id || null,
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
            tenant_id: tenant_id || null,
            event_id: event_id || null,
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
    const db = getDb();
    try {
        const reversalResult = await db.runTransaction(async (t) => {
            // --- 1. READ PHASE ---
            const txRef = db.collection('transactions').doc(transactionId);
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
             const reversalData: Partial<Transaction> = {
                cartao_id: originalTx.cartao_id,
                pdv_id: originalTx.pdv_id,
                tipo: 'REEMBOLSO',
                valor_centavos: originalTx.valor_centavos,
                created_at: Timestamp.now() as any,
                usuario_responsavel: responsibleUser,
                reversed_tx_id: transactionId,
                items: originalTx.items || [],
            };
            t.set(reversalTxRef, reversalData);

            return { newBalance, cardId: cardData.id, reversalAmount: originalTx.valor_centavos };
        });

        // Trigger notification flow (non-blocking)
        notifyReversal(reversalResult.cardId, reversalResult.reversalAmount).catch(console.error);

        return { status: 'success', message: 'Transação estornada com sucesso!', data: { novo_saldo_centavos: reversalResult.newBalance } };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao estornar: ${errorMessage}` };
    }
}

// --- PDV / Menu ---
export async function getPdvNameById(pdvId: string): Promise<string> {
    const db = getDb();
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
  const db = getDb();
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
  const db = getDb();
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
  const db = getDb();
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

// --- PDV Management ---
const CreatePdvSchema = z.object({
  nome: z.string().min(1, 'Nome do PDV é obrigatório.'),
  tenant_id: z.string().optional(),
  event_id: z.string().optional(),
});

export async function createPdv(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getDb();
  const validated = CreatePdvSchema.safeParse({
    nome: formData.get('nome'),
    tenant_id: formData.get('tenant_id') || undefined,
    event_id: formData.get('event_id') || undefined,
  });

  if (!validated.success) {
    return { status: 'error', message: 'Nome inválido.' };
  }

  try {
    const { nome, tenant_id, event_id } = validated.data;
    const pdvRef = await db.collection('pdvs').add({
      nome,
      tenant_id: tenant_id || null,
      event_id: event_id || null,
      created_at: Timestamp.now(),
    });

    return { status: 'success', message: `PDV "${nome}" criado com sucesso!`, data: { id: pdvRef.id } };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao criar PDV.' };
  }
}

export async function updatePdv(pdvId: string, nome: string): Promise<ActionState> {
  const db = getDb();
  if (!pdvId || !nome.trim()) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    await db.collection('pdvs').doc(pdvId).update({
      nome: nome.trim(),
      updated_at: Timestamp.now(),
    });
    return { status: 'success', message: 'PDV atualizado com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao atualizar PDV.' };
  }
}

export async function deletePdv(pdvId: string): Promise<ActionState> {
  const db = getDb();
  if (!pdvId) {
    return { status: 'error', message: 'ID inválido.' };
  }

  try {
    // Delete all menu items inside pdv
    const menuItemsSnap = await db.collection('pdvs').doc(pdvId).collection('menuItems').get();
    const batch = db.batch();
    menuItemsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.collection('pdvs').doc(pdvId));
    await batch.commit();

    return { status: 'success', message: 'PDV e seu cardápio excluídos com sucesso!' };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao excluir PDV.' };
  }
}

export async function seedDefaultPdvs(tenantId: string, eventId: string): Promise<ActionState> {
  const db = getDb();
  if (!tenantId || !eventId) {
    return { status: 'error', message: 'Organização e Evento são obrigatórios para inicializar barracas.' };
  }

  try {
    const defaultPdvs = [
      {
        nome: 'Barraca de Bebidas',
        menu: [
          { nome: 'Refrigerante Lata', preco_centavos: 600, ingredientes: ['Lata 350ml'] },
          { nome: 'Água Mineral', preco_centavos: 400, ingredientes: ['Garrafa 500ml'] },
          { nome: 'Suco Natural', preco_centavos: 800, ingredientes: ['Copo 300ml'] },
          { nome: 'Cerveja Lata', preco_centavos: 800, ingredientes: ['Lata 350ml'] },
        ],
      },
      {
        nome: 'Barraca do Pastel',
        menu: [
          { nome: 'Pastel de Carne', preco_centavos: 1000, ingredientes: ['Carne moída', 'Massa artesanal'] },
          { nome: 'Pastel de Queijo', preco_centavos: 1000, ingredientes: ['Mussarela', 'Orégano'] },
          { nome: 'Pastel de Pizza', preco_centavos: 1200, ingredientes: ['Queijo', 'Presunto', 'Tomate', 'Orégano'] },
          { nome: 'Pastel Doce', preco_centavos: 1000, ingredientes: ['Nutella', 'Banana'] },
        ],
      },
      {
        nome: 'Barraca do Churrasco',
        menu: [
          { nome: 'Espetinho de Carne', preco_centavos: 1200, ingredientes: ['Alcatra', 'Farofa', 'Vinagrete'] },
          { nome: 'Espetinho de Frango', preco_centavos: 1000, ingredientes: ['Peito de frango com bacon'] },
          { nome: 'Espetinho de Linguiça', preco_centavos: 1000, ingredientes: ['Linguiça toscana'] },
          { nome: 'Pão de Alho', preco_centavos: 800, ingredientes: ['Pão com pasta de alho e queijo'] },
        ],
      },
      {
        nome: 'Barraca de Doces',
        menu: [
          { nome: 'Bolo no Pote', preco_centavos: 1000, ingredientes: ['Chocolate', 'Cenoura com brigadeiro'] },
          { nome: 'Brigadeiro Gourmet (Un)', preco_centavos: 400, ingredientes: ['Chocolate nobre'] },
          { nome: 'Churros com Doce de Leite', preco_centavos: 800, ingredientes: ['Açúcar e canela'] },
          { nome: 'Pudim Fatia', preco_centavos: 700, ingredientes: ['Calda de caramelo'] },
        ],
      },
    ];

    for (const pdvData of defaultPdvs) {
      const pdvRef = await db.collection('pdvs').add({
        nome: pdvData.nome,
        tenant_id: tenantId,
        event_id: eventId,
        created_at: Timestamp.now(),
      });

      const menuBatch = db.batch();
      for (const item of pdvData.menu) {
        const itemRef = pdvRef.collection('menuItems').doc();
        menuBatch.set(itemRef, item);
      }
      await menuBatch.commit();
    }

    return { status: 'success', message: '4 barracas padrão e seus cardápios foram criados com sucesso!' };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao inicializar barracas.' };
  }
}

// --- Order Status ---
const UpdateOrderStatusSchema = z.object({
  orderId: z.string(),
  newStatus: z.enum(['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO', 'ARQUIVADO']),
});

export async function updateOrderStatus(orderId: string, newStatus: Order['status']): Promise<ActionState> {
    const db = getDb();
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
  const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
    const auth = getFirebaseAuth();
    const db = getDb();
    const UserSchema = z.object({
        email: z.string().email('Email inválido.'),
        password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
        name: z.string().min(1, 'O nome é obrigatório.'),
        role: z.enum(
            ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO', 'CAIXA', 'PDV'],
            { required_error: 'A função é obrigatória.' },
        ),
        pdvId: z.string().optional(),
        tenantId: z.string().optional(),
        eventId: z.string().optional(),
    }).refine(data => data.role !== 'PDV' || !!data.pdvId, {
        message: "PDV é obrigatório para a função PDV",
        path: ["pdvId"],
    });

    const validatedFields = UserSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return { status: 'error', message: 'Dados inválidos.', data: validatedFields.error.flatten().fieldErrors };
    }

    const { email, password, name, role, pdvId, tenantId, eventId } = validatedFields.data;

    // Build tenant access map when tenantId is provided
    const tenantsMap = tenantId
        ? {
            [tenantId]: {
                role: eventId ? 'CAIXA' : 'ADMIN',
                ...(eventId ? { allowedEventIds: [eventId] } : {}),
            },
          }
        : undefined;

    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
        });

        await auth.setCustomUserClaims(userRecord.uid, { role });

        const userProfile: Record<string, unknown> = {
            name,
            email,
            role,
            pdvId: role === 'PDV' ? (pdvId ?? null) : null,
        };

        if (tenantsMap) {
            userProfile.tenants = tenantsMap;
        }

        await db.collection('users').doc(userRecord.uid).set(userProfile);

        return { status: 'success', message: 'Usuário criado com sucesso!' };

    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            return { status: 'error', message: 'Este email já está em uso.' };
        }
        return { status: 'error', message: 'Erro ao criar usuário.' };
    }
}

