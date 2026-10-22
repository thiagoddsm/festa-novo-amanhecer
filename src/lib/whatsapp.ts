/**
 * Evolution API WhatsApp Provider
 * Handles multi-instance WhatsApp messaging, QR code generation, connection status and lifecycles.
 */

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'https://api.ibmanha.com.br').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '554C767EA3D2-4221-AB6A-C126C68A657E';
export const DEFAULT_FALLBACK_INSTANCE = process.env.EVOLUTION_DEFAULT_INSTANCE || 'IBM';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  instanceUsed: string;
  error?: string;
};

export type ConnectionStateResult = {
  instanceName: string;
  state: 'open' | 'close' | 'connecting' | 'not_found' | 'error';
  phoneNumber?: string;
};

export type ConnectQrResult = {
  success: boolean;
  instanceName: string;
  base64?: string;
  code?: string;
  pairingCode?: string;
  state?: string;
  error?: string;
};

/**
 * Formats phone number to E.164 without '+' (DDI 55 for Brazil).
 * Examples: (21) 98765-4321 -> 5521987654321
 */
export function formatWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) return `55${cleaned}`;
  if (cleaned.length === 10) return `55${cleaned.substring(0, 2)}9${cleaned.substring(2)}`;
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

/**
 * Normalizes text to a safe API slug (removes accents, special chars and replaces spaces with _).
 */
export function sanitizeSlug(text: string, maxLength: number = 30): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_') // replace non-alphanumeric chars with _
    .replace(/_+/g, '_') // collapse multiple underscores
    .replace(/^_|_$/g, '') // trim leading/trailing underscores
    .slice(0, maxLength);
}

/**
 * Generates a hierarchical, collision-free SaaS instance name:
 * Format: fp_{orgSlug}_{eventSlug}_{pdvSlug}
 * Example: fp_igreja_batista_da_manha_festa_novo_amanhecer_2027_bebidas
 */
export function getPdvInstanceName(
  orgNameOrId?: string | null,
  eventNameOrId?: string | null,
  pdvNameOrId?: string | null
): string {
  const orgSlug = sanitizeSlug(orgNameOrId || 'org', 25);
  const eventSlug = sanitizeSlug(eventNameOrId || 'event', 25);
  const pdvSlug = sanitizeSlug(pdvNameOrId || 'pdv', 20);
  return `fp_${orgSlug}_${eventSlug}_${pdvSlug}`;
}

/**
 * Checks the connection state of an instance in Evolution API.
 */
export async function getEvolutionConnectionState(instanceName: string, customApiKey?: string): Promise<ConnectionStateResult> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return { instanceName, state: 'not_found' };
    }

    if (!res.ok) {
      return { instanceName, state: 'error' };
    }

    const data = await res.json();
    const rawState = data.instance?.state || data.state || 'close';
    const state: 'open' | 'close' | 'connecting' = rawState === 'open' ? 'open' : rawState === 'connecting' ? 'connecting' : 'close';

    return {
      instanceName,
      state,
      phoneNumber: data.instance?.owner || data.owner || undefined,
    };
  } catch (error) {
    console.error(`[Evolution API] Error checking state for ${instanceName}:`, error);
    return { instanceName, state: 'error' };
  }
}

/**
 * Ensures an instance exists in Evolution API. Creates it if not found.
 */
