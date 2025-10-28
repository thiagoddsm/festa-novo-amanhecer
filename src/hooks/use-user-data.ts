'use client';

import { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { AuthenticatedUser } from '@/lib/auth';
import { mapFirebaseAuthToAuthenticatedUser } from '@/lib/auth';

export function useUserData() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !firestore) {
      // Firebase is not initialized yet.
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
      if (firebaseUser) {
        // User is signed in, get their profile from Firestore.
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const unsubProfile = onSnapshot(userDocRef, docSnap => {
          if (docSnap.exists()) {
            const userProfile = docSnap.data();
            const authenticatedUser = mapFirebaseAuthToAuthenticatedUser(
              firebaseUser,
              userProfile
            );
            setUser(authenticatedUser);
          } else {
            // User profile doesn't exist in Firestore.
            // This could be an error state, or you might want to create a profile here.
            setUser(null);
          }
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        // User is signed out.
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return { user, loading };
}
