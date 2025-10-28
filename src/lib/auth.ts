import type { User as FirebaseUser } from 'firebase/auth';

export type UserRole = 'ADMIN' | 'CAIXA' | 'PDV';

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  pdvId?: string; // Associated PDV if the role is PDV
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
    name: userProfile.name || firebaseUser.displayName,
    role: userProfile.role || 'CAIXA', // Default to CAIXA if role is not set
    pdvId: userProfile.pdvId,
  };
};
