import { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string; // Firestore document ID (same as Firebase Auth UID)
  email: string;
  name: string;
  role: 'ADMIN' | 'CAIXA' | 'PDV' | 'VISITANTE';
  pdvId?: string; // Only for PDV users
}

export type Card = {
  id: string; // Firestore document ID
  qr_code_id: string;
  saldo_centavos: number;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  created_at: Timestamp;
  updated_at: Timestamp;
  nome_cliente?: string;
  telefone_cliente?: string;
};

// Represents an item within a transaction or order, potentially with an observation
export type OrderItem = {
    id: string;
    name: string;
    price: number; // in cents
    quantity: number;
    observation?: string;
    ingredientes?: string[];
};


export type Transaction = {
  id: string; // Firestore doc id
  cartao_id: string; // Firestore document ID of the card
  pdv_id: string;
  tipo: 'RECARGA' | 'VENDA' | 'REEMBOLSO' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  valor_centavos: number;
  created_at: Timestamp;
  items?: OrderItem[];
  usuario_responsavel?: string; // Nome do usuário que realizou a ação
  reversed_tx_id?: string; // ID of the transaction that was reversed
};

export type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
  nome_cliente?: string;
}

export type Pdv = {
  id: string; // Firestore document ID
  nome: string;
};

export type MenuItem = {
    id: string; // Firestore document ID
    nome: string;
    preco_centavos: number;
    ingredientes?: string[];
}

export type Order = {
    id: string;
    pdv_id: string;
    transaction_id: string;
    cliente_nome: string;
    status: 'PENDENTE' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO' | 'ARQUIVADO';
    created_at: Timestamp;
    updated_at: Timestamp;
    items: OrderItem[];
    order_number: string;
    pdv_nome: string;
}
