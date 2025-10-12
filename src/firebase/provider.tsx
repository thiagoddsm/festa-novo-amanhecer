'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { initializeFirebase } from './';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const firebase = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseContext.Provider value={firebase}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextValue => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
}
export const useFirebaseApp = (): FirebaseApp => useFirebase().app;
export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().firestore;
