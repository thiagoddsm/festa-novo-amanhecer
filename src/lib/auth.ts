
export type AuthenticatedUser = {
    isAuthenticated: boolean;
    role: 'CAIXA' | 'PDV';
    name: string;
    pdvId?: number;
}
