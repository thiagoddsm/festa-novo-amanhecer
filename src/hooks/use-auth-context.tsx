'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, type User, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/lib/auth-defs';
import { mapFirebaseAuthToAuthenticatedUser } from '@/lib/auth-defs';
import { useToast } from './use-toast';

type AuthContextType = {
  user: AuthenticatedUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This function checks if a user profile exists and creates one on first login.
const checkAndCreateUserProfile = async (firestore: any, user: User): Promise<void> => {
    if (!user) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) {
            // If the user profile doesn't exist, create it.
            console.log(`Profile for ${user.uid} not found, creating...`);

            // Check if this is the very first user signing up to grant admin rights.
            const usersCollectionRef = collection(firestore, 'users');
            const allUsersSnap = await getDocs(usersCollectionRef);
            const isFirstUser = allUsersSnap.empty;

            const newUserProfile = {
                name: user.displayName || user.email || 'Novo Usuário',
                email: user.email,
                role: isFirstUser ? 'ADMIN' : 'CAIXA', // Make first user ADMIN
                pdvId: null,
            };
            await setDoc(userDocRef, newUserProfile);
            console.log(`Created profile for new user: ${user.uid} with role: ${newUserProfile.role}`);
        }
    } catch (error) {
        console.error("Error in checkAndCreateUserProfile: ", error);
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
      setLoading(true);
      if (firebaseUser) {
        await checkAndCreateUserProfile(firestore, firebaseUser);

        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const userProfile = docSnap.data();
            const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(firebaseUser, userProfile!);
            setUser(authenticatedUser);
          } else {
             console.error("User profile not found in Firestore after creation attempt. Signing out.");
             toast({
                variant: "destructive",
                title: "Erro de Perfil",
                description: "Seu perfil não foi encontrado e não pôde ser criado. Tente novamente."
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
        }
      } else {
        // No Firebase user found
        setUser(null);
      }
       setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore, toast]);

  const signInWithGoogle = async () => {
    if (!auth) return;
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        // onIdTokenChanged will handle profile creation and redirection
    } catch (error: any) {
        if (error.code !== 'auth/popup-closed-by-user') {
            toast({ variant: 'destructive', title: 'Erro de Login', description: 'Não foi possível fazer login com o Google.' });
        }
    } finally {
      // setLoading(false); // Let the listener handle the loading state
    }
  }

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
    <AuthContext.Provider value={{ user, loading, signOut, signInWithGoogle }}>
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
