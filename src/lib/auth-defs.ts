import type { User as FirebaseUser } from 'firebase/auth';
import type { UserRole, TenantAccess } from './definitions';

export type { UserRole };

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  pdvId?: string;
  /** Mapa de tenantId → acesso dentro daquele tenant. */
  tenants?: { [tenantId: string]: TenantAccess };
  requestedTenantId?: string;
  requestedEventId?: string;
  requestedRole?: 'CAIXA' | 'PDV';
  requestedPdvId?: string;
};

// Maps Firebase Auth user + Firestore profile → AuthenticatedUser
export const mapFirebaseAuthToAuthenticatedUser = (
  firebaseUser: FirebaseUser,
  userProfile: { [key: string]: any }
): AuthenticatedUser => {
  const isMasterAdmin = firebaseUser.email === 'thiagoddsm@gmail.com';
  let role: UserRole = userProfile?.role || 'VISITANTE';
  if (isMasterAdmin) {
    role = 'SUPERADMIN';
  } else if ((role as string) === 'ADMIN') {
    role = 'ADMIN_ORGANIZACAO';
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: userProfile?.name || userProfile?.nome || firebaseUser.displayName || 'Usuário',
    role,
    pdvId: userProfile?.pdvId,
    tenants: userProfile?.tenants,
    requestedTenantId: userProfile?.requestedTenantId,
    requestedEventId: userProfile?.requestedEventId,
    requestedRole: userProfile?.requestedRole,
    requestedPdvId: userProfile?.requestedPdvId,
  };
};

