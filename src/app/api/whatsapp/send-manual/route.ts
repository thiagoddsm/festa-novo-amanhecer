import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import type { TenantEvent } from '@/lib/definitions';
import {
  formatWhatsAppNumber,
  getEvolutionConnectionState,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'https://api.ibmanha.com.br').replace(
  /\/$/,
  ''
);
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '554C767EA3D2-4221-AB6A-C126C68A657E';

let roundRobinCounter = 0;

function getWebDb() {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

interface CandidateInstance {
  instance: string;
  token?: string;
}

async function resolveCandidateInstances(
  tenantId?: string | null,
  eventId?: string | null
): Promise<CandidateInstance[]> {
  const candidates: CandidateInstance[] = [];
  const effectiveTenantId = tenantId || 'igreja-batista-da-manha';
  const effectiveEventId = eventId || 'DoKmbiQ8pd3M71yTC9iA';

  try {
    const db = getWebDb();
    const eSnap = await getDoc(
      doc(db, 'tenants', effectiveTenantId, 'events', effectiveEventId)
    );
    if (eSnap.exists()) {
      const eData = eSnap.data() as TenantEvent;
      if (eData.whatsapp?.instanceName) {
        candidates.push({
          instance: eData.whatsapp.instanceName,
          token: eData.whatsapp.token,
        });
      }
      const backups = eData.whatsapp_backups || {};
      Object.keys(backups)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((k) => {
          const cfg = backups[k];
          if (cfg?.instanceName) {
            candidates.push({
              instance: cfg.instanceName,
              token: cfg.token,
            });
          }
        });
    }
  } catch (err) {
    console.warn('[API /api/whatsapp/send-manual] Aviso ao buscar instâncias do evento:', err);
  }

  return candidates;
}

/**
 * Envia presença "composing" (Digitando...) + mensagem de texto com delay de 3000ms (3 segundos)
 */
async function sendWith3sTypingSimulation(
  instanceName: string,
  formattedNumber: string,
  text: string,
  customToken?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = customToken || EVOLUTION_API_KEY;
  const startTime = Date.now();

  try {
    // 1. Dispara presença "composing" (Digitando...) na Evolution API (não bloqueante se o endpoint variar)
    await fetch(`${EVOLUTION_API_URL}/chat/sendPresence/${instanceName}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedNumber,
        options: {
          delay: 3000,
          presence: 'composing',
        },
        presence: 'composing',
        delay: 3000,
      }),
    }).catch(() => {});

    // 2. Envia a mensagem passando delay: 3000 (simulação nativa de escrita de 3 segundos no Baileys)
    let res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedNumber,
        text,
        delay: 3000,
        options: {
          delay: 3000,
          presence: 'composing',
        },
      }),
    });

    if (res.status === 400) {
      // Caso a versão da Evolution não aceite options junto com delay, garante os 3s de escrita antes do envio
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) {
        await new Promise((r) => setTimeout(r, 3000 - elapsed));
      }
      res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: formattedNumber,
          text,
        }),
      });
    } else {
      // Se a API respondeu rápido sem segurar os 3000ms no HTTP, aguardamos o restante para completar os 3s reais
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) {
        await new Promise((r) => setTimeout(r, 3000 - elapsed));
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.response?.message || data?.message || `Erro HTTP ${res.status}`;
      return { success: false, error: Array.isArray(errMsg) ? errMsg.join(', ') : String(errMsg) };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro de conexão com a API de WhatsApp.',
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      phone,
      text,
      tenantId,
      eventId,
    }: {
      phone?: string;
      text?: string;
      tenantId?: string | null;
      eventId?: string | null;
    } = body;

    if (!phone || !text) {
      return NextResponse.json(
        { error: 'Telefone e texto da mensagem são obrigatórios.' },
        { status: 400 }
      );
    }

    const formattedNumber = formatWhatsAppNumber(phone);
    if (formattedNumber.replace(/\D/g, '').length < 12) {
      return NextResponse.json(
        { error: 'Número de telefone inválido para envio no WhatsApp.' },
        { status: 400 }
      );
    }

    const candidates = await resolveCandidateInstances(tenantId, eventId);
    let lastError = 'Nenhuma instância conectada disponível.';

    if (candidates.length > 0) {
      const startIdx = roundRobinCounter++ % candidates.length;
      const rotated = [
        ...candidates.slice(startIdx),
        ...candidates.slice(0, startIdx),
      ];

      for (const candidate of rotated) {
        const state = await getEvolutionConnectionState(candidate.instance, candidate.token);
        if (state.state !== 'open') {
          lastError = `Instância ${candidate.instance} desconectada.`;
          continue;
        }

        const sendRes = await sendWith3sTypingSimulation(
          candidate.instance,
          formattedNumber,
          text,
          candidate.token
        );

        if (sendRes.success) {
          return NextResponse.json({
            success: true,
            instanceUsed: candidate.instance,
          });
        }
        lastError = sendRes.error || 'Falha ao enviar pela instância.';
      }
    }

    return NextResponse.json(
      {
        error:
          'Nenhuma das 3 instâncias do Caixa está conectada no momento. Conecte pelo menos 1 WhatsApp na tela do Caixa antes de disparar.',
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[API /api/whatsapp/send-manual] Erro:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao disparar mensagem via API.',
      },
      { status: 500 }
    );
  }
}
