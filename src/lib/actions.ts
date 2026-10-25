'use server';

import { z } from 'zod';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Card, Order, Transaction, OrderItem, Pdv, TenantEvent, PdvIngredient, RecipeItem, StockControlType, MenuItem } from './definitions';
import { notifySale, notifyCustomMessage, notifyReversal } from './flows/notify-flow';
import { notifyOrderReady } from './flows/notify-order-flow';
import {
  getPdvInstanceName,
  getEvolutionQrCode,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
  formatWhatsAppNumber,
} from './whatsapp';

import { initializeApp as initClientApp, getApps as getClientApps, getApp as getClientApp } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  doc as clientDoc,
  getDoc as clientGetDoc,
  updateDoc as clientUpdateDoc,
  setDoc as clientSetDoc,
  addDoc as clientAddDoc,
  deleteDoc as clientDeleteDoc,
  writeBatch as clientWriteBatch,
  collection as clientCollection,
  getDocs as clientGetDocs,
  query as clientQuery,
  where as clientWhere,
  limit as clientLimit,
  runTransaction as clientRunTransaction,
  Timestamp as ClientTimestamp,
  deleteField as clientDeleteField,
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'fiscalflow-zetbu';

function getWebDb() {
  const app = !getClientApps().length ? initClientApp(firebaseConfig) : getClientApp();
  return getClientFirestore(app);
}

