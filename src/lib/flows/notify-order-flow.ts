'use server';

import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Order, Transaction, Card } from '../definitions';
import { notifyCustomMessage } from './notify-flow';

// --- Initialization ---

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
    });
  }
  return {
    db: getFirestore(),
  };
}

// --- Flow Logic ---

type NotifyResult = {
    success: boolean;
    message: string;
    error?: string;
};


/**
 * Notifies a customer that their order is ready for pickup.
 * This function is designed to be called without waiting for its completion (fire-and-forget).
 * @param orderId The ID of the order that is ready.
 */
export async function notifyOrderReady(orderId: string): Promise<void> {
    const { db } = getFirebaseAdmin();
    try {
        // 1. Fetch the Order
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            throw new Error(`Order with ID ${orderId} not found.`);
        }
        const order = orderSnap.data() as Order;

        // 2. Fetch the associated Transaction
        const txRef = db.collection('transactions').doc(order.transaction_id);
        const txSnap = await txRef.get();
        if (!txSnap.exists) {
            throw new Error(`Transaction with ID ${order.transaction_id} not found for order ${orderId}.`);
        }
        const transaction = txSnap.data() as Transaction;
        
        // 3. Fetch the Card to get the phone number
        const cardRef = db.collection('cards').doc(transaction.cartao_id);
        const cardSnap = await cardRef.get();
        if (!cardSnap.exists) {
            throw new Error(`Card with ID ${transaction.cartao_id} not found.`);
        }
        const card = cardSnap.data() as Card;

        // 4. Check for phone number and send notification
        if (card.telefone_cliente) {
            const clientName = card.nome_cliente ? `, ${card.nome_cliente}` : '';
            const message = `Olá${clientName}! 👋\n\nSeu pedido *${order.order_number}* feito em *${order.pdv_nome}* está pronto para retirada! 😋`;
            
            // The actual sending is fire-and-forget within this function.
            await notifyCustomMessage(card.telefone_cliente, message);
            console.log(`Order ready notification sent for order ${orderId} to ${card.telefone_cliente}`);
        } else {
            console.log(`Skipping notification for order ${orderId}: No phone number on card.`);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`[notifyOrderReady Flow] Failed for order ${orderId}:`, errorMessage);
        // We don't return anything as this is a fire-and-forget flow.
    }
}
