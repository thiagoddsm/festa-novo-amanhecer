'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/lib/auth';
import { mapFirebaseAuthToAuthenticatedUser } from '@/lib/auth';
import { FullPageLoader } from '@/components/ui/loader';

type AuthContextType = {
  user: AuthenticatedUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
            const firestore = getFirestore(auth.app);
            const userDocRef = doc(firestore, 'users', firebaseUser.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userProfile = docSnap.data();
                const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(
                    firebaseUser,
                    userProfile
                );
                setUser(authenticatedUser);
            } else {
                 console.error("User profile not found in Firestore. Signing out.");
                 await auth.signOut();
                 setUser(null);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser(null);
        }

      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
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
