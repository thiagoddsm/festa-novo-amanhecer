'use server';

// Função para formatar a mensagem para o WhatsApp, substituindo quebras de linha por %0A
export function formatWhatsappMessage(text: string): string {
    return encodeURIComponent(text);
}

// Função para enviar a mensagem via API do api-wa.me
export async function sendWhatsappMessage(to: string, text: string) {
    const apiKey = process.env.WHATSAPP_API_KEY;
    
    if (!apiKey) {
        console.error('WHATSAPP_API_KEY is not defined in environment variables.');
        return; // Silently fail in production if key is not set
    }

    const apiUrl = `https://us.api-wa.me/${apiKey}/message/text`;

    try {
        // Limpa o número, removendo caracteres não numéricos.
        const cleanedNumber = to.replace(/\D/g, '');
        
        console.log(`Sending WhatsApp message to ${cleanedNumber}...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: cleanedNumber,
                text: decodeURIComponent(text), // Decodifica para enviar o texto puro no JSON
            }),
        });

        const responseData = await response.json();

        if (!response.ok || responseData.status === 'error') {
            console.error(`Failed to send WhatsApp message to ${cleanedNumber}:`, responseData.message || 'Unknown error');
        } else {
            console.log(`WhatsApp message successfully sent to ${cleanedNumber}.`);
        }
    } catch (error) {
        console.error(`Exception when sending WhatsApp message to ${to}:`, error);
    }
}
