import { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string; // Firestore document ID (same as Firebase Auth UID)
  email: string;
  name: string;
  role: 'ADMIN' | 'CAIXA' | 'PDV';
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

export type Transaction = {
  id: string; // Firestore doc id
  cartao_id: string; // Firestore document ID of the card
  pdv_id: string;
  tipo: 'RECARGA' | 'VENDA' | 'REEMBOLSO';
  valor_centavos: number;
  created_at: Timestamp;
  items?: { name: string; price: number; quantity: number }[];
};

export type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
}

export type Pdv = {
  id: string; // Firestore document ID
  nome: string;
};

export type MenuItem = {
    id: string; // Firestore document ID
    nome: string;
    preco_centavos: number;
}
