import type { User as FirebaseUser } from 'firebase/auth';

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'CAIXA' | 'PDV' | 'VISITANTE';

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  pdvId?: string; // Associated PDV if the role is PDV
  tenants?: { [tenantId: string]: { role: 'ADMIN' | 'CAIXA' | 'PDV'; defaultEventId?: string; allowedEventIds?: string[] } };
};

// This function maps the Firebase User object and the user profile from Firestore
// to a single AuthenticatedUser object.
export const mapFirebaseAuthToAuthenticatedUser = (
  firebaseUser: FirebaseUser,
  userProfile: { [key: string]: any }
): AuthenticatedUser => {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: userProfile.name || firebaseUser.displayName || "Usuário",
    role: userProfile.role || 'VISITANTE', // Default to VISITANTE if role is not set
    pdvId: userProfile.pdvId,
    tenants: userProfile.tenants,
  };
};
