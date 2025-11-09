'use server';

import { initializeApp, getApps, getApp, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Card } from '../definitions';
import { formatCurrency } from '@/lib/utils';
import { sendWhatsappMessage, sendWhatsappImage } from '@/lib/whatsapp';

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
 * Sends a pre-formatted message based on card data.
 */
async function sendCardNotification(
    cardId: string, 
    messageBuilder: (card: Card) => string,
    options?: {
        testNumber?: string;
        sendQrImage?: boolean;
    }
): Promise<NotifyResult> {
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

    let card: Card;
    let phoneNumber: string | undefined;

    if (cardId === 'test-card-id' && options?.testNumber) {
        card = testCardData;
        phoneNumber = options.testNumber;
    } else {
        try {
            const cardRef = db.collection('cards').doc(cardId);
            const cardSnap = await cardRef.get();
            if (!cardSnap.exists) {
                throw new Error(`Card with ID ${cardId} not found.`);
            }
            card = cardSnap.data() as Card;
            phoneNumber = options?.testNumber || card.telefone_cliente;
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
             console.error(`Notification flow failed for card ${cardId}:`, errorMessage);
             return { success: false, message: "Failed to fetch card data.", error: errorMessage };
        }
    }
    
    if (!phoneNumber) {
        return { success: true, message: "No phone number available for this card. Skipping notification." };
    }

    const message = messageBuilder(card);
    let qrImageUrl: string | undefined;

    if (options?.sendQrImage) {
        qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(card.qr_code_id)}`;
    }
    
    // This will be wrapped in a single call to the generic message flow
    return await notifyCustomMessage(phoneNumber, message, qrImageUrl);
}

/**
 * Generic function to send a custom message, with an optional image, to a phone number.
 * @param phoneNumber The recipient's phone number.
 * @param message The text message to send.
 * @param imageUrl Optional URL of an image to send.
 * @returns A NotifyResult object.
 */
export async function notifyCustomMessage(phoneNumber: string, message: string, imageUrl?: string): Promise<NotifyResult> {
    const apiKey = process.env.WHATSAPP_API_KEY;
    if (!apiKey) {
        const errorMsg = "WHATSAPP_API_KEY is not defined in environment variables.";
        console.error(errorMsg);
        return { success: false, message: "Configuration error.", error: errorMsg };
    }

    try {
        // Send Text Message
        await sendWhatsappMessage(phoneNumber, message, apiKey);

        // Send Image if URL is provided
        if (imageUrl) {
            await sendWhatsappImage(phoneNumber, imageUrl, "Seu QR Code", apiKey);
        }

        return { success: true, message: `Notification sent to ${phoneNumber}.` };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while sending.";
        console.error(`Notification flow failed for ${phoneNumber}:`, errorMessage);
        return { success: false, message: "Failed to send notification.", error: errorMessage };
    }
}


// --- Specific Notification Triggers ---

export async function notifyCardCreation(cardId: string): Promise<NotifyResult> {
    return sendCardNotification(cardId, (card) => {
        const clientName = card.nome_cliente ? `, ${card.nome_cliente}` : '';
        return `Bem-vindo(a) ao FestaPay${clientName}! 🥳\n\nSeu cartão cashless foi criado com sucesso.\n\n*ID do Cartão:* \`${card.qr_code_id}\`\n*Saldo Inicial:* ${formatCurrency(card.saldo_centavos)}\n\nAbaixo está o seu QR Code para pagamentos. Guarde-o com segurança!`;
    }, { sendQrImage: true }); // Enable sending QR image
}

export async function notifyRecharge(cardId: string, rechargeAmountCents: number): Promise<NotifyResult> {
    return sendCardNotification(cardId, (card) => {
        return `Olá, ${card.nome_cliente || 'cliente'}!\n\nSua recarga foi efetuada com sucesso. ✅\n\n*Valor da Recarga:* ${formatCurrency(rechargeAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}`;
    });
}

export async function notifySale(cardId: string, saleAmountCents: number, pdvName: string, testNumber?: string): Promise<NotifyResult> {
    const messageBuilder = (card: Card) => {
         const currentBalance = cardId === 'test-card-id' 
            ? card.saldo_centavos - saleAmountCents
            : card.saldo_centavos;

        return `Nova compra realizada no FestaPay! 🛍️\n\n*Local:* ${pdvName}\n*Valor:* -${formatCurrency(saleAmountCents)}\n\n*Saldo Restante:* ${formatCurrency(currentBalance)}\n\nObrigado!`;
    };

    return sendCardNotification(cardId, messageBuilder, { testNumber });
}

export async function notifyReversal(cardId: string, reversalAmountCents: number): Promise<NotifyResult> {
    return sendCardNotification(cardId, (card) => {
        return `Atenção, ${card.nome_cliente || 'cliente'}!\n\nUma transação foi estornada e seu saldo foi ajustado.\n\n*Valor do Estorno:* ${formatCurrency(reversalAmountCents)}\n*Novo Saldo:* ${formatCurrency(card.saldo_centavos)}\n\nEm caso de dúvidas, procure o caixa central.`;
    });
}
