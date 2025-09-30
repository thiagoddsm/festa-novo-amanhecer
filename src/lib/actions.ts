'use server';

import { z } from 'zod';
import {
  createNewCard,
  findCardByQrCodeId,
  updateCardBalance,
  createTransaction,
  getSalesReport,
  getPdvs,
} from './data';
import { summarizeSalesReport } from '@/ai/flows/sales-report-summarization';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SESSION_OPTIONS, type SessionData } from './auth';

export type ActionState = {
  status: 'success' | 'error';
  message: string;
  data?: any;
};

// --- Auth ---
const LoginSchema = z.object({
    role: z.enum(['CAIXA', 'PDV']),
    pdvId: z.coerce.number().optional(),
    password: z.string().min(1, 'Senha é obrigatória.'),
});

export async function login(prevState: ActionState | undefined, formData: FormData): Promise<ActionState> {
    try {
        const validatedFields = LoginSchema.safeParse({
            role: formData.get('role'),
            pdvId: formData.get('pdvId'),
            password: formData.get('password'),
        });

        if (!validatedFields.success) {
            return { status: 'error', message: 'Dados de login inválidos.' };
        }

        const { role, pdvId, password } = validatedFields.data;

        // Mock authentication logic
        if (password !== '1234') {
             return { status: 'error', message: 'Senha incorreta.' };
        }

        const session = await getIronSession<SessionData>(cookies(), SESSION_OPTIONS);
        
        if (role === 'CAIXA') {
            session.user = {
                isAuthenticated: true,
                role: 'CAIXA',
                name: 'Caixa',
            };
        } else if (role === 'PDV' && pdvId) {
            const pdv = getPdvs().find(p => p.id === pdvId);
            if (!pdv) {
                return { status: 'error', message: 'PDV não encontrado.' };
            }
             session.user = {
                isAuthenticated: true,
                role: 'PDV',
                name: pdv.nome,
                pdvId: pdv.id,
            };
        } else {
            return { status: 'error', message: 'Função ou PDV inválido.' };
        }

        await session.save();

    } catch (error) {
        console.error(error);
        return { status: 'error', message: 'Ocorreu um erro ao fazer login.' };
    }
    
    // Redirect must be outside try/catch
    if (formData.get('role') === 'PDV') {
        redirect('/pos');
    }
    redirect('/dashboard');
}

export async function logout() {
  const session = await getIronSession<SessionData>(cookies(), SESSION_OPTIONS);
  session.destroy();
  redirect('/login');
}


// --- Card Creation ---
const CreateCardSchema = z.object({
  saldo_inicial: z.coerce.number().min(0, 'Valor deve ser positivo.'),
});

export async function createCard(
  prevState: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  try {
    const validatedFields = CreateCardSchema.safeParse({
      saldo_inicial: formData.get('saldo_inicial'),
    });

    if (!validatedFields.success) {
      return {
        status: 'error',
        message: 'Dados inválidos.',
        data: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { saldo_inicial } = validatedFields.data;
    const newCard = createNewCard(saldo_inicial * 100);

    return {
      status: 'success',
      message: 'Cartão criado com sucesso!',
      data: newCard,
    };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao criar cartão.' };
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
    const card = findCardByQrCodeId(qr_code_id);

    if (!card) {
      return { status: 'error', message: 'Cartão não encontrado.' };
    }
    if (card.status !== 'ATIVO') {
      return { status: 'error', message: `Cartão com status ${card.status}` };
    }

    const valor_recarga_centavos = valor_recarga * 100;
    const novo_saldo_centavos = card.saldo_centavos + valor_recarga_centavos;

    updateCardBalance(card.id, novo_saldo_centavos);
    createTransaction({
      cartao_id: card.id,
      pdv_id: 1, // Caixa Central
      tipo: 'RECARGA',
      valor_centavos: valor_recarga_centavos,
    });

    return {
      status: 'success',
      message: 'Recarga efetuada com sucesso!',
      data: { novo_saldo_centavos },
    };
  } catch (error) {
    console.error(error);
    return { status: 'error', message: 'Erro ao recarregar.' };
  }
}

// --- Sale ---
const SaleSchema = z.object({
    qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
    valor_venda: z.coerce.number().positive('Valor da venda deve ser positivo.'),
    pdv_id: z.coerce.number().min(1, 'Ponto de Venda é obrigatório.')
});

export async function processSale(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const validatedFields = SaleSchema.safeParse({
            qr_code_id: formData.get('qr_code_id'),
            valor_venda: formData.get('valor_venda'),
            pdv_id: formData.get('pdv_id'),
        });

        if (!validatedFields.success) {
            return {
              status: 'error',
              message: 'Dados inválidos.',
              data: validatedFields.error.flatten().fieldErrors,
            };
        }

        const { qr_code_id, valor_venda, pdv_id } = validatedFields.data;
        const card = findCardByQrCodeId(qr_code_id);

        if (!card) {
            return { status: 'error', message: 'Cartão não encontrado.' };
        }
        if (card.status !== 'ATIVO') {
            return { status: 'error', message: `Cartão com status ${card.status}` };
        }

        const valor_venda_centavos = valor_venda * 100;

        if(card.saldo_centavos < valor_venda_centavos) {
            return { status: 'error', message: 'Saldo insuficiente.' };
        }

        const novo_saldo_centavos = card.saldo_centavos - valor_venda_centavos;

        updateCardBalance(card.id, novo_saldo_centavos);
        createTransaction({
            cartao_id: card.id,
            pdv_id: pdv_id,
            tipo: 'VENDA',
            valor_centavos: valor_venda_centavos,
        });

        return {
            status: 'success',
            message: 'Venda aprovada!',
            data: { novo_saldo_centavos }
        }

    } catch (error) {
        console.error(error);
        return { status: 'error', message: 'Erro ao processar venda.' };
    }
}


// --- AI Summary ---
export async function generateSummary(
    prevState: ActionState | undefined,
    formData: FormData
): Promise<ActionState> {
    try {
        const salesData = getSalesReport();
        
        if (salesData.total_vendido_centavos === 0 && salesData.total_recarregado_centavos === 0) {
            return {
                status: 'success',
                message: 'Nenhuma venda registrada para gerar o relatório.',
                data: { summary: "Não há dados de vendas ou recargas para gerar um resumo. Realize algumas transações e tente novamente."}
            }
        }
        
        const summaryResponse = await summarizeSalesReport({ salesData });

        return {
            status: 'success',
            message: 'Relatório gerado.',
            data: { summary: summaryResponse.summary }
        };

    } catch(error) {
        console.error(error);
        return { status: 'error', message: 'Erro ao gerar relatório com IA.' };
    }
}
