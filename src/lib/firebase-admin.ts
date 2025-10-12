'use server';
import admin from 'firebase-admin';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error('A variável de ambiente FIREBASE_SERVICE_ACCOUNT não está definida.');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // If the app is already initialized, get the default app
  // This can happen in development environments with hot-reloading
  admin.app();
}


export const firebaseAdmin = admin;
