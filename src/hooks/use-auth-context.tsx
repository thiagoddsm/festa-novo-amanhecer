'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, type User, signOut as firebaseSignOut } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/lib/auth-defs';
import { mapFirebaseAuthToAuthenticatedUser } from '@/lib/auth-defs';
import { useToast } from './use-toast';


type AuthContextType = {
  user: AuthenticatedUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        setLoading(true);
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          let docSnap = await getDoc(userDocRef);

          if (!docSnap.exists()) {
            // If the user profile doesn't exist, create it.
            // This is crucial for first-time Google sign-ins.
            const newUserProfile = {
                name: firebaseUser.displayName || firebaseUser.email || 'Novo Usuário',
                email: firebaseUser.email,
                role: 'CAIXA', // Default role for any new user
                pdvId: null,
            };
            await setDoc(userDocRef, newUserProfile);
            // Re-fetch the document to ensure we have the latest data
            docSnap = await getDoc(userDocRef);
          }

          const userProfile = docSnap.data();
          const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(firebaseUser, userProfile!);
          setUser(authenticatedUser);

        } catch (error) {
          console.error("Error fetching or creating user profile:", error);
          toast({
            variant: "destructive",
            title: "Erro de Autenticação",
            description: "Não foi possível verificar seu perfil. Por favor, tente novamente."
          });
          await firebaseSignOut(auth);
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        // No Firebase user found
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore, toast]);

  const signOut = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null); // Clear user state immediately
    } catch (error) {
      console.error("Error signing out: ", error);
       toast({
        variant: "destructive",
        title: "Erro ao Sair",
        description: "Não foi possível encerrar a sessão."
      });
    } finally {
        // The onIdTokenChanged listener will also set loading to false
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
        {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
