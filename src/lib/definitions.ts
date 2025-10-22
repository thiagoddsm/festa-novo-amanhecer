import { Timestamp } from 'firebase/firestore';

export type Card = {
  id: string; // Firestore document ID
  qr_code_id: string;
  saldo_centavos: number;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
  nome_cliente?: string;
  telefone_cliente?: string;
};

export type Transaction = {
  id: number; // Will become firestore doc id
  cartao_id: string; // Firestore document ID of the card
  pdv_id: number;
  tipo: 'RECARGA' | 'VENDA' | 'REEMBOLSO';
  valor_centavos: number;
  created_at: Date;
};

export type Pdv = {
  id: number;
  nome: string;
  chave_api: string;
};