export async function createEvolutionInstanceIfNotExists(instanceName: string, customApiKey?: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  try {
    const stateResult = await getEvolutionConnectionState(instanceName, apiKey);
    if (stateResult.state !== 'not_found' && stateResult.state !== 'error') {
      return { success: true };
    }

    const res = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName,
        token: customApiKey || '',
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    const data = await res.json();
    if (!res.ok && res.status !== 403 && !data.error?.includes('already in use')) {
      console.error(`[Evolution API] Failed to create instance ${instanceName}:`, data);
      return { success: false, error: data.message || 'Erro ao criar instância.' };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido ao criar instância.';
    console.error(`[Evolution API] Exception creating instance ${instanceName}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Requests the connection QR Code for an instance in Evolution API.
 */
export async function getEvolutionQrCode(instanceName: string, customApiKey?: string): Promise<ConnectQrResult> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok) {
      // If not found, try creating it first
      if (res.status === 404) {
        const createRes = await createEvolutionInstanceIfNotExists(instanceName, apiKey);
        if (createRes.success) {
          return await getEvolutionQrCode(instanceName, apiKey);
        }
      }
      return {
        success: false,
        instanceName,
        error: data.message || `Erro HTTP ${res.status} ao obter QR Code.`,
      };
    }

    const base64 = data.base64 || data.qrcode?.base64;
    const code = data.code || data.qrcode?.code;
    const pairingCode = data.pairingCode;
    const state = data.instance?.state || (base64 ? 'connecting' : 'unknown');

    return {
      success: true,
      instanceName,
      base64,
      code,
      pairingCode,
      state,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao conectar ao servidor de WhatsApp.';
    console.error(`[Evolution API] Error getting QR Code for ${instanceName}:`, msg);
    return {
      success: false,
      instanceName,
      error: msg,
    };
  }
}

/**
 * Disconnects / logs out an instance from Evolution API.
 */
export async function logoutEvolutionInstance(instanceName: string, customApiKey?: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok && res.status !== 404) {
      return { success: false, error: data.message || 'Erro ao desconectar.' };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido ao desconectar.';
    console.error(`[Evolution API] Error logging out ${instanceName}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Sends a text message via Evolution API to a specific instance.
 */
export async function sendEvolutionTextMessage(
  instanceName: string,
  to: string,
  text: string,
  customApiKey?: string
): Promise<WhatsAppSendResult> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  const formattedNumber = formatWhatsAppNumber(to);

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedNumber,
        text,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.response?.message || data.message || `Erro HTTP ${res.status}`;
      return {
        success: false,
        instanceUsed: instanceName,
        error: errMsg,
      };
    }

    return {
      success: true,
      messageId: data.key?.id || data.messageId || undefined,
      instanceUsed: instanceName,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido ao enviar mensagem.';
    return {
      success: false,
      instanceUsed: instanceName,
      error: errMsg,
    };
  }
}

/**
 * Sends a media / image message via Evolution API.
 */
export async function sendEvolutionMediaMessage(
  instanceName: string,
  to: string,
  mediaUrl: string,
  caption: string,
  customApiKey?: string
): Promise<WhatsAppSendResult> {
  const apiKey = customApiKey || EVOLUTION_API_KEY;
  const formattedNumber = formatWhatsAppNumber(to);

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedNumber,
        media: mediaUrl,
        mediatype: 'image',
        caption,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.response?.message || data.message || `Erro HTTP ${res.status}`;
      return {
        success: false,
        instanceUsed: instanceName,
        error: errMsg,
      };
    }

    return {
      success: true,
      messageId: data.key?.id || data.messageId || undefined,
      instanceUsed: instanceName,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido ao enviar imagem.';
    return {
      success: false,
      instanceUsed: instanceName,
      error: errMsg,
    };
  }
}

/**
 * Backward compatibility functions matching legacy signatures
 */
export async function sendWhatsappMessage(to: string, text: string, _apiKey?: string) {
  const result = await sendEvolutionTextMessage(DEFAULT_FALLBACK_INSTANCE, to, text);
  if (!result.success) {
    throw new Error(result.error || 'Erro ao enviar mensagem.');
  }
  return { status: 'success', message: 'Mensagem enviada com sucesso.', data: result };
}

export async function sendWhatsappImage(to: string, imageUrl: string, caption: string, _apiKey?: string) {
  const result = await sendEvolutionMediaMessage(DEFAULT_FALLBACK_INSTANCE, to, imageUrl, caption);
  if (!result.success) {
    throw new Error(result.error || 'Erro ao enviar imagem.');
  }
  return { status: 'success', message: 'Imagem enviada com sucesso.', data: result };
}
