'use server';

import { z } from 'zod';
import { generateRandomId } from './data';

import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from '@/firebase/config';
import type { Card, MenuItem, Pdv } from './definitions';
import { revalidatePath } from 'next/cache';

// Helper to ensure Firebase Admin is initialized only once
let adminApp;
if (!getApps().length) {
    adminApp = initializeApp({
        // You might need to set credentials for admin SDK
    });
} else {
    adminApp = getApp();
}

const db = getFirestore(adminApp);
const auth = getAuth(adminApp);


export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  data?: any;
};

// --- User Management (Admin) ---
const UserSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  name: z.string().min(1, 'O nome é obrigatório.'),
  role: z.enum(['ADMIN', 'CAIXA', 'PDV']),
  pdvId: z.string().optional(),
});

export async function createUser(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
    try {
        const validatedFields = UserSchema.safeParse(Object.fromEntries(formData.entries()));
        if(!validatedFields.success) {
            return { status: 'error', message: 'Dados inválidos.', data: validatedFields.error.flatten().fieldErrors };
        }

        const { email, password, name, role, pdvId } = validatedFields.data;

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
        });

        // Store user profile with role in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            role,
            pdvId: role === 'PDV' ? pdvId : null,
        });
        
        revalidatePath('/admin/users');
        return { status: 'success', message: 'Usuário criado com sucesso!' };

    } catch (error: any) {
        console.error(error);
        let message = 'Ocorreu um erro desconhecido.';
        if (error.code === 'auth/email-already-exists') {
            message = 'Este e-mail já está em uso.';
        }
        return { status: 'error', message };
    }
}


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
    const batch = db.batch();

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
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
    };

    const cardDocRef = db.collection("cards").doc();
    batch.set(cardDocRef, cardData);

    if (saldo_centavos > 0) {
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
            cartao_id: cardDocRef.id,
            pdv_id: 'caixa_central', // Caixa Central
            tipo: 'RECARGA',
            valor_centavos: saldo_centavos,
            created_at: Timestamp.now()
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
    const batch = db.batch();

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
      created_at: Timestamp.now()
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
const SaleItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
});

const SaleSchema = z.object({
    qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
    pdv_id: z.string().min(1, 'Ponto de Venda é obrigatório.'),
    items: z.array(SaleItemSchema).min(1, "O carrinho está vazio."),
    total_venda: z.coerce.number().positive('Valor da venda deve ser positivo.'),
});

export async function processSale(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const batch = db.batch();

        const items = JSON.parse(formData.get('items') as string);
        const total_venda = parseFloat(formData.get('total_venda') as string);

        const validatedFields = SaleSchema.safeParse({
            qr_code_id: formData.get('qr_code_id'),
            pdv_id: formData.get('pdv_id'),
            items: items,
            total_venda: total_venda
        });

        if (!validatedFields.success) {
            console.log(validatedFields.error.flatten().fieldErrors);
            return {
              status: 'error',
              message: 'Dados da venda inválidos.',
              data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { qr_code_id, pdv_id, total_venda: valor_venda_centavos } = validatedFields.data;

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

        const cardDocRef = db.collection('cards').doc(cardDoc.id);
        batch.update(cardDocRef, {
            saldo_centavos: novo_saldo_centavos,
            updated_at: Timestamp.now()
        });
        
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          cartao_id: cardDoc.id,
          pdv_id: pdv_id,
          tipo: 'VENDA',
          valor_centavos: valor_venda_centavos,
          created_at: Timestamp.now(),
          items: validatedFields.data.items.map(item => ({name: item.name, price: item.price, quantity: item.quantity}))
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

// --- PDV / Menu ---
export async function getPdvNameById(pdvId: string): Promise<string> {
    const pdvRef = db.collection('pdvs').doc(pdvId);
    const pdvSnap = await pdvRef.get();
    if (pdvSnap.exists) {
        return (pdvSnap.data() as Pdv).nome;
    }
    return `PDV ID: ${pdvId}`;
}

const MenuItemSchema = z.object({
  nome: z.string().min(1, 'Nome do item é obrigatório.'),
  preco_reais: z.coerce.number().positive('Preço deve ser positivo.'),
  pdvId: z.string(),
  itemId: z.string().optional(),
});

export async function addMenuItem( prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    pdvId: formData.get('pdvId'),
  });

  if (!validatedFields.success) {
    return { status: 'error', message: 'Dados inválidos.' };
  }

  try {
    const { nome, preco_reais, pdvId } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);
    
    const menuItemsCollection = db.collection('pdvs').doc(pdvId).collection('menuItems');
    await menuItemsCollection.add({ nome, preco_centavos });

    revalidatePath('/pos');
    return { status: 'success', message: 'Item adicionado com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao adicionar item.' };
  }
}

export async function updateMenuItem(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
  const validatedFields = MenuItemSchema.safeParse({
    nome: formData.get('nome'),
    preco_reais: formData.get('preco_reais'),
    pdvId: formData.get('pdvId'),
    itemId: formData.get('itemId'),
  });

  if (!validatedFields.success || !validatedFields.data.itemId) {
    return { status: 'error', message: 'Dados inválidos para atualização.' };
  }
  
  try {
    const { nome, preco_reais, pdvId, itemId } = validatedFields.data;
    const preco_centavos = Math.round(preco_reais * 100);

    const itemRef = db.collection('pdvs').doc(pdvId).collection('menuItems').doc(itemId);
    await itemRef.update({ nome, preco_centavos });

    revalidatePath('/pos');
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

    revalidatePath('/pos');
    return { status: 'success', message: 'Item excluído com sucesso!' };
  } catch (error) {
    return { status: 'error', message: 'Erro ao excluir item.' };
  }
}

// This is a one-time action to create the admin user if it doesn't exist.
// This should be run by an administrator.
export async function createInitialAdminUser(): Promise<ActionState> {
    try {
        const email = 'thiagoddsm@gmail.com';
        const password = '10760134';
        
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(email);
        } catch(error: any) {
            if (error.code === 'auth/user-not-found') {
                 userRecord = await auth.createUser({
                    email: email,
                    password: password,
                    displayName: 'Admin Master',
                });
            } else {
                throw error;
            }
        }
        
        const userDocRef = db.collection('users').doc(userRecord.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            await userDocRef.set({
                name: 'Admin Master',
                email: email,
                role: 'ADMIN',
            });
            return { status: 'success', message: 'Usuário administrador inicial criado com sucesso.'};
        } else {
             return { status: 'idle', message: 'Usuário administrador já existe.'};
        }

    } catch (error) {
        console.error("Error creating initial admin user:", error);
        return { status: 'error', message: 'Falha ao criar usuário administrador inicial.' };
    }
}
