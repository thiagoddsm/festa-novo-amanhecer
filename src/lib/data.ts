import type { Card, Pdv, Transaction } from './definitions';

let cards: Card[] = [
  {
    id: 1,
    qr_code_id: 'festa-2025-a4b8-c1d6-e9f0',
    saldo_centavos: 3550,
    status: 'ATIVO',
    created_at: new Date('2024-07-19T10:00:00Z'),
    updated_at: new Date('2024-07-19T14:30:00Z'),
    nome_cliente: 'João Silva',
    telefone_cliente: '11999998888',
  },
  {
    id: 2,
    qr_code_id: 'festa-2025-b5c9-d2e7-f0a1',
    saldo_centavos: 1500,
    status: 'ATIVO',
    created_at: new Date('2024-07-19T11:00:00Z'),
    updated_at: new Date('2024-07-19T16:00:00Z'),
    nome_cliente: 'Maria Oliveira',
    telefone_cliente: '21988887777',
  },
];

let transactions: Transaction[] = [
  { id: 1, cartao_id: 1, pdv_id: 1, tipo: 'RECARGA', valor_centavos: 5000, created_at: new Date('2024-07-19T10:00:00Z') },
  { id: 2, cartao_id: 1, pdv_id: 2, tipo: 'VENDA', valor_centavos: 1450, created_at: new Date('2024-07-19T14:30:00Z') },
  { id: 3, cartao_id: 2, pdv_id: 1, tipo: 'RECARGA', valor_centavos: 2000, created_at: new Date('2024-07-19T11:00:00Z') },
  { id: 4, cartao_id: 2, pdv_id: 3, tipo: 'VENDA', valor_centavos: 500, created_at: new Date('2024-07-19T16:00:00Z') },
];

let pdvs: Pdv[] = [
  { id: 1, nome: 'Caixa Central', chave_api: 'api-key-caixa' },
  { id: 2, nome: 'Barraca de Salgados', chave_api: 'api-key-salgados' },
  { id: 3, nome: 'Barraca de Bebidas', chave_api: 'api-key-bebidas' },
  { id: 4, nome: 'Food Truck de Burger', chave_api: 'api-key-burger' },
];

let nextCardId = cards.length + 1;
let nextTransactionId = transactions.length + 1;

// --- CARD FUNCTIONS ---
export const findCardByQrCodeId = (qrCodeId: string): Card | undefined =>
  cards.find((c) => c.qr_code_id === qrCodeId);

export const createNewCard = (saldo_inicial_centavos: number, nome_cliente?: string, telefone_cliente?: string): Card => {
  const newCard: Card = {
    id: nextCardId++,
    qr_code_id: `festa-2025-${crypto.randomUUID().slice(0, 18)}`,
    saldo_centavos: saldo_inicial_centavos,
    status: 'ATIVO',
    created_at: new Date(),
    updated_at: new Date(),
    nome_cliente: nome_cliente,
    telefone_cliente: telefone_cliente,
  };
  cards.push(newCard);

  if (saldo_inicial_centavos > 0) {
    createTransaction({
      cartao_id: newCard.id,
      pdv_id: 1, // Caixa Central
      tipo: 'RECARGA',
      valor_centavos: saldo_inicial_centavos,
    });
  }

  return newCard;
};

export const updateCardBalance = (cardId: number, newBalance: number): Card | undefined => {
  const cardIndex = cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return undefined;

  cards[cardIndex].saldo_centavos = newBalance;
  cards[cardIndex].updated_at = new Date();
  return cards[cardIndex];
}

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
