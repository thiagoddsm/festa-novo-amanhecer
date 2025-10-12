'use client';

import { ReactNode } from 'react';
import { initializeFirebase } from './';
import { FirebaseProvider } from './provider';

// This provider is responsible for initializing Firebase on the client side.
// It should be used in a client component that is a child of the root layout.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  // We can call this here because we are in a client component.
  // This will only be called once.
  const firebase = initializeFirebase();

  return <FirebaseProvider {...firebase}>{children}</FirebaseProvider>;
}
