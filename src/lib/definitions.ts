import { Timestamp } from 'firebase/firestore';

export type TenantPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export type Tenant = {
  id: string; // Firestore document ID (slug or uid)
  name: string;
  slug: string;
  owner_id: string;
  plan: TenantPlan;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  created_at: Timestamp;
};

export type Event = {
  id: string; // Firestore document ID
  tenant_id: string;
  name: string;
  description?: string;
  start_date?: Timestamp;
  end_date?: Timestamp;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
  created_at: Timestamp;
};

export type UserProfile = {
  id: string; // Firestore document ID (same as Firebase Auth UID)
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'CAIXA' | 'PDV' | 'VISITANTE';
  pdvId?: string; // Only for PDV users
  tenants?: { [tenantId: string]: { role: 'ADMIN' | 'CAIXA' | 'PDV'; defaultEventId?: string; allowedEventIds?: string[] } };
}

export type Card = {
  id: string; // Firestore document ID
  tenant_id: string;
  event_id: string;
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
  tenant_id: string;
  event_id: string;
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
  tenant_id: string;
  event_id: string;
  nome: string;
};

export type MenuItem = {
    id: string; // Firestore document ID
    tenant_id?: string;
    event_id?: string;
    nome: string;
    preco_centavos: number;
    ingredientes?: string[];
}

export type Order = {
    id: string;
    tenant_id: string;
    event_id: string;
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
