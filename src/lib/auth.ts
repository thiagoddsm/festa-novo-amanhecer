import 'server-only';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdmin } from './firebase-admin';


export type AuthenticatedUser = {
    isAuthenticated: boolean;
    role: 'CAIXA' | 'PDV';
    name: string;
    pdvId?: number;
}


export async function checkAuth(): Promise<{ user: AuthenticatedUser | null }> {
    const sessionCookie = cookies().get('firebase-session')?.value;

    if (!sessionCookie) {
        return { user: null };
    }

    try {
        if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp();
        }
        const decodedIdToken = await getAuth(firebaseAdmin.app()).verifySessionCookie(sessionCookie, true);

        // This is where you would fetch user role from your database.
        // For now, we'll hardcode it to 'CAIXA'.
        const user: AuthenticatedUser = {
            isAuthenticated: true,
            role: 'CAIXA',
            name: decodedIdToken.name || 'Usuário',
        };
        return { user };
    } catch (error) {
        console.error("Error verifying session cookie in checkAuth:", error);
        return { user: null };
    }
}
