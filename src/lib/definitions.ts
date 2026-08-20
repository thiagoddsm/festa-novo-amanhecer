import { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Papel global do usuário no sistema. */
export type UserRole =
  | 'SUPERADMIN'        // Só Thiago — acesso total
  | 'ADMIN_ORGANIZACAO' // Admin de uma organização inteira (vê todos eventos)
  | 'ADMIN_EVENTO'      // Admin restrito a um evento específico
  | 'CAIXA'             // Operador de caixa (restrito a allowedEventIds)
  | 'PDV'               // Operador de barraca/ponto de venda
  | 'VISITANTE';        // Pendente de aprovação

/** Papel do usuário DENTRO de uma organização/tenant. */
export type TenantRole = 'ADMIN' | 'OPERADOR' | 'CAIXA' | 'PDV';

/** Acesso de um usuário a uma organização específica. */
export type TenantAccess = {
  role: TenantRole;
  /** Se vazio/undefined → acesso a TODOS os eventos da organização. */
  allowedEventIds?: string[];
};

// ---------------------------------------------------------------------------
// User Profile (Firestore: /users/{uid})
// ---------------------------------------------------------------------------

export type UserProfile = {
  id: string;    // Firestore document ID (= Firebase Auth UID)
  email: string;
  name: string;
  role: UserRole;
  pdvId?: string;

  /** Mapa de tenantId → acesso dentro daquele tenant. */
  tenants?: { [tenantId: string]: TenantAccess };

  /** Preenchido no auto-cadastro: org que o usuário solicitou. */
  requestedTenantId?: string;
  /** Preenchido no auto-cadastro: evento que o usuário solicitou. */
  requestedEventId?: string;
};

// ---------------------------------------------------------------------------
// Tenant / Organização (Firestore: /tenants/{tenantId})
// ---------------------------------------------------------------------------

export type Tenant = {
  id: string;
  name: string;
  logoUrl?: string;
};

// ---------------------------------------------------------------------------
// Evento (Firestore: /tenants/{tenantId}/events/{eventId})
// ---------------------------------------------------------------------------

export type TenantEvent = {
  id: string;
  name: string;
  date?: Timestamp;
  active?: boolean;
};

// ---------------------------------------------------------------------------
// Card (Firestore: /cards/{cardId})
// ---------------------------------------------------------------------------

export type Card = {
  id: string;
  qr_code_id: string;
  saldo_centavos: number;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  created_at: Timestamp;
  updated_at: Timestamp;
  nome_cliente?: string;
  telefone_cliente?: string;
  tenant_id?: string;
  event_id?: string;
};

// ---------------------------------------------------------------------------
// Order Item
// ---------------------------------------------------------------------------

export type OrderItem = {
  id: string;
  name: string;
  price: number; // cents
  quantity: number;
  observation?: string;
  ingredientes?: string[];
};

// ---------------------------------------------------------------------------
// Transaction (Firestore: /transactions/{txId})
// ---------------------------------------------------------------------------

export type Transaction = {
  id: string;
  cartao_id: string;
  pdv_id: string;
  tipo: 'RECARGA' | 'VENDA' | 'REEMBOLSO' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  valor_centavos: number;
  created_at: Timestamp;
  items?: OrderItem[];
  usuario_responsavel?: string;
  reversed_tx_id?: string;
  tenant_id?: string;
  event_id?: string;
};

export type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
  nome_cliente?: string;
};

// ---------------------------------------------------------------------------
// PDV (Firestore: /pdvs/{pdvId})
// ---------------------------------------------------------------------------

export type Pdv = {
  id: string;
  nome: string;
  tenant_id?: string;
  event_id?: string;
};

// ---------------------------------------------------------------------------
// Menu Item (Firestore: /pdvs/{pdvId}/menuItems/{itemId})
// ---------------------------------------------------------------------------

export type MenuItem = {
  id: string;
  nome: string;
  preco_centavos: number;
  ingredientes?: string[];
};

// ---------------------------------------------------------------------------
// Order (Firestore: /orders/{orderId})
// ---------------------------------------------------------------------------

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
  tenant_id?: string;
  event_id?: string;
};
