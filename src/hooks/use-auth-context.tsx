'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { useAuth as useFirebaseAuth, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/lib/auth';
import { mapFirebaseAuthToAuthenticatedUser } from '@/lib/auth';

type AuthContextType = {
  user: AuthenticatedUser | null;
  loading: boolean;
  setMasterUser: () => void; // Add this function
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to set a master admin user for bypass
  const setMasterUser = () => {
    const masterUser: AuthenticatedUser = {
      uid: 'master-admin-uid',
      email: 'admin@festapay.com',
      name: 'Admin Master',
      role: 'ADMIN',
    };
    setUser(masterUser);
    setLoading(false);
  };

  useEffect(() => {
    if (!auth) {
        setLoading(false);
        return;
    }

    const unsubscribe = onIdTokenChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const firestore = getFirestore(auth.app);
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);

        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                const userProfile = docSnap.data();
                const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(
                    firebaseUser,
                    userProfile
                );
                setUser(authenticatedUser);
            } else {
                 console.error("User profile not found in Firestore. Signing out.");
                 auth.signOut();
                 setUser(null);
            }
        }).catch(error => {
            // This is where permission errors will be caught.
            const contextualError = new FirestorePermissionError({
                operation: 'get',
                path: userDocRef.path,
            });
            errorEmitter.emit('permission-error', contextualError);
            auth.signOut(); // Log out the user as we can't verify their role.
            setUser(null);
        }).finally(() => {
            setLoading(false);
        });

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <AuthContext.Provider value={{ user, loading, setMasterUser }}>
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
