import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

export { FirebaseProvider } from './provider';
export { FirebaseClientProvider } from './client-provider';
export * from './provider';


let firebaseApp: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

/**
 * Initializes and returns a singleton instance of the Firebase application.
 *
 * This function ensures that Firebase is initialized only once, following the singleton pattern.
 * It is designed to work in environments like Next.js where code might be executed multiple times.
 *
 * @returns An object containing the initialized Firebase app, Auth, and Firestore instances.
 *          - `firebaseApp`: The singleton FirebaseApp instance.
 *          - `auth`: The singleton Auth instance.
 *          - `firestore`: The singleton Firestore instance.
 */
export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!firebaseApp) {
      const apps = getApps();
      if (apps.length > 0) {
        firebaseApp = apps[0];
      } else {
        firebaseApp = initializeApp(firebaseConfig);
      }
      auth = getAuth(firebaseApp);
      firestore = getFirestore(firebaseApp);
    }
  }

  return { firebaseApp, auth, firestore };
}
