import type { Pdv, Transaction } from './definitions';

// This file now only contains mock data for transactions and PDVs.
// Card data is now managed by Firestore.

let transactions: Transaction[] = [
  { id: 1, cartao_id: 'mock-card-id-1', pdv_id: 1, tipo: 'RECARGA', valor_centavos: 5000, created_at: new Date('2024-07-19T10:00:00Z') },
  { id: 2, cartao_id: 'mock-card-id-1', pdv_id: 2, tipo: 'VENDA', valor_centavos: 1450, created_at: new Date('2024-07-19T14:30:00Z') },
  { id: 3, cartao_id: 'mock-card-id-2', pdv_id: 1, tipo: 'RECARGA', valor_centavos: 2000, created_at: new Date('2024-07-19T11:00:00Z') },
  { id: 4, cartao_id: 'mock-card-id-2', pdv_id: 3, tipo: 'VENDA', valor_centavos: 500, created_at: new Date('2024-07-19T16:00:00Z') },
];

let pdvs: Pdv[] = [
  { id: 1, nome: 'Caixa Central', chave_api: 'api-key-caixa' },
  { id: 2, nome: 'Barraca de Salgados', chave_api: 'api-key-salgados' },
  { id: 3, nome: 'Barraca de Bebidas', chave_api: 'api-key-bebidas' },
  { id: 4, nome: 'Food Truck de Burger', chave_api: 'api-key-burger' },
];

let nextTransactionId = transactions.length + 1;

export function generateRandomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 18; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// These functions still operate on in-memory data and will need to be migrated to Firestore.

// --- TRANSACTION FUNCTIONS ---
export const getTransactions = (limit: number = 20): Transaction[] => {
    return [...transactions].sort((a,b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, limit);
}

export const createTransaction = (data: Omit<Transaction, 'id' | 'created_at'>): Transaction => {
  const newTransaction: Transaction = {
    ...data,
    id: nextTransactionId++,
    created_at: new Date(),
  };
  transactions.push(newTransaction);
  return newTransaction;
}

// --- PDV FUNCTIONS ---
export const getPdvs = (): Pdv[] => {
    return pdvs.filter(p => p.id !== 1); // Exclude Caixa Central
}

export const getPdvById = (id: number): Pdv | undefined => {
    return pdvs.find(p => p.id === id);
}

// --- REPORTING FUNCTIONS ---
export const getSalesReport = () => {
    const total_vendido_centavos = transactions
        .filter(t => t.tipo === 'VENDA')
        .reduce((sum, t) => sum + t.valor_centavos, 0);

    const total_recarregado_centavos = transactions
        .filter(t => t.tipo === 'RECARGA')
        .reduce((sum, t) => sum + t.valor_centavos, 0);

    const salesByPdv = pdvs
        .filter(p => p.id !== 1)
        .map(pdv => {
            const total_centavos = transactions
                .filter(t => t.pdv_id === pdv.id && t.tipo === 'VENDA')
                .reduce((sum, t) => sum + t.valor_centavos, 0);
            return {
                pdv_id: pdv.id,
                nome: pdv.nome,
                total_centavos,
            }
        });

    return { total_vendido_centavos, total_recarregado_centavos, vendas_por_pdv: salesByPdv };
}
