import type { Pdv } from './definitions';

// This file now only contains mock data for PDVs.
// Card and Transaction data is now managed by Firestore.

let pdvs: Pdv[] = [
  { id: 1, nome: 'Caixa Central', chave_api: 'api-key-caixa' },
  { id: 2, nome: 'Barraca de Salgados', chave_api: 'api-key-salgados' },
  { id: 3, nome: 'Barraca de Bebidas', chave_api: 'api-key-bebidas' },
  { id: 4, nome: 'Food Truck de Burger', chave_api: 'api-key-burger' },
];

export function generateRandomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 18; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- PDV FUNCTIONS ---
export const getPdvs = (): Pdv[] => {
    return pdvs.filter(p => p.id !== 1); // Exclude Caixa Central
}

export const getPdvById = (id: number): Pdv | undefined => {
    return pdvs.find(p => p.id === id);
}