function getFirebaseAuth() {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
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
    const db = getWebDb();
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
        const normalizedPhone = formatWhatsAppNumber(telefone_cliente);

        const cardRef = clientDoc(db, 'cards', cardId);
        await clientUpdateDoc(cardRef, {
            nome_cliente: nome_cliente ?? '',
            telefone_cliente: normalizedPhone,
            updated_at: ClientTimestamp.now(),
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
    const db = getWebDb();
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

        // Query card first to get document ID
        const cardsRef = clientCollection(db, 'cards');
        const q = clientQuery(cardsRef, clientWhere('qr_code_id', '==', qr_code_id), clientLimit(1));
        const querySnapshot = await clientGetDocs(q);

        if (querySnapshot.empty) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        
        const cardDoc = querySnapshot.docs[0];
        const cardDocRef = clientDoc(db, 'cards', cardDoc.id);

        // ATOMIC TRANSACTION: guarantees balance & stock consistency under concurrent sales
        const saleResult = await clientRunTransaction(db, async (t) => {
            // --- 1. READ PHASE (All reads must happen before any writes) ---
            const freshCardSnap = await t.get(cardDocRef);
            if (!freshCardSnap.exists()) {
                throw new Error('Cartão não encontrado.');
            }

            const card = freshCardSnap.data() as Card;

            if (card.status !== 'ATIVO') {
                throw new Error(`Cartão com status ${card.status}`);
            }

            if (card.saldo_centavos < valor_venda_centavos) {
                throw new Error('Saldo insuficiente.');
            }

            // Read distinct menu items involved in the sale
            const saleItems = validatedFields.data.items || [];
            const distinctItemIds = Array.from(new Set(saleItems.map(it => it.id)));
            const menuItemDocs = new Map<string, { ref: any; data: MenuItem }>();

            for (const itemId of distinctItemIds) {
                const mRef = clientDoc(db, 'pdvs', pdv_id, 'menuItems', itemId);
                const mSnap = await t.get(mRef);
                if (mSnap.exists()) {
                    menuItemDocs.set(itemId, { ref: mRef, data: mSnap.data() as MenuItem });
                }
            }

            // Calculate stock needs
            const productDeductions = new Map<string, { ref: any; newStock: number }>();
            const ingredientNeeds = new Map<string, { qtyNeeded: number; nome: string }>();

            // Aggregate item quantities
            const itemQuantities = new Map<string, number>();
            for (const it of saleItems) {
                itemQuantities.set(it.id, (itemQuantities.get(it.id) || 0) + it.quantity);
            }

            for (const [itemId, totalQty] of itemQuantities.entries()) {
                const itemInfo = menuItemDocs.get(itemId);
                if (!itemInfo) continue;
                const { ref, data } = itemInfo;

                if (data.stock_control_type === 'PRODUCT') {
                    const currentStock = typeof data.estoque_atual === 'number' ? data.estoque_atual : 0;
                    if (currentStock < totalQty) {
                        throw new Error(`Estoque insuficiente de "${data.nome}". Disponível: ${currentStock}, Solicitado: ${totalQty}.`);
                    }
                    productDeductions.set(itemId, { ref, newStock: currentStock - totalQty });
                }
            }

            // Aggregate ingredient needs per recipe item
            for (const it of saleItems) {
                const itemInfo = menuItemDocs.get(it.id);
                if (!itemInfo) continue;
                const { data } = itemInfo;

                if (data.stock_control_type === 'INGREDIENTS' && data.receita && data.receita.length > 0) {
                    const obs = it.observation || '';
                    const removedMatch = obs.match(/SEM: \[(.*?)\]/);
                    const removedList = removedMatch
                        ? removedMatch[1].split(',').map(s => s.trim().toLowerCase())
                        : [];

                    for (const recipeItem of data.receita) {
                        // Check if ingredient was removed by customer observation
                        const isRemoved = removedList.some(r => r && recipeItem.ingredient_nome.toLowerCase().includes(r));
                        if (isRemoved) continue;

                        const qtyNeededForThis = recipeItem.quantidade * it.quantity;
                        const prev = ingredientNeeds.get(recipeItem.ingredient_id) || { qtyNeeded: 0, nome: recipeItem.ingredient_nome };
                        ingredientNeeds.set(recipeItem.ingredient_id, {
                            qtyNeeded: prev.qtyNeeded + qtyNeededForThis,
                            nome: recipeItem.ingredient_nome,
                        });
                    }
                }
            }

            // Read and validate all required ingredients
            const ingredientDeductions = new Map<string, { ref: any; newQty: number; currentQty: number; nome: string; unidade: string; qtyNeeded: number }>();
            for (const [ingId, need] of ingredientNeeds.entries()) {
                const ingRef = clientDoc(db, 'pdvs', pdv_id, 'ingredients', ingId);
                const ingSnap = await t.get(ingRef);
                if (!ingSnap.exists()) {
                    throw new Error(`Insumo "${need.nome}" não encontrado no PDV.`);
                }
                const ingData = ingSnap.data() as PdvIngredient;
                const currentQty = typeof ingData.quantidade_atual === 'number' ? ingData.quantidade_atual : 0;
                if (currentQty < need.qtyNeeded) {
                    throw new Error(`Estoque insuficiente do insumo "${ingData.nome}". Disponível: ${currentQty} ${ingData.unidade}, Necessário: ${need.qtyNeeded} ${ingData.unidade}.`);
                }
                ingredientDeductions.set(ingId, {
                    ref: ingRef,
                    newQty: currentQty - need.qtyNeeded,
                    currentQty,
                    nome: ingData.nome,
                    unidade: ingData.unidade || 'un',
                    qtyNeeded: need.qtyNeeded,
                });
            }

            // --- 2. WRITE PHASE ---
            const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;
            const now = ClientTimestamp.now();

            const effectiveTenantId = tenant_id || card.tenant_id || null;
            const effectiveEventId = event_id || card.event_id || null;

            // 1. Update card balance
            t.update(cardDocRef, {
                saldo_centavos: novo_saldo_centavos,
                updated_at: now,
            });

            // 2. Decrement PRODUCT stocks
            for (const { ref, newStock } of productDeductions.values()) {
                t.update(ref, { estoque_atual: newStock });
            }

            // 3. Decrement INGREDIENT stocks
            for (const { ref, newQty } of ingredientDeductions.values()) {
                t.update(ref, { quantidade_atual: newQty, updated_at: now });
            }

            // 4. Create transaction record
            const transactionRef = clientDoc(clientCollection(db, 'transactions'));
            t.set(transactionRef, {
                cartao_id: cardDoc.id,
                pdv_id: pdv_id,
                tipo: 'VENDA',
                valor_centavos: valor_venda_centavos,
                created_at: now,
                items: validatedFields.data.items,
                usuario_responsavel: usuario_responsavel,
                tenant_id: effectiveTenantId,
                event_id: effectiveEventId,
            });

            // 5. Create order record
            const orderRef = clientDoc(clientCollection(db, 'orders'));
            const orderId = orderRef.id;
            const orderNumber = `#${orderId.substring(0, 4).toUpperCase()}`;
            t.set(orderRef, {
                pdv_id: pdv_id,
                pdv_nome: pdv_nome,
                transaction_id: transactionRef.id,
                cliente_nome: card.nome_cliente || 'Cliente',
                status: 'EM_PREPARO',
                created_at: now,
                updated_at: now,
                items: validatedFields.data.items,
                order_number: orderNumber,
                tenant_id: effectiveTenantId,
                event_id: effectiveEventId,
            });

            // 6. Audit log for ingredient deductions
            if (ingredientDeductions.size > 0) {
                const logRef = clientDoc(clientCollection(db, 'pdvs', pdv_id, 'ingredient_logs'));
                t.set(logRef, {
                    pdv_id: pdv_id,
                    tipo: 'SAIDA_VENDA',
                    titulo: `Saída por Venda — Pedido ${orderNumber}`,
                    pedido_numero: orderNumber,
                    order_id: orderId,
                    transacao_id: transactionRef.id,
                    cliente_nome: card.nome_cliente || 'Cliente',
                    usuario: usuario_responsavel || 'PDV',
                    itens_vendidos: validatedFields.data.items.map(it => ({
                        nome: it.name,
                        quantidade: it.quantity,
                        observacoes: it.observation || null,
                    })),
                    insumos_alterados: Array.from(ingredientDeductions.entries()).map(([ingId, d]) => ({
                        ingredient_id: ingId,
                        ingredient_nome: d.nome,
                        quantidade_anterior: d.currentQty,
                        quantidade_alterada: -d.qtyNeeded,
                        quantidade_resultante: d.newQty,
                        unidade: d.unidade,
                    })),
                    created_at: now,
                });
            }

            return {
                novo_saldo_centavos,
                cardId: cardDoc.id,
            };
        });

        // Trigger notification flow (non-blocking)
        notifySale(saleResult.cardId, valor_venda_centavos, pdv_nome).catch(console.error);

        return {
            status: 'success',
            message: 'Venda aprovada!',
            data: { novo_saldo_centavos: saleResult.novo_saldo_centavos }
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        return { status: 'error', message: `Erro ao processar venda: ${errorMessage}` };
    }
}

// --- Transaction Reversal ---
export async function reverseTransaction(transactionId: string, responsibleUser: string): Promise<ActionState> {
    const db = getWebDb();
    try {
        // Pre-check 1: Check if this transaction was already reversed
        const reversalsQuery = clientQuery(
            clientCollection(db, 'transactions'),
            clientWhere('reversed_tx_id', '==', transactionId)
        );
        const reversalsSnapshot = await clientGetDocs(reversalsQuery);
        if (!reversalsSnapshot.empty) {
            return { status: 'error', message: 'Esta transação já foi estornada.' };
        }

        // Pre-check 2: Find associated order if it is a sale
        const ordersQuery = clientQuery(
            clientCollection(db, 'orders'),
            clientWhere('transaction_id', '==', transactionId),
            clientLimit(1)
        );
        const ordersSnapshot = await clientGetDocs(ordersQuery);
        const orderToCancelId = !ordersSnapshot.empty ? ordersSnapshot.docs[0].id : null;

        const reversalResult = await clientRunTransaction(db, async (t) => {
            // --- 1. READ PHASE ---
            const txRef = clientDoc(db, 'transactions', transactionId);
            const txDoc = await t.get(txRef);
            if (!txDoc.exists()) {
                throw new Error("Transação original não encontrada.");
            }
            const originalTx = txDoc.data() as Transaction;

            const cardRef = clientDoc(db, 'cards', originalTx.cartao_id);
            const cardDoc = await t.get(cardRef);
            if (!cardDoc.exists()) {
                throw new Error("Cartão associado não encontrado.");
            }
            const cardData = cardDoc.data() as Card;

            let orderToCancelRef: ReturnType<typeof clientDoc> | null = null;
            if (orderToCancelId) {
                orderToCancelRef = clientDoc(db, 'orders', orderToCancelId);
            }

            // Read items & ingredients for stock restoration if reversing a sale
            const productRestorations = new Map<string, { ref: any; newStock: number }>();
            const ingredientRestorations = new Map<string, { ref: any; newQty: number; currentQty: number; delta: number; nome: string; unidade: string }>();

            if (originalTx.tipo === 'VENDA' && originalTx.items && originalTx.items.length > 0) {
                const distinctRestorationItemIds = Array.from(new Set(originalTx.items.map(it => it.id)));
                const restoreMenuItemDocs = new Map<string, { ref: any; data: MenuItem }>();

                for (const itemId of distinctRestorationItemIds) {
                    const mRef = clientDoc(db, 'pdvs', originalTx.pdv_id, 'menuItems', itemId);
                    const mSnap = await t.get(mRef);
                    if (mSnap.exists()) {
                        restoreMenuItemDocs.set(itemId, { ref: mRef, data: mSnap.data() as MenuItem });
                    }
                }

                for (const it of originalTx.items) {
                    const itemInfo = restoreMenuItemDocs.get(it.id);
                    if (!itemInfo) continue;
                    const { ref, data } = itemInfo;

                    if (data.stock_control_type === 'PRODUCT') {
                        const cur = productRestorations.has(it.id)
                            ? productRestorations.get(it.id)!.newStock
                            : (data.estoque_atual || 0);
                        productRestorations.set(it.id, { ref, newStock: cur + it.quantity });
                    }

                    if (data.stock_control_type === 'INGREDIENTS' && data.receita && data.receita.length > 0) {
                        const obs = it.observation || '';
                        const removedMatch = obs.match(/SEM: \[(.*?)\]/);
                        const removedList = removedMatch
                            ? removedMatch[1].split(',').map(s => s.trim().toLowerCase())
                            : [];

                        for (const recipeItem of data.receita) {
                            const isRemoved = removedList.some(r => r && recipeItem.ingredient_nome.toLowerCase().includes(r));
                            if (isRemoved) continue;

                            const ingRef = clientDoc(db, 'pdvs', originalTx.pdv_id, 'ingredients', recipeItem.ingredient_id);
                            const ingSnap = await t.get(ingRef);
                            if (ingSnap.exists()) {
                                const ingData = ingSnap.data() as PdvIngredient;
                                const existing = ingredientRestorations.get(recipeItem.ingredient_id);
                                const cur = existing ? existing.newQty : (ingData.quantidade_atual || 0);
                                const delta = recipeItem.quantidade * it.quantity;
                                ingredientRestorations.set(recipeItem.ingredient_id, {
                                    ref: ingRef,
                                    newQty: cur + delta,
                                    currentQty: existing ? existing.currentQty : (ingData.quantidade_atual || 0),
                                    delta: (existing ? existing.delta : 0) + delta,
                                    nome: ingData.nome,
                                    unidade: ingData.unidade || 'un',
                                });
                            }
                        }
                    }
                }
            }
            
            // --- 2. VALIDATION PHASE ---
            if (originalTx.tipo === 'REEMBOLSO') {
                throw new Error("Não é possível estornar um estorno.");
            }

            let newBalance: number;
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
            const now = ClientTimestamp.now();
            t.update(cardRef, { saldo_centavos: newBalance, updated_at: now });

            if (orderToCancelRef) {
                t.update(orderToCancelRef, { status: 'CANCELADO', updated_at: now });
            }

            // Restore product stocks
            for (const { ref, newStock } of productRestorations.values()) {
                t.update(ref, { estoque_atual: newStock });
            }

            // Restore ingredient stocks
            for (const { ref, newQty } of ingredientRestorations.values()) {
                t.update(ref, { quantidade_atual: newQty, updated_at: now });
            }

            // Audit log for restored ingredients
            if (ingredientRestorations.size > 0 && originalTx.pdv_id) {
                const logRef = clientDoc(clientCollection(db, 'pdvs', originalTx.pdv_id, 'ingredient_logs'));
                t.set(logRef, {
                    pdv_id: originalTx.pdv_id,
                    tipo: 'ESTORNO',
                    titulo: `Estorno de Venda — Devolução ao Estoque`,
                    transacao_id: transactionId,
                    usuario: responsibleUser || 'Administrador',
                    itens_vendidos: (originalTx.items || []).map(it => ({
                        nome: it.name,
                        quantidade: it.quantity,
                        observacoes: it.observation || null,
                    })),
                    insumos_alterados: Array.from(ingredientRestorations.entries()).map(([ingId, r]) => ({
                        ingredient_id: ingId,
                        ingredient_nome: r.nome,
                        quantidade_anterior: r.currentQty,
                        quantidade_alterada: +r.delta,
                        quantidade_resultante: r.newQty,
                        unidade: r.unidade,
                    })),
                    created_at: now,
                });
            }

            const reversalTxRef = clientDoc(clientCollection(db, 'transactions'));
            const reversalData: Partial<Transaction> = {
                cartao_id: originalTx.cartao_id,
                pdv_id: originalTx.pdv_id,
                tipo: 'REEMBOLSO',
                valor_centavos: originalTx.valor_centavos,
                created_at: now as any,
                usuario_responsavel: responsibleUser,
                reversed_tx_id: transactionId,
                items: originalTx.items || [],
                tenant_id: originalTx.tenant_id || cardData.tenant_id || undefined,
                event_id: originalTx.event_id || cardData.event_id || undefined,
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
    const db = getWebDb();
    if (pdvId === 'caixa_central') return 'Caixa Central';
    const pdvRef = clientDoc(db, 'pdvs', pdvId);
    const pdvSnap = await clientGetDoc(pdvRef);
    if (pdvSnap.exists()) {
        return (pdvSnap.data() as any).nome;
    }
    return `PDV ID: ${pdvId}`;
}

// --- Ingredient / Stock Management ---
const IngredientSchema = z.object({
  pdvId: z.string().min(1, 'PDV ID é obrigatório.'),
  nome: z.string().min(1, 'Nome do insumo é obrigatório.'),
  quantidade_atual: z.coerce.number().min(0, 'Quantidade não pode ser negativa.'),
  unidade: z.string().default('un'),
  estoque_minimo: z.coerce.number().min(0).optional().nullable(),
});

export async function addIngredient(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
  const validatedFields = IngredientSchema.safeParse({
    pdvId: formData.get('pdvId'),
    nome: formData.get('nome'),
    quantidade_atual: formData.get('quantidade_atual'),
    unidade: formData.get('unidade') || 'un',
    estoque_minimo: formData.get('estoque_minimo') || null,
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Dados do insumo inválidos.' };
  }

  try {
    const { pdvId, nome, quantidade_atual, unidade, estoque_minimo } = validatedFields.data;
    const ingCol = clientCollection(db, 'pdvs', pdvId, 'ingredients');
    const now = ClientTimestamp.now();
    const ingDocData: Record<string, any> = {
      pdv_id: pdvId,
      nome,
      quantidade_atual,
      unidade,
      updated_at: now,
    };
    if (typeof estoque_minimo === 'number') {
      ingDocData.estoque_minimo = estoque_minimo;
    }
    const newDoc = await clientAddDoc(ingCol, ingDocData);

    // Audit log
    try {
      const logCol = clientCollection(db, 'pdvs', pdvId, 'ingredient_logs');
      await clientAddDoc(logCol, {
        pdv_id: pdvId,
        tipo: 'CRIACAO',
        titulo: `Cadastro de Insumo: ${nome}`,
        descricao: `Insumo adicionado com estoque inicial de ${quantidade_atual} ${unidade}.`,
        insumos_alterados: [{
          ingredient_id: newDoc.id,
          ingredient_nome: nome,
          quantidade_anterior: 0,
          quantidade_alterada: quantidade_atual,
          quantidade_resultante: quantidade_atual,
          unidade,
        }],
        created_at: now,
      });
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria de insumo:', e);
    }

    return { status: 'success', message: 'Insumo adicionado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao adicionar insumo.';
    return { status: 'error', message: msg };
  }
}

export async function updateIngredientStock(
  pdvId: string,
  ingredientId: string,
  novoSaldo: number
): Promise<ActionState> {
  const db = getWebDb();
  try {
    const ingRef = clientDoc(db, 'pdvs', pdvId, 'ingredients', ingredientId);
    const snap = await clientGetDoc(ingRef);
    const oldData = snap.exists() ? (snap.data() as PdvIngredient) : null;
    const oldQty = oldData?.quantidade_atual ?? 0;
    const delta = novoSaldo - oldQty;
    const now = ClientTimestamp.now();

    await clientUpdateDoc(ingRef, {
      quantidade_atual: Math.max(0, novoSaldo),
      updated_at: now,
    });

    // Audit log
    try {
      const logCol = clientCollection(db, 'pdvs', pdvId, 'ingredient_logs');
      await clientAddDoc(logCol, {
        pdv_id: pdvId,
        tipo: delta >= 0 ? 'ENTRADA_MANUAL' : 'AJUSTE_MANUAL',
        titulo: delta >= 0 ? `Entrada Manual: ${oldData?.nome || 'Insumo'}` : `Ajuste de Estoque: ${oldData?.nome || 'Insumo'}`,
        descricao: `Estoque ajustado de ${oldQty} para ${novoSaldo} ${oldData?.unidade || 'un'} (${delta >= 0 ? '+' : ''}${delta}).`,
        insumos_alterados: [{
          ingredient_id: ingredientId,
          ingredient_nome: oldData?.nome || 'Insumo',
          quantidade_anterior: oldQty,
          quantidade_alterada: delta,
          quantidade_resultante: Math.max(0, novoSaldo),
          unidade: oldData?.unidade || 'un',
        }],
        created_at: now,
      });
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria:', e);
    }

    return { status: 'success', message: 'Estoque do insumo atualizado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar insumo.';
    return { status: 'error', message: msg };
  }
}

const UpdateIngredientSchema = z.object({
  pdvId: z.string().min(1, 'PDV ID é obrigatório.'),
  ingredientId: z.string().min(1, 'ID do insumo é obrigatório.'),
  nome: z.string().min(1, 'Nome do insumo é obrigatório.'),
  quantidade_atual: z.coerce.number().min(0, 'Quantidade não pode ser negativa.'),
  unidade: z.string().default('un'),
  estoque_minimo: z.coerce.number().min(0).optional().nullable(),
});

export async function updateIngredient(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const db = getWebDb();
  const validatedFields = UpdateIngredientSchema.safeParse({
    pdvId: formData.get('pdvId'),
    ingredientId: formData.get('ingredientId'),
    nome: formData.get('nome'),
    quantidade_atual: formData.get('quantidade_atual'),
    unidade: formData.get('unidade') || 'un',
    estoque_minimo: formData.get('estoque_minimo') || null,
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Dados do insumo inválidos.' };
  }

  try {
    const { pdvId, ingredientId, nome, quantidade_atual, unidade, estoque_minimo } = validatedFields.data;
    const ingRef = clientDoc(db, 'pdvs', pdvId, 'ingredients', ingredientId);
    const snap = await clientGetDoc(ingRef);
    const oldData = snap.exists() ? (snap.data() as PdvIngredient) : null;
    const oldQty = oldData?.quantidade_atual ?? 0;
    const delta = quantidade_atual - oldQty;
    const now = ClientTimestamp.now();

    const updateData: Record<string, any> = {
      nome: nome.trim(),
      quantidade_atual: Math.max(0, quantidade_atual),
      unidade: unidade.trim() || 'un',
      updated_at: now,
    };

    if (typeof estoque_minimo === 'number') {
      updateData.estoque_minimo = estoque_minimo;
    } else {
      updateData.estoque_minimo = clientDeleteField();
    }

    await clientUpdateDoc(ingRef, updateData);

    // Audit log
    try {
      const logCol = clientCollection(db, 'pdvs', pdvId, 'ingredient_logs');
      const changes: string[] = [];
      if (oldData && oldData.nome !== nome) changes.push(`Nome alterado de "${oldData.nome}" para "${nome}"`);
      if (oldData && oldData.unidade !== unidade) changes.push(`Unidade alterada de "${oldData.unidade}" para "${unidade}"`);
      if (delta !== 0) changes.push(`Estoque de ${oldQty} para ${quantidade_atual} ${unidade} (${delta >= 0 ? '+' : ''}${delta})`);

      await clientAddDoc(logCol, {
        pdv_id: pdvId,
        tipo: 'EDICAO',
        titulo: `Edição de Insumo: ${nome}`,
        descricao: changes.length > 0 ? changes.join(' • ') : 'Dados do insumo atualizados.',
        insumos_alterados: [{
          ingredient_id: ingredientId,
          ingredient_nome: nome,
          quantidade_anterior: oldQty,
          quantidade_alterada: delta,
          quantidade_resultante: quantidade_atual,
          unidade,
        }],
        created_at: now,
      });
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria:', e);
    }

    return { status: 'success', message: `Insumo "${nome}" atualizado com sucesso!` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar insumo.';
    return { status: 'error', message: msg };
  }
}

export async function deleteIngredient(pdvId: string, ingredientId: string): Promise<ActionState> {
  const db = getWebDb();
  try {
    const ingRef = clientDoc(db, 'pdvs', pdvId, 'ingredients', ingredientId);
    const snap = await clientGetDoc(ingRef);
    const oldData = snap.exists() ? (snap.data() as PdvIngredient) : null;
    const now = ClientTimestamp.now();

    await clientDeleteDoc(ingRef);

    if (oldData) {
      try {
        const logCol = clientCollection(db, 'pdvs', pdvId, 'ingredient_logs');
        await clientAddDoc(logCol, {
          pdv_id: pdvId,
          tipo: 'EXCLUSAO',
          titulo: `Insumo Excluído: ${oldData.nome}`,
          descricao: `Insumo removido da barraca. Estoque no momento da exclusão: ${oldData.quantidade_atual} ${oldData.unidade}.`,
          insumos_alterados: [{
            ingredient_id: ingredientId,
            ingredient_nome: oldData.nome,
            quantidade_anterior: oldData.quantidade_atual,
            quantidade_alterada: -(oldData.quantidade_atual ?? 0),
            quantidade_resultante: 0,
            unidade: oldData.unidade || 'un',
          }],
          created_at: now,
        });
      } catch (e) {
        console.warn('Erro ao registrar log de auditoria:', e);
      }
    }

    return { status: 'success', message: 'Insumo excluído com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao excluir insumo.';
    return { status: 'error', message: msg };
  }
}

const MenuItemSchema = z.object({
  nome: z.string().min(1, 'Nome do item é obrigatório.'),
  preco_reais: z.coerce.number().positive('Preço deve ser positivo.'),
  ingredientes: z.string().optional(),
  pdvId: z.string(),
  itemId: z.string().optional(),
  stock_control_type: z.enum(['NONE', 'PRODUCT', 'INGREDIENTS']).default('NONE').optional(),
  estoque_atual: z.coerce.number().min(0, 'Estoque não pode ser negativo.').optional().nullable(),
  estoque_minimo: z.coerce.number().min(0).optional().nullable(),
  receita: z.string().optional(),
});

export async function addMenuItem( prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    ingredientes: formData.get('ingredientes'),
    pdvId: formData.get('pdvId'),
    stock_control_type: formData.get('stock_control_type') || 'NONE',
    estoque_atual: formData.get('estoque_atual') || null,
    estoque_minimo: formData.get('estoque_minimo') || null,
    receita: formData.get('receita') || undefined,
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    const { nome, preco_reais, ingredientes, pdvId, stock_control_type, estoque_atual, estoque_minimo, receita } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    const ingredientesList = ingredientes ? ingredientes.split(',').map(i => i.trim()).filter(Boolean) : [];
    
    let parsedReceita: RecipeItem[] | undefined = undefined;
    if (receita) {
      try {
        parsedReceita = JSON.parse(receita);
      } catch (e) {
        parsedReceita = undefined;
      }
    }

    const itemDocData: Record<string, any> = {
      nome,
      preco_centavos,
      ingredientes: ingredientesList,
      stock_control_type: (stock_control_type as StockControlType) || 'NONE',
    };

    if (stock_control_type === 'PRODUCT') {
      itemDocData.estoque_atual = typeof estoque_atual === 'number' ? estoque_atual : 0;
      if (typeof estoque_minimo === 'number') {
        itemDocData.estoque_minimo = estoque_minimo;
      }
    } else if (stock_control_type === 'INGREDIENTS') {
      itemDocData.receita = parsedReceita || [];
      if (typeof estoque_minimo === 'number') {
        itemDocData.estoque_minimo = estoque_minimo;
      }
    }

    const menuItemsCollection = clientCollection(db, 'pdvs', pdvId, 'menuItems');
    await clientAddDoc(menuItemsCollection, itemDocData);

    return { status: 'success', message: 'Item adicionado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao adicionar item.';
    return { status: 'error', message: msg };
  }
}

export async function updateMenuItem(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    ingredientes: formData.get('ingredientes'),
    pdvId: formData.get('pdvId'),
    itemId: formData.get('itemId'),
    stock_control_type: formData.get('stock_control_type') || 'NONE',
    estoque_atual: formData.get('estoque_atual') || null,
    estoque_minimo: formData.get('estoque_minimo') || null,
    receita: formData.get('receita') || undefined,
  });

  if (!validatedFields.success || !validatedFields.data.itemId) {
    return { status: 'error', message: 'Dados inválidos para atualização.' };
  }
  
  try {
    const { nome, preco_reais, ingredientes, pdvId, itemId, stock_control_type, estoque_atual, estoque_minimo, receita } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    const ingredientesList = ingredientes ? ingredientes.split(',').map(i => i.trim()).filter(Boolean) : [];

    let parsedReceita: RecipeItem[] | undefined = undefined;
    if (receita) {
      try {
        parsedReceita = JSON.parse(receita);
      } catch (e) {
        parsedReceita = undefined;
      }
    }

    const itemDocData: Record<string, any> = {
      nome,
      preco_centavos,
      ingredientes: ingredientesList,
      stock_control_type: (stock_control_type as StockControlType) || 'NONE',
    };

    if (stock_control_type === 'PRODUCT') {
      itemDocData.estoque_atual = typeof estoque_atual === 'number' ? estoque_atual : 0;
      if (typeof estoque_minimo === 'number') {
        itemDocData.estoque_minimo = estoque_minimo;
      } else {
        itemDocData.estoque_minimo = clientDeleteField();
      }
      itemDocData.receita = clientDeleteField();
    } else if (stock_control_type === 'INGREDIENTS') {
      itemDocData.receita = parsedReceita || [];
      if (typeof estoque_minimo === 'number') {
        itemDocData.estoque_minimo = estoque_minimo;
      } else {
        itemDocData.estoque_minimo = clientDeleteField();
      }
      itemDocData.estoque_atual = clientDeleteField();
    } else {
      itemDocData.estoque_atual = clientDeleteField();
      itemDocData.estoque_minimo = clientDeleteField();
      itemDocData.receita = clientDeleteField();
    }

    const itemRef = clientDoc(db, 'pdvs', pdvId, 'menuItems', itemId);
    await clientUpdateDoc(itemRef, itemDocData);

    return { status: 'success', message: 'Item atualizado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar item.';
    return { status: 'error', message: msg };
  }
}

export async function deleteMenuItem(pdvId: string, itemId: string): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId || !itemId) {
    return { status: 'error', message: 'IDs inválidos.' };
  }

  try {
    const itemRef = clientDoc(db, 'pdvs', pdvId, 'menuItems', itemId);
    await clientDeleteDoc(itemRef);

    return { status: 'success', message: 'Item excluído com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao excluir item.';
    return { status: 'error', message: msg };
  }
}

// --- PDV Management ---
const CreatePdvSchema = z.object({
  nome: z.string().min(1, 'Nome do PDV é obrigatório.'),
  icon: z.string().optional(),
  tenant_id: z.string().optional(),
  event_id: z.string().optional(),
});

export async function createPdv(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
  const validated = CreatePdvSchema.safeParse({
    nome: formData.get('nome'),
    icon: formData.get('icon') || undefined,
    tenant_id: formData.get('tenant_id') || undefined,
    event_id: formData.get('event_id') || undefined,
  });

  if (!validated.success) {
    return { status: 'error', message: 'Nome inválido.' };
  }

  try {
    const { nome, icon, tenant_id, event_id } = validated.data;
    const pdvRef = await clientAddDoc(clientCollection(db, 'pdvs'), {
      nome,
      ...(icon ? { icon } : {}),
      tenant_id: tenant_id || null,
      event_id: event_id || null,
      created_at: ClientTimestamp.now(),
    });

    return { status: 'success', message: `PDV "${nome}" criado com sucesso!`, data: { id: pdvRef.id } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao criar PDV.';
    return { status: 'error', message: msg };
  }
}

export async function updatePdv(pdvId: string, nome: string, icon?: string): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId || !nome.trim()) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    const updatePayload: Record<string, any> = {
      nome: nome.trim(),
      updated_at: ClientTimestamp.now(),
    };
    if (icon !== undefined) {
      updatePayload.icon = icon;
    }

    await clientUpdateDoc(clientDoc(db, 'pdvs', pdvId), updatePayload);
    return { status: 'success', message: 'PDV atualizado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar PDV.';
    return { status: 'error', message: msg };
  }
}

export async function updatePdvIcon(pdvId: string, icon: string): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId || !icon) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    await clientUpdateDoc(clientDoc(db, 'pdvs', pdvId), {
      icon,
      updated_at: ClientTimestamp.now(),
    });
    return { status: 'success', message: 'Símbolo atualizado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar símbolo.';
    return { status: 'error', message: msg };
  }
}

export async function deletePdv(pdvId: string): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId) {
    return { status: 'error', message: 'ID inválido.' };
  }

  try {
    // Delete all menu items inside pdv
    const menuItemsSnap = await clientGetDocs(clientCollection(db, 'pdvs', pdvId, 'menuItems'));
    const batch = clientWriteBatch(db);
    menuItemsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(clientDoc(db, 'pdvs', pdvId));
    await batch.commit();

    return { status: 'success', message: 'PDV e seu cardápio excluídos com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao excluir PDV.';
    return { status: 'error', message: msg };
  }
}

export async function seedDefaultPdvs(tenantId: string, eventId: string): Promise<ActionState> {
  const db = getWebDb();
  if (!tenantId || !eventId) {
    return { status: 'error', message: 'Organização e Evento são obrigatórios para inicializar barracas.' };
  }

  try {
    const defaultPdvs = [
      {
        nome: 'Barraca de Bebidas',
        icon: 'bebidas',
        menu: [
          { nome: 'Refrigerante Lata', preco_centavos: 600, ingredientes: ['Lata 350ml'] },
          { nome: 'Água Mineral', preco_centavos: 400, ingredientes: ['Garrafa 500ml'] },
          { nome: 'Suco Natural', preco_centavos: 800, ingredientes: ['Copo 300ml'] },
          { nome: 'Cerveja Lata', preco_centavos: 800, ingredientes: ['Lata 350ml'] },
        ],
      },
      {
        nome: 'Barraca do Pastel',
        icon: 'pastel',
        menu: [
          { nome: 'Pastel de Carne', preco_centavos: 1000, ingredientes: ['Carne moída', 'Massa artesanal'] },
          { nome: 'Pastel de Queijo', preco_centavos: 1000, ingredientes: ['Mussarela', 'Orégano'] },
          { nome: 'Pastel de Pizza', preco_centavos: 1200, ingredientes: ['Queijo', 'Presunto', 'Tomate', 'Orégano'] },
          { nome: 'Pastel Doce', preco_centavos: 1000, ingredientes: ['Nutella', 'Banana'] },
        ],
      },
      {
        nome: 'Barraca do Churrasco',
        icon: 'churrasco',
        menu: [
          { nome: 'Espetinho de Carne', preco_centavos: 1200, ingredientes: ['Alcatra', 'Farofa', 'Vinagrete'] },
          { nome: 'Espetinho de Frango', preco_centavos: 1000, ingredientes: ['Peito de frango com bacon'] },
          { nome: 'Espetinho de Linguiça', preco_centavos: 1000, ingredientes: ['Linguiça toscana'] },
          { nome: 'Pão de Alho', preco_centavos: 800, ingredientes: ['Pão com pasta de alho e queijo'] },
        ],
      },
      {
        nome: 'Barraca de Doces',
        icon: 'doces',
        menu: [
          { nome: 'Bolo no Pote', preco_centavos: 1000, ingredientes: ['Chocolate', 'Cenoura com brigadeiro'] },
          { nome: 'Brigadeiro Gourmet (Un)', preco_centavos: 400, ingredientes: ['Chocolate nobre'] },
          { nome: 'Churros com Doce de Leite', preco_centavos: 800, ingredientes: ['Açúcar e canela'] },
          { nome: 'Pudim Fatia', preco_centavos: 700, ingredientes: ['Calda de caramelo'] },
        ],
      },
    ];

    for (const p of defaultPdvs) {
      const pdvRef = await clientAddDoc(clientCollection(db, 'pdvs'), {
        nome: p.nome,
        icon: p.icon,
        tenant_id: tenantId,
        event_id: eventId,
        created_at: ClientTimestamp.now(),
      });

      const menuRef = clientCollection(db, 'pdvs', pdvRef.id, 'menuItems');
      for (const item of p.menu) {
        await clientAddDoc(menuRef, item);
      }
    }

    return { status: 'success', message: '4 barracas padrão e seus cardápios foram criados com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao inicializar barracas.';
    return { status: 'error', message: msg };
  }
}

// --- PDV WhatsApp Instance Management ---

export async function connectPdvWhatsapp(
  pdvId: string,
  eventId?: string | null,
  customInstanceName?: string,
  customToken?: string
): Promise<{
  success: boolean;
  instanceName?: string;
  base64?: string;
  code?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const db = getWebDb();
  if (!pdvId) return { success: false, error: 'PDV ID é obrigatório.' };

  try {
    const pdvRef = clientDoc(db, 'pdvs', pdvId);
    const pdvSnap = await clientGetDoc(pdvRef);
    if (!pdvSnap.exists()) {
      return { success: false, error: 'PDV não encontrado.' };
    }

    const pdvData = pdvSnap.data() as Pdv;
    // Preferred instance name order: customInstanceName -> saved instanceName -> pdv.nome -> generated name
    const instanceName =
      customInstanceName?.trim() ||
      pdvData.whatsapp?.instanceName ||
      pdvData.nome ||
      getPdvInstanceName(eventId || pdvData.event_id, pdvId);

    const token = customToken?.trim() || pdvData.whatsapp?.token;

    // Get or generate QR code from Evolution API
    const qrResult = await getEvolutionQrCode(instanceName, token);

    if (!qrResult.success) {
      await clientUpdateDoc(pdvRef, {
        'whatsapp.status': 'ERROR',
        'whatsapp.instanceName': instanceName,
        ...(token ? { 'whatsapp.token': token } : {}),
        'whatsapp.lastError': qrResult.error,
        'whatsapp.updatedAt': ClientTimestamp.now(),
      }).catch(() => {});

      return { success: false, instanceName, error: qrResult.error };
    }

    // Update PDV state in Firestore
    await clientUpdateDoc(pdvRef, {
      'whatsapp.enabled': true,
      'whatsapp.instanceName': instanceName,
      ...(token ? { 'whatsapp.token': token } : {}),
      'whatsapp.status': qrResult.state === 'open' ? 'CONNECTED' : 'CONNECTING',
      'whatsapp.updatedAt': ClientTimestamp.now(),
    });

    return {
      success: true,
      instanceName,
      base64: qrResult.base64,
      code: qrResult.code,
      pairingCode: qrResult.pairingCode,
      state: qrResult.state,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao iniciar conexão com WhatsApp.';
    console.error(`[connectPdvWhatsapp] Error:`, msg);
    return { success: false, error: msg };
  }
}

export async function checkPdvWhatsappStatus(
  pdvId: string,
  instanceName: string,
  token?: string
): Promise<{
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';
  phoneNumber?: string;
  error?: string;
}> {
  const db = getWebDb();
  if (!pdvId || !instanceName) return { status: 'DISCONNECTED' };

  try {
    const stateResult = await getEvolutionConnectionState(instanceName, token);
    const pdvRef = clientDoc(db, 'pdvs', pdvId);

    if (stateResult.state === 'open') {
      await clientUpdateDoc(pdvRef, {
        'whatsapp.status': 'CONNECTED',
        'whatsapp.phoneNumber': stateResult.phoneNumber || null,
        'whatsapp.lastConnectedAt': ClientTimestamp.now(),
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'CONNECTED', phoneNumber: stateResult.phoneNumber };
    } else if (stateResult.state === 'connecting') {
      await clientUpdateDoc(pdvRef, {
        'whatsapp.status': 'CONNECTING',
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'CONNECTING' };
    } else {
      await clientUpdateDoc(pdvRef, {
        'whatsapp.status': 'DISCONNECTED',
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'DISCONNECTED' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao consultar status.';
    return { status: 'ERROR', error: msg };
  }
}

export async function disconnectPdvWhatsapp(
  pdvId: string,
  instanceName: string,
  token?: string
): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId || !instanceName) return { status: 'error', message: 'Dados inválidos.' };

  try {
    await logoutEvolutionInstance(instanceName, token);
    const pdvRef = clientDoc(db, 'pdvs', pdvId);
    await clientUpdateDoc(pdvRef, {
      'whatsapp.status': 'DISCONNECTED',
      'whatsapp.lastDisconnectedAt': ClientTimestamp.now(),
      'whatsapp.updatedAt': ClientTimestamp.now(),
    });

    return { status: 'success', message: 'WhatsApp da barraca desconectado.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao desconectar WhatsApp.';
    return { status: 'error', message: msg };
  }
}

// --- Event / Caixa WhatsApp Management ---
export async function connectEventWhatsapp(
  tenantId: string,
  eventId: string,
  customInstanceName?: string,
  customToken?: string
): Promise<{
  success: boolean;
  instanceName?: string;
  base64?: string;
  code?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
}> {
  const db = getWebDb();
  if (!tenantId || !eventId) return { success: false, error: 'Tenant e Evento são obrigatórios.' };

  try {
    const eventRef = clientDoc(db, 'tenants', tenantId, 'events', eventId);
    const eventSnap = await clientGetDoc(eventRef);
    if (!eventSnap.exists()) {
      return { success: false, error: 'Evento não encontrado.' };
    }

    const eventData = eventSnap.data() as TenantEvent;
    const tSnap = await clientGetDoc(clientDoc(db, 'tenants', tenantId)).catch(() => null);
    const orgName = tSnap && tSnap.exists() ? tSnap.data().name : tenantId;

    const instanceName =
      customInstanceName?.trim() ||
      eventData.whatsapp?.instanceName ||
      getPdvInstanceName(orgName, eventData.name, 'caixa');

    const token = customToken?.trim() || eventData.whatsapp?.token;

    const qrResult = await getEvolutionQrCode(instanceName, token);

    if (!qrResult.success) {
      await clientUpdateDoc(eventRef, {
        'whatsapp.status': 'ERROR',
        'whatsapp.instanceName': instanceName,
        ...(token ? { 'whatsapp.token': token } : {}),
        'whatsapp.lastError': qrResult.error,
        'whatsapp.updatedAt': ClientTimestamp.now(),
      }).catch(() => {});

      return { success: false, instanceName, error: qrResult.error };
    }

    await clientUpdateDoc(eventRef, {
      'whatsapp.enabled': true,
      'whatsapp.instanceName': instanceName,
      ...(token ? { 'whatsapp.token': token } : {}),
      'whatsapp.status': qrResult.state === 'open' ? 'CONNECTED' : 'CONNECTING',
      'whatsapp.updatedAt': ClientTimestamp.now(),
    });

    return {
      success: true,
      instanceName,
      base64: qrResult.base64,
      code: qrResult.code,
      pairingCode: qrResult.pairingCode,
      state: qrResult.state,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao conectar WhatsApp do Evento.';
    return { success: false, error: msg };
  }
}

export async function checkEventWhatsappStatus(
  tenantId: string,
  eventId: string,
  instanceName: string,
  token?: string
): Promise<{
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';
  phoneNumber?: string;
  error?: string;
}> {
  const db = getWebDb();
  if (!tenantId || !eventId || !instanceName) return { status: 'DISCONNECTED' };

  try {
    const stateResult = await getEvolutionConnectionState(instanceName, token);
    const eventRef = clientDoc(db, 'tenants', tenantId, 'events', eventId);

    if (stateResult.state === 'open') {
      await clientUpdateDoc(eventRef, {
        'whatsapp.status': 'CONNECTED',
        'whatsapp.phoneNumber': stateResult.phoneNumber || null,
        'whatsapp.lastConnectedAt': ClientTimestamp.now(),
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'CONNECTED', phoneNumber: stateResult.phoneNumber };
    } else if (stateResult.state === 'connecting') {
      await clientUpdateDoc(eventRef, {
        'whatsapp.status': 'CONNECTING',
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'CONNECTING' };
    } else {
      await clientUpdateDoc(eventRef, {
        'whatsapp.status': 'DISCONNECTED',
        'whatsapp.updatedAt': ClientTimestamp.now(),
      });
      return { status: 'DISCONNECTED' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao consultar status.';
    return { status: 'ERROR', error: msg };
  }
}

export async function disconnectEventWhatsapp(
  tenantId: string,
  eventId: string,
  instanceName: string,
  token?: string
): Promise<ActionState> {
  const db = getWebDb();
  if (!tenantId || !eventId || !instanceName) return { status: 'error', message: 'Dados inválidos.' };

  try {
    await logoutEvolutionInstance(instanceName, token);
    const eventRef = clientDoc(db, 'tenants', tenantId, 'events', eventId);
    await clientUpdateDoc(eventRef, {
      'whatsapp.status': 'DISCONNECTED',
      'whatsapp.lastDisconnectedAt': ClientTimestamp.now(),
      'whatsapp.updatedAt': ClientTimestamp.now(),
    });

    return { status: 'success', message: 'WhatsApp do Evento/Caixa desconectado.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao desconectar WhatsApp do Evento.';
    return { status: 'error', message: msg };
  }
}

// --- Order Status ---
const UpdateOrderStatusSchema = z.object({
  orderId: z.string(),
  newStatus: z.enum(['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO', 'ARQUIVADO']),
});

export async function updateOrderStatus(orderId: string, newStatus: Order['status']): Promise<ActionState> {
    const db = getWebDb();
    const validated = UpdateOrderStatusSchema.safeParse({ orderId, newStatus });

    if (!validated.success) {
        return { status: 'error', message: 'Dados inválidos para atualizar o pedido.'};
    }

    try {
        const orderRef = clientDoc(db, 'orders', validated.data.orderId);
        await clientUpdateDoc(orderRef, {
            status: validated.data.newStatus,
            updated_at: ClientTimestamp.now(),
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
  tenant_id: z.string().optional(),
  event_id: z.string().optional(),
});

export async function sendBulkNotification(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const db = getWebDb();
  const validatedFields = BulkNotificationSchema.safeParse({
    message: formData.get('message'),
    tenant_id: formData.get('tenant_id') || undefined,
    event_id: formData.get('event_id') || undefined,
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Mensagem inválida.' };
  }
  
  const { message, tenant_id, event_id } = validatedFields.data;

  try {
    const cardsColl = clientCollection(db, 'cards');
    let q = clientQuery(cardsColl);
    if (tenant_id && event_id) {
      q = clientQuery(cardsColl, clientWhere('tenant_id', '==', tenant_id), clientWhere('event_id', '==', event_id));
    } else if (tenant_id) {
      q = clientQuery(cardsColl, clientWhere('tenant_id', '==', tenant_id));
    } else if (event_id) {
      q = clientQuery(cardsColl, clientWhere('event_id', '==', event_id));
    }

    const cardsSnapshot = await clientGetDocs(q);
    if (cardsSnapshot.empty) {
      return { status: 'error', message: 'Nenhum cartão cadastrado para este evento para notificar.' };
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
    const db = getWebDb();
    if (!cardIds || cardIds.length === 0) {
        return { status: 'error', message: 'Nenhum cartão selecionado.' };
    }
    try {
        const batch = clientWriteBatch(db);
        cardIds.forEach(id => {
            const docRef = clientDoc(db, 'cards', id);
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
    const db = getWebDb();
    if (!transactionIds || transactionIds.length === 0) {
        return { status: 'error', message: 'Nenhuma transação selecionada.' };
    }

    try {
        const batch = clientWriteBatch(db);
        
        // Find associated orders to delete them as well (chunked by 10 for 'in' query)
        for (let i = 0; i < transactionIds.length; i += 10) {
            const chunk = transactionIds.slice(i, i + 10);
            const ordersQuery = clientQuery(
                clientCollection(db, 'orders'),
                clientWhere('transaction_id', 'in', chunk)
            );
            const ordersSnapshot = await clientGetDocs(ordersQuery);
            ordersSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        // Delete the transactions themselves
        transactionIds.forEach(id => {
            const docRef = clientDoc(db, 'transactions', id);
            batch.delete(docRef);
        });

        await batch.commit();
        return { 
            status: 'success', 
            message: `${transactionIds.length} transação(ões) excluída(s) com sucesso.` 
        };
    } catch (error) {
        console.error("Error deleting transactions:", error);
        return { status: 'error', message: 'Erro ao excluir transações e pedidos associados.' };
    }
}
 
export async function createUser(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
    const auth = getFirebaseAuth();
    const db = getWebDb();
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

        await clientSetDoc(clientDoc(db, 'users', userRecord.uid), userProfile);

        return { status: 'success', message: 'Usuário criado com sucesso!' };

    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            return { status: 'error', message: 'Este email já está em uso.' };
        }
        return { status: 'error', message: 'Erro ao criar usuário.' };
    }
}

