import { collection, writeBatch, getDocs, query, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const pdvs = [
    { id: 'caixa_central', nome: 'Caixa Central' },
    { id: 'bebidas', nome: 'Bebidas' },
    { id: 'hamburguer_tradicional', nome: 'Hambúrguer Tradicional' },
    { id: 'hamburguer_artesanal', nome: 'Hambúrguer Artesanal' },
    { id: 'pastel', nome: 'Pastel' },
    { id: 'doces', nome: 'Doces' },
    { id: 'churrasco', nome: 'Churrasco' },
    { id: 'cachorro_quente', nome: 'Cachorro Quente' },
    { id: 'batata_turbinada', nome: 'Batata Turbinada' },
    { id: 'pizza', nome: 'Pizza' },
    { id: 'caldo', nome: 'Caldo' },
];

const menus: Record<string, { nome: string; preco_centavos: number }[]> = {
  bebidas: [
    { nome: 'Refrigerante', preco_centavos: 500 },
    { nome: 'Água', preco_centavos: 300 },
    { nome: 'Cerveja', preco_centavos: 800 },
    { nome: 'Quentão', preco_centavos: 600 },
    { nome: 'Vinho Quente', preco_centavos: 700 },
  ],
  hamburguer_tradicional: [
    { nome: 'Hambúrguer Tradicional', preco_centavos: 1800 },
  ],
  hamburguer_artesanal: [
    { nome: 'Hambúrguer Artesanal', preco_centavos: 2500 },
  ],
  pastel: [
      { nome: 'Pastel de Carne', preco_centavos: 700 },
      { nome: 'Pastel de Queijo', preco_centavos: 700 },
  ],
  doces: [
      { nome: 'Doce de Pote', preco_centavos: 800 },
      { nome: 'Canjica', preco_centavos: 900 },
  ],
  churrasco: [
      { nome: 'Espetinho de Carne', preco_centavos: 1200 },
      { nome: 'Espetinho de Frango', preco_centavos: 1000 },
  ],
  cachorro_quente: [
      { nome: 'Cachorro Quente', preco_centavos: 1000 },
  ],
  batata_turbinada: [
      { nome: 'Batata Turbinada', preco_centavos: 1500 },
  ],
  pizza: [
      { nome: 'Fatia de Pizza', preco_centavos: 1000 },
  ],
  caldo: [
      { nome: 'Caldo de Feijão', preco_centavos: 1500 },
      { nome: 'Caldo Verde', preco_centavos: 1500 },
  ],
};

export async function seedPdvsAndMenus(db: Firestore) {
  const batch = writeBatch(db);

  // Check if PDVs already exist to prevent duplicates
  const pdvCollection = collection(db, 'pdvs');
  const q = query(pdvCollection);
  const existingPdvs = await getDocs(q);

  if (existingPdvs.size > 0) {
      console.log('PDVs já existem. O processo de "seed" será interrompido.');
      throw new Error('O banco de dados já parece estar populado. Para recomeçar, por favor, limpe a coleção "pdvs" no seu console do Firebase antes de continuar.');
  }

  // Add PDVs
  pdvs.forEach(pdvData => {
    const pdvRef = doc(db, 'pdvs', pdvData.id);
    batch.set(pdvRef, { nome: pdvData.nome });
  });

  // Add Menu Items
  for (const pdvId in menus) {
    if (pdvId === 'caixa_central') continue;
    const menuItems = menus[pdvId];
    menuItems.forEach(item => {
      const itemRef = doc(collection(db, `pdvs/${pdvId}/menuItems`));
      batch.set(itemRef, item);
    });
  }

  await batch.commit();
  console.log('PDVs e Menus populados com sucesso!');
}
