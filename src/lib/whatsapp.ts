// This file is NOT a server module, it's a simple utility.

/**
 * Sends a message using the api-wa.me service.
 * @param to The recipient's phone number.
 * @param text The message content.
 * @param apiKey The API key for the api-wa.me service.
 */
export async function sendWhatsappMessage(to: string, text: string, apiKey: string) {
    if (!apiKey) {
        throw new Error('WhatsApp API Key is not provided.');
    }

    const apiUrl = `https://us.api-wa.me/${apiKey}/message/text`;

    try {
        const cleanedNumber = to.replace(/\D/g, '');
        
        console.log(`Sending WhatsApp message to ${cleanedNumber}...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: cleanedNumber,
                text: text,
            }),
            // Add a timeout to avoid long-running requests in serverless environments
            signal: AbortSignal.timeout(10000) // 10 seconds
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error structure' }));
            console.error(`Failed to send WhatsApp message to ${cleanedNumber}. Status: ${response.status}`, errorData);
            throw new Error(`API request failed with status ${response.status}: ${errorData.message || 'Unknown API error'}`);
        } else {
             const responseData = await response.json();
             console.log(`WhatsApp message successfully sent to ${cleanedNumber}. Response:`, responseData);
             return responseData;
        }

    } catch (error) {
        console.error(`Exception when sending WhatsApp message to ${to}:`, error);
        // Re-throw the error to be handled by the caller
        throw error;
    }
}
