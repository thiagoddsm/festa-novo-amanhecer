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
}

export const firebaseAdmin = admin;
