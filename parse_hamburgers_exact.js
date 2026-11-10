const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('relatorio_vendas_festa_novo_amanhecer_2026.csv', 'utf8'),
  crlfDelay: Infinity
});

let isHeader = true;

// Aggregation by Date
// date -> { [product]: { quantity: 0, revenue: 0, unitPrice: 0 } }
const dailyReport = {};
const overallReport = {};
const pdvReport = {};
const daysMap = {
  '07/11/2025': 'Sexta-feira (07/11)',
  '08/11/2025': 'Sábado (08/11)',
  '09/11/2025': 'Domingo (09/11)'
};

const unparsed = [];
let totalBurgersAllDays = 0;
let totalRevenueAllDays = 0;

rl.on('line', (line) => {
  if (isHeader) { isHeader = false; return; }
  const cleanLine = line.trim();
  if (!cleanLine) return;

  const parts = cleanLine.split(';').map(p => p.replace(/^"|"$/g, ''));
  if (parts.length < 11) return;

  const id = parts[0];
  const dataHora = parts[1];
  const tipo = parts[2];
  const pdv = parts[3];
  const valorTotalStr = parts[4];
  const itensStr = parts[10];

  const dateMatch = dataHora.match(/^(\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch ? dateMatch[1] : 'Outras Datas';

  // Only consider consumption / sales
  const isPdvBurger = pdv.toLowerCase().includes('hamb') || pdv.toLowerCase().includes('burger');
  const hasBurgerInItems = itensStr && (
    itensStr.toLowerCase().includes('hamb') || 
    itensStr.toLowerCase().includes('smash') || 
    itensStr.toLowerCase().includes('burger')
  );

  if (!isPdvBurger && !hasBurgerInItems) return;

  if (!dailyReport[date]) dailyReport[date] = {};
  if (!pdvReport[pdv]) pdvReport[pdv] = {};

  if (itensStr && itensStr.trim()) {
    // Split on pipe ONLY when followed by a quantity like "1x"
    // e.g. " | 1x" or " | 2x"
    const itemTokens = itensStr.split(/\s*\|\s*(?=\d+x\s+)/);

    for (const token of itemTokens) {
      // Regex to extract quantity, product name, price, and optional obs
      // e.g. "1x Smash Duplo (R$ 25,00) [Obs: SEM: [queijo] | OBS: SEM QUEIJO]"
      const match = token.match(/^(\d+)x\s+([^(\[]+)(?:\s*\(R\$\s*([\d,.]+)\))?(?:\s*\[Obs:[\s\S]*?\])?$/);
      if (match) {
        const qty = parseInt(match[1], 10);
        const rawName = match[2].trim();
        const priceStr = match[3] ? match[3].replace(',', '.') : '0';
        const unitPrice = parseFloat(priceStr);
        const revenue = unitPrice * qty;

        // Is this specific item a burger?
        if (
          isPdvBurger || 
          rawName.toLowerCase().includes('hamb') || 
          rawName.toLowerCase().includes('smash') || 
          rawName.toLowerCase().includes('burger')
        ) {
          if (!dailyReport[date][rawName]) {
            dailyReport[date][rawName] = { quantity: 0, revenue: 0, unitPrice: unitPrice };
          }
          dailyReport[date][rawName].quantity += qty;
          dailyReport[date][rawName].revenue += revenue;

          if (!overallReport[rawName]) {
            overallReport[rawName] = { quantity: 0, revenue: 0, unitPrice: unitPrice };
          }
          overallReport[rawName].quantity += qty;
          overallReport[rawName].revenue += revenue;

          if (!pdvReport[pdv][rawName]) {
            pdvReport[pdv][rawName] = 0;
          }
          pdvReport[pdv][rawName] += qty;

          totalBurgersAllDays += qty;
          totalRevenueAllDays += revenue;
        }
      } else {
        unparsed.push({ token, line });
      }
    }
  } else {
    // Blank items in burger PDV
    const name = `Avulso (${pdv})`;
    const valorReais = parseFloat(valorTotalStr.replace(',', '.')) || 0;
    if (!dailyReport[date][name]) {
      dailyReport[date][name] = { quantity: 0, revenue: 0, unitPrice: 0 };
    }
    dailyReport[date][name].quantity += 1;
    dailyReport[date][name].revenue += valorReais;
  }
});

rl.on('close', () => {
  console.log('UNPARSED COUNT:', unparsed.length);
  if (unparsed.length > 0) {
    console.log('Unparsed tokens:', unparsed);
  }

  console.log('\n======================================================');
  console.log('RELATÓRIO DETALHADO DE VENDAS DE HAMBÚRGUER POR DIA');
  console.log('======================================================\n');

  for (const [date, prods] of Object.entries(dailyReport)) {
    const label = daysMap[date] || date;
    console.log(`📌 ${label}`);
    let dayQty = 0;
    let dayRev = 0;
    for (const [pName, data] of Object.entries(prods)) {
      console.log(`   • ${pName.padEnd(25)}: ${String(data.quantity).padStart(3)} un  x  R$ ${data.unitPrice.toFixed(2).padStart(5)}  =  R$ ${data.revenue.toFixed(2).padStart(7)}`);
      dayQty += data.quantity;
      dayRev += data.revenue;
    }
    console.log(`   👉 TOTAL DO DIA: ${dayQty} hambúrgueres | R$ ${dayRev.toFixed(2)}\n`);
  }

  console.log('======================================================');
  console.log('TOTAL GERAL DE TODA A FESTA POR TIPO');
  console.log('======================================================');
  for (const [pName, data] of Object.entries(overallReport)) {
    console.log(` • ${pName.padEnd(25)}: ${String(data.quantity).padStart(3)} un  |  R$ ${data.revenue.toFixed(2).padStart(8)}`);
  }
  console.log('------------------------------------------------------');
  console.log(` TOTAL GERAL VENDIDO: ${totalBurgersAllDays} hambúrgueres | R$ ${totalRevenueAllDays.toFixed(2)}\n`);

  console.log('======================================================');
  console.log('DISTRIBUIÇÃO POR BARRACA (PDV)');
  console.log('======================================================');
  for (const [pdv, prods] of Object.entries(pdvReport)) {
    console.log(`🏠 ${pdv}:`);
    for (const [pName, qty] of Object.entries(prods)) {
      console.log(`   - ${pName}: ${qty} un`);
    }
  }
});
