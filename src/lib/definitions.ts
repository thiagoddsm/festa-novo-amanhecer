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
  /** Preenchido no auto-cadastro: função desejada (CAIXA ou PDV). */
  requestedRole?: 'CAIXA' | 'PDV';
  /** Preenchido no auto-cadastro: PDV específico se solicitou PDV. */
  requestedPdvId?: string;
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
  whatsapp?: PdvWhatsappConfig;
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
// PDV WhatsApp Config
// ---------------------------------------------------------------------------

export type PdvWhatsappConfig = {
  enabled?: boolean;
  instanceName?: string;
  token?: string;
  phoneNumber?: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  lastConnectedAt?: Timestamp | null;
  lastDisconnectedAt?: Timestamp | null;
  lastError?: string;
  updatedAt?: Timestamp;
};

// ---------------------------------------------------------------------------
// PDV (Firestore: /pdvs/{pdvId})
// ---------------------------------------------------------------------------

export type Pdv = {
  id: string;
  nome: string;
  icon?: string;
  tenant_id?: string;
  event_id?: string;
  whatsapp?: PdvWhatsappConfig;
};

// ---------------------------------------------------------------------------
// Estoque & Insumos (Firestore: /pdvs/{pdvId}/ingredients/{ingredientId})
// ---------------------------------------------------------------------------

export type StockControlType = 'NONE' | 'PRODUCT' | 'INGREDIENTS';

export type PdvIngredient = {
  id: string;
  pdv_id: string;
  nome: string;
  quantidade_atual: number;
  unidade: string;
  estoque_minimo?: number;
  updated_at?: Timestamp;
};

export type RecipeItem = {
  ingredient_id: string;
  ingredient_nome: string;
  quantidade: number;
  unidade?: string;
};

// ---------------------------------------------------------------------------
// Log de Auditoria de Insumos (Firestore: /pdvs/{pdvId}/ingredient_logs/{logId})
// ---------------------------------------------------------------------------

export type IngredientLogType =
  | 'SAIDA_VENDA'
  | 'ESTORNO'
  | 'ENTRADA_MANUAL'
  | 'AJUSTE_MANUAL'
  | 'CRIACAO'
  | 'EDICAO'
  | 'EXCLUSAO';

export type IngredientLogItem = {
  ingredient_id?: string;
  ingredient_nome: string;
  quantidade_anterior?: number;
  quantidade_alterada: number;
  quantidade_resultante?: number;
  unidade?: string;
};

export type IngredientLogEntry = {
  id: string;
  pdv_id: string;
  tipo: IngredientLogType;
  titulo: string;
  descricao?: string;
  pedido_numero?: string;
  order_id?: string;
  transacao_id?: string;
  cliente_nome?: string;
  usuario?: string;
  itens_vendidos?: {
    nome: string;
    quantidade: number;
    observacoes?: string | null;
  }[];
  insumos_alterados: IngredientLogItem[];
  created_at: Timestamp;
};

// ---------------------------------------------------------------------------
// Menu Item (Firestore: /pdvs/{pdvId}/menuItems/{itemId})
// ---------------------------------------------------------------------------

export type MenuItem = {
  id: string;
  nome: string;
  preco_centavos: number;
  ingredientes?: string[];
  stock_control_type?: StockControlType;
  estoque_atual?: number;
  estoque_minimo?: number;
  receita?: RecipeItem[];
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

  /** Idempotência e Auditoria de Notificação WhatsApp */
  notification_status?: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
  notification_route?: 'PDV' | 'EVENT_FALLBACK';
  notification_error?: string;
  notified_at?: Timestamp;
};
