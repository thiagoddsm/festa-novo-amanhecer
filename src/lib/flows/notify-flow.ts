'use server';

import { initializeApp, getApps, getApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Card } from '../definitions';
import { formatCurrency } from '../utils';
import { sendWhatsappMessage, sendWhatsappImage } from '../whatsapp';

// --- Initialization ---

function getAdminApp(): App {
  if (getApps().length > 0) return getApp();
  return initializeApp({ credential: applicationDefault() });
}
const db = getFirestore(getAdminApp());

// --- Flow Logic ---

type NotifyResult = {
    success: boolean;
    message: string;
    error?: string;
};

/**
 * Fetches card data and sends a pre-formatted message.
 * @param cardId The ID of the card document in Firestore.
 * @param messageBuilder A function that takes the card data and returns the message string.
 * @param testNumber An optional phone number to override the one on the card, for testing.
 * @returns A NotifyResult object.
 */
async function baseNotificationFlow(
    cardId: string, 
    messageBuilder: (card: Card) => string,
    options?: {
        testNumber?: string;
        sendQrImage?: boolean;
    }
): Promise<NotifyResult> {
    const apiKey = process.env.WHATSAPP_API_KEY;
    if (!apiKey) {
        const errorMsg = "WHATSAPP_API_KEY is not defined in environment variables.";
        console.error(errorMsg);
        return { success: false, message: "Configuration error.", error: errorMsg };
    }

    const testCardData: Card = { 
        id: 'test-card-id', 
        nome_cliente: 'Cliente Teste', 
        telefone_cliente: options?.testNumber || '',
        qr_code_id: 'qr-test-12345',
        saldo_centavos: 5000,
        status: 'ATIVO',
        created_at: new Date() as any,
        updated_at: new Date() as any,
    };

    if (cardId === 'test-card-id' && options?.testNumber) {
        // Handle test case directly without hitting Firestore
        const message = messageBuilder(testCardData);
        await sendWhatsappMessage(options.testNumber, message, apiKey);
        return { success: true, message: "Test message sent." };
    }

    try {
        const cardRef = db.collection('cards').doc(cardId);
        const cardSnap = await cardRef.get();

        if (!cardSnap.exists) {
            throw new Error(`Card with ID ${cardId} not found.`);
        }

        const card = cardSnap.data() as Card;
        const phoneNumber = options?.testNumber || card.telefone_cliente;

        if (!phoneNumber) {
            return { success: true, message: "No phone number available for this card. Skipping notification." };
        }

        // Send Text Message
        const message = messageBuilder(card);
        await sendWhatsappMessage(phoneNumber, message, apiKey);

        // Send QR Code Image if requested
        if (options?.sendQrImage) {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(card.qr_code_id)}`;
            await sendWhatsappImage(phoneNumber, qrImageUrl, `Seu QR Code FestaPay`, apiKey);
        }

        return { success: true, message: `Notification sent to card ${cardId}.` };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`Notification flow failed for card ${cardId}:`, errorMessage);
        return { success: false, message: "Failed to send notification.", error: errorMessage };
    }
}

// --- Specific Notification Triggers ---

export async function notifyCardCreation(cardId: string): Promise<NotifyResult> {
    return baseNotificationFlow(cardId, (card) => {
        const clientName = card.nome_cliente ? `, ${card.nome_cliente}` : '';
        return `Bem-vindo(a) ao FestaPay${clientName}! 🥳\n\nSeu cartão cashless foi criado com sucesso.\n\n*ID do Cartão:* \`${card.qr_code_id}\`\n*Saldo Inicial:* ${formatCurrency(card.saldo_centavos)}\n\nAbaixo está o seu QR Code para pagamentos. Guarde-o com segurança!`;
    }, { sendQrImage: true }); // Enable sending QR image
}

export async function notifyRecharge(cardId: string, rechargeAmountCents: number): Promise<NotifyResult> {
    return baseNotificationFlow(cardId, (card) => {
        return `Olá, ${card.nome_cliente || 'cliente'}!\n\nSua recarga foi efetuada com sucesso. ✅\n\n*Valor da Recarga:* ${formatCurrency(rechargeAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}`;
    });
}

export async function notifySale(cardId: string, saleAmountCents: number, pdvName: string, testNumber?: string): Promise<NotifyResult> {
    const messageBuilder = (card: Card) => {
         // In the test case, the passed amount is the sale amount, not the new balance
         const currentBalance = cardId === 'test-card-id' 
            ? card.saldo_centavos - saleAmountCents
            : card.saldo_centavos;

        return `Nova compra realizada no FestaPay! 🛍️\n\n*Local:* ${pdvName}\n*Valor:* -${formatCurrency(saleAmountCents)}\n\n*Saldo Restante:* ${formatCurrency(currentBalance)}\n\nObrigado!`;
    };

    return baseNotificationFlow(cardId, messageBuilder, { testNumber });
}
