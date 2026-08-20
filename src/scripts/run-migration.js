const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({
    projectId: "fiscalflow-zetbu"
  });
}

const db = getFirestore();

async function runMigration() {
  console.log('🚀 Iniciando script de migração de dados existentes...');

  const targetTenantSlug = 'igreja-batista-da-manha';
  const targetTenantName = 'Igreja Batista da Manhã';
  const targetEventName = 'Festa Novo Amanhecer 2026';

  // 1. Criar ou Obter Tenant 'igreja-batista-da-manha'
  const tenantRef = db.collection('tenants').doc(targetTenantSlug);
  const tenantDoc = await tenantRef.get();

  if (!tenantDoc.exists) {
    await tenantRef.set({
      name: targetTenantName,
      slug: targetTenantSlug,
      plan: 'PRO',
      status: 'ACTIVE',
      created_at: Timestamp.now(),
    });
    console.log(`✅ Tenant '${targetTenantName}' criado com sucesso.`);
  } else {
    console.log(`ℹ️ Tenant '${targetTenantName}' já existe.`);
  }

  // 2. Criar ou Obter Evento 'Festa Novo Amanhecer 2026'
  const eventsRef = tenantRef.collection('events');
  const eventsSnapshot = await eventsRef.where('name', '==', targetEventName).get();
  let targetEventId = '';

  if (eventsSnapshot.empty) {
    const newEventRef = await eventsRef.add({
      tenant_id: targetTenantSlug,
      name: targetEventName,
      status: 'ACTIVE',
      created_at: Timestamp.now(),
    });
    targetEventId = newEventRef.id;
    console.log(`✅ Evento '${targetEventName}' criado com ID: ${targetEventId}`);
  } else {
    targetEventId = eventsSnapshot.docs[0].id;
    console.log(`ℹ️ Evento '${targetEventName}' encontrado com ID: ${targetEventId}`);
  }

  // 3. Migrar Todos os Cartões (cards)
  const cardsSnapshot = await db.collection('cards').get();
  let cardsMigrated = 0;
  for (const docSnap of cardsSnapshot.docs) {
    await docSnap.ref.update({
      tenant_id: targetTenantSlug,
      event_id: targetEventId,
    });
    cardsMigrated++;
  }
  console.log(`✅ ${cardsMigrated} cartões migrados para o evento '${targetEventName}'.`);

  // 4. Migrar Todas as Transações (transactions)
  const txSnapshot = await db.collection('transactions').get();
  let txMigrated = 0;
  for (const docSnap of txSnapshot.docs) {
    await docSnap.ref.update({
      tenant_id: targetTenantSlug,
      event_id: targetEventId,
    });
    txMigrated++;
  }
  console.log(`✅ ${txMigrated} transações migradas para o evento '${targetEventName}'.`);

  // 5. Migrar Todos os PDVs (pdvs)
  const pdvsSnapshot = await db.collection('pdvs').get();
  let pdvsMigrated = 0;
  for (const docSnap of pdvsSnapshot.docs) {
    await docSnap.ref.update({
      tenant_id: targetTenantSlug,
      event_id: targetEventId,
    });
    pdvsMigrated++;
  }
  console.log(`✅ ${pdvsMigrated} PDVs migrados para o evento '${targetEventName}'.`);

  console.log('🎉 Migração concluída com sucesso!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
