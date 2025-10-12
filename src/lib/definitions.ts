export type Card = {
  id: number;
  qr_code_id: string;
  saldo_centavos: number;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  created_at: Date;
  updated_at: Date;
  nome_cliente?: string;
  telefone_cliente?: string;
};

export type Transaction = {
  id: number;
  cartao_id: number;
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
