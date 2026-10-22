'use server';

import { z } from 'zod';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Card, Order, Transaction, OrderItem, Pdv, TenantEvent } from './definitions';
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

        // ATOMIC TRANSACTION: guarantees balance consistency under concurrent scans
        const saleResult = await clientRunTransaction(db, async (t) => {
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

            const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;
            const now = ClientTimestamp.now();

            const effectiveTenantId = tenant_id || card.tenant_id || null;
            const effectiveEventId = event_id || card.event_id || null;

            // 1. Update card balance
            t.update(cardDocRef, {
                saldo_centavos: novo_saldo_centavos,
                updated_at: now,
            });

            // 2. Create transaction record
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

            // 3. Create order record
            const orderRef = clientDoc(clientCollection(db, 'orders'));
            const orderId = orderRef.id;
            t.set(orderRef, {
                pdv_id: pdv_id,
                pdv_nome: pdv_nome,
                transaction_id: transactionRef.id,
                cliente_nome: card.nome_cliente || 'Cliente',
                status: 'EM_PREPARO',
                created_at: now,
                updated_at: now,
                items: validatedFields.data.items,
                order_number: `#${orderId.substring(0, 4).toUpperCase()}`,
                tenant_id: effectiveTenantId,
                event_id: effectiveEventId,
            });

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

const MenuItemSchema = z.object({
  nome: z.string().min(1, 'Nome do item é obrigatório.'),
  preco_reais: z.coerce.number().positive('Preço deve ser positivo.'),
  ingredientes: z.string().optional(),
  pdvId: z.string(),
  itemId: z.string().optional(),
});

export async function addMenuItem( prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
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
    
    const menuItemsCollection = clientCollection(db, 'pdvs', pdvId, 'menuItems');
    await clientAddDoc(menuItemsCollection, { nome, preco_centavos, ingredientes: ingredientesList });

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
  });

  if (!validatedFields.success || !validatedFields.data.itemId) {
    return { status: 'error', message: 'Dados inválidos para atualização.' };
  }
  
  try {
    const { nome, preco_reais, ingredientes, pdvId, itemId } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    const ingredientesList = ingredientes ? ingredientes.split(',').map(i => i.trim()).filter(Boolean) : [];

    const itemRef = clientDoc(db, 'pdvs', pdvId, 'menuItems', itemId);
    await clientUpdateDoc(itemRef, { nome, preco_centavos, ingredientes: ingredientesList });

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
  tenant_id: z.string().optional(),
  event_id: z.string().optional(),
});

export async function createPdv(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const db = getWebDb();
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
    const pdvRef = await clientAddDoc(clientCollection(db, 'pdvs'), {
      nome,
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

export async function updatePdv(pdvId: string, nome: string): Promise<ActionState> {
  const db = getWebDb();
  if (!pdvId || !nome.trim()) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    await clientUpdateDoc(clientDoc(db, 'pdvs', pdvId), {
      nome: nome.trim(),
      updated_at: ClientTimestamp.now(),
    });
    return { status: 'success', message: 'PDV atualizado com sucesso!' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao atualizar PDV.';
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

    for (const p of defaultPdvs) {
      const pdvRef = await clientAddDoc(clientCollection(db, 'pdvs'), {
        nome: p.nome,
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

