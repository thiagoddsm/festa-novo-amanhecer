
'use server';

type WhatsAppResponse = {
    status: string;
    message: string;
    data?: any;
}

/**
 * Envia uma mensagem de texto para um número de WhatsApp usando a API api-wa.me.
 * @param to - O número do destinatário no formato DDI+DDD+Número (ex: 5511999998888).
 * @param text - O conteúdo da mensagem de texto.
 * @param apiKey - A chave da API para autenticação.
 * @returns Uma promessa que resolve com a resposta da API.
 */
export async function sendWhatsappMessage(to: string, text: string, apiKey: string): Promise<WhatsAppResponse> {
    const apiUrl = `https://us.api-wa.me/${apiKey}/message/text`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, text }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error("Erro ao enviar mensagem de WhatsApp:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
        return { status: 'error', message: errorMessage };
    }
}

/**
 * Envia uma imagem para um número de WhatsApp usando a API api-wa.me.
 * @param to - O número do destinatário.
 * @param imageUrl - A URL pública da imagem a ser enviada.
 * @param caption - A legenda para a imagem.
 * @param apiKey - A chave da API.
 * @returns Uma promessa que resolve com a resposta da API.
 */
export async function sendWhatsappImage(to: string, imageUrl: string, caption: string, apiKey: string): Promise<WhatsAppResponse> {
    const apiUrl = `https://us.api-wa.me/${apiKey}/message/image`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to, image: imageUrl, caption }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error("Erro ao enviar imagem de WhatsApp:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
        return { status: 'error', message: errorMessage };
    }
}
