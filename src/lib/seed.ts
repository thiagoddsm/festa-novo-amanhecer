import { collection, writeBatch, getDocs, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const pdvs = [
  { id: 'caixa_central', nome: 'Caixa Central' },
  { id: 'bebidas', nome: 'Barraca de Bebidas' },
  { id: 'burger', nome: 'Food Truck de Burger' },
  { id: 'salgados', nome: 'Barraca de Salgados' },
  { id: 'churrasco', nome: 'Churrasco' },
  { id: 'pizza_caldo', nome: 'Pizza e Caldo' },
  { id: 'doces_quentes', nome: 'Doces e Bebidas Quentes' },
];

const menus: Record<string, { nome: string; preco_centavos: number }[]> = {
  bebidas: [
    { nome: 'Refrigerante', preco_centavos: 500 },
    { nome: 'Água', preco_centavos: 300 },
    { nome: 'Cerveja', preco_centavos: 800 },
  ],
  burger: [
    { nome: 'Hambúrguer Artesanal', preco_centavos: 2500 },
    { nome: 'Hambúrguer Tradicional', preco_centavos: 1800 },
    { nome: 'Batata Turbinada', preco_centavos: 1500 },
  ],
  salgados: [
      { nome: 'Pastel de Carne', preco_centavos: 700 },
      { nome: 'Pastel de Queijo', preco_centavos: 700 },
      { nome: 'Cachorro Quente', preco_centavos: 1000 },
  ],
  churrasco: [
      { nome: 'Espetinho de Carne', preco_centavos: 1200 },
      { nome: 'Espetinho de Frango', preco_centavos: 1000 },
  ],
  pizza_caldo: [
      { nome: 'Fatia de Pizza', preco_centavos: 1000 },
      { nome: 'Caldo de Feijão', preco_centavos: 1500 },
      { nome: 'Caldo Verde', preco_centavos: 1500 },
  ],
  doces_quentes: [
      { nome: 'Doce de Pote', preco_centavos: 800 },
      { nome: 'Quentão', preco_centavos: 600 },
      { nome: 'Vinho Quente', preco_centavos: 700 },
  ]
};

export async function seedPdvsAndMenus(db: Firestore) {
  const batch = writeBatch(db);

  // Check if PDVs already exist to prevent duplicates
  const pdvCollection = collection(db, 'pdvs');
  const q = query(pdvCollection);
  const existingPdvs = await getDocs(q);

  if (existingPdvs.size > 0) {
      console.log('PDVs já existem. O processo de "seed" será interrompido.');
      throw new Error('O banco de dados já parece estar populado. A operação foi cancelada para evitar duplicatas.');
  }

  // Add PDVs
  pdvs.forEach(pdv => {
    const pdvRef = collection(db, 'pdvs').doc(pdv.id);
    batch.set(pdvRef, { nome: pdv.nome });
  });

  // Add Menu Items
  for (const pdvId in menus) {
    const menuItems = menus[pdvId];
    menuItems.forEach(item => {
      const itemRef = collection(db, `pdvs/${pdvId}/menuItems`).doc();
      batch.set(itemRef, item);
    });
  }

  await batch.commit();
  console.log('PDVs e Menus populados com sucesso!');
}
