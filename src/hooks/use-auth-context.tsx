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

// This function checks if a user profile exists and creates one on first login.
// It's the key to fixing the "profile not found" error.
const checkAndCreateUserProfile = async (firestore: any, user: User): Promise<void> => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
            // If the user profile doesn't exist, create it.
            // This is crucial for first-time sign-ins.
            const newUserProfile = {
                name: user.displayName || user.email || 'Novo Usuário',
                email: user.email,
                role: 'CAIXA', // Default role for any new user
                pdvId: null,
            };
            await setDoc(userDocRef, newUserProfile);
            console.log(`Created profile for new user: ${user.uid}`);
        }
    } catch (error) {
        console.error("Error in checkAndCreateUserProfile: ", error);
        // We might want to handle this error more gracefully, but for now, we log it.
    }
};

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

        // Ensure the user profile exists before proceeding.
        await checkAndCreateUserProfile(firestore, firebaseUser);

        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const userProfile = docSnap.data();
            const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(firebaseUser, userProfile!);
            setUser(authenticatedUser);
          } else {
            // This case should be rare now, but as a fallback, we log out to prevent loops.
            console.error("User profile not found in Firestore after creation attempt. Signing out.");
            toast({
                variant: "destructive",
                title: "Erro de Perfil",
                description: "Não foi possível carregar seu perfil. Tente novamente."
            });
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          toast({
            variant: "destructive",
            title: "Erro de Autenticação",
            description: "Não foi possível verificar seu perfil."
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
      setUser(null);
    } catch (error) {
      console.error("Error signing out: ", error);
       toast({
        variant: "destructive",
        title: "Erro ao Sair",
        description: "Não foi possível encerrar a sessão."
      });
    } finally {
        setLoading(false);
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
