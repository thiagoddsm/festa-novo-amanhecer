'use client';

import { initializeFirebase, FirebaseProvider } from '@/firebase';
import { ReactNode } from 'react';

// Initialize firebase on the client
const { firebaseApp, firestore, auth } = initializeFirebase();

/**
 * A client-side component that initializes Firebase and provides it to its children.
 * This should be used at the top-level of the client-side application.
 */
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      firestore={firestore}
      auth={auth}
    >
      {children}
    </FirebaseProvider>
  );
}
