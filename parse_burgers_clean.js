const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('relatorio_vendas_festa_novo_amanhecer_2026.csv', 'utf8'),
  crlfDelay: Infinity
});

let isHeader = true;

// Daily stats
// day -> { [productName]: { quantity: number, totalRevenue: number } }
const statsByDay = {};
const overallProductTotals = {};
let totalHamburgersCount = 0;
let totalHamburgersRevenue = 0;

// Track all PDVs and their items
const pdvsWithBurgers = new Set();
const unparsedLines = [];

function normalizeProductName(rawName) {
  const clean = rawName.trim();
  // Normalize variations
  if (/^hamb[uú]rguer\s+tradicional$/i.test(clean)) return 'Hambúrguer Tradicional';
  if (/^smash\s+simples$/i.test(clean)) return 'Smash Simples';
  if (/^smash\s+duplo$/i.test(clean)) return 'Smash Duplo';
  if (/^hamb[uú]rguer\s+duplo$/i.test(clean)) return 'Hambúrguer Duplo';
  if (/^hamb[uú]rguer$/i.test(clean)) return 'Hambúrguer'; // or Tradicional? Let's check
  return clean;
}

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
  const valorCentavos = parseInt(parts[5] || '0', 10);
  const itensStr = parts[10];

  // Only consider consumption / sales (not card top-ups)
  if (tipo !== 'CONSUMO' && tipo !== 'VENDA' && tipo !== 'PAGAMENTO' && tipo !== 'VENDA_PRODUTOS') {
    // Let's check what types exist
  }

  const dateMatch = dataHora.match(/^(\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch ? dateMatch[1] : 'Data Desconhecida';

  // Check if this transaction has burger
  const isPdvBurger = pdv.toLowerCase().includes('hamb') || pdv.toLowerCase().includes('burger');
  const hasBurgerInItems = itensStr && (itensStr.toLowerCase().includes('hamb') || itensStr.toLowerCase().includes('smash') || itensStr.toLowerCase().includes('burger'));

  if (!isPdvBurger && !hasBurgerInItems) return;

  pdvsWithBurgers.add(pdv);

  if (!statsByDay[date]) {
    statsByDay[date] = {};
  }

  if (itensStr && itensStr.trim()) {
    // Split multiple items by " | "
    const subItems = itensStr.split(' | ');
    for (const subItem of subItems) {
      // Regex format: "(\d+)x (.*?)(?: \(R\$ ([\d,.]+)\))?(?: \[Obs: .*?\])?"
      // e.g.: "1x Smash Duplo (R$ 25,00) [Obs: SEM: [chutney de manga]]"
      // or "2x Hambúrguer Tradicional (R$ 16,00)"
      const match = subItem.match(/^(\d+)x\s+([^(\[]+)(?:\s*\(R\$\s*([\d,.]+)\))?(?:\s*\[Obs:.*?\])?$/i);
      
      if (match) {
        const qty = parseInt(match[1], 10);
        let prodName = match[2].trim();
        const priceStr = match[3] ? match[3].replace(',', '.') : '0';
        const unitPrice = parseFloat(priceStr);
        const itemRevenue = unitPrice * qty;

        // Is this item a burger?
        if (isPdvBurger || prodName.toLowerCase().includes('hamb') || prodName.toLowerCase().includes('smash') || prodName.toLowerCase().includes('burger')) {
          const normName = normalizeProductName(prodName);
          
          if (!statsByDay[date][normName]) {
            statsByDay[date][normName] = { quantity: 0, revenue: 0, unitPrice: unitPrice };
          }
          statsByDay[date][normName].quantity += qty;
          statsByDay[date][normName].revenue += itemRevenue;

          if (!overallProductTotals[normName]) {
            overallProductTotals[normName] = { quantity: 0, revenue: 0 };
          }
          overallProductTotals[normName].quantity += qty;
          overallProductTotals[normName].revenue += itemRevenue;

          totalHamburgersCount += qty;
          totalHamburgersRevenue += itemRevenue;
        }
      } else {
        unparsedLines.push({ subItem, line });
      }
    }
  } else {
    // Transaction has no detailed items, but is in a Burger PDV
    const normName = `Venda sem detalhamento (${pdv})`;
    const valorReais = parseFloat(valorTotalStr.replace(',', '.')) || (valorCentavos / 100);
    if (!statsByDay[date][normName]) {
      statsByDay[date][normName] = { quantity: 0, revenue: 0, unitPrice: 0 };
    }
    statsByDay[date][normName].quantity += 1;
    statsByDay[date][normName].revenue += valorReais;
  }
});

rl.on('close', () => {
  console.log('=== PDVs COM HAMBÚRGUER ===');
  console.log(Array.from(pdvsWithBurgers));

  console.log('\n=== UNPARSED ITEMS (se houver) ===');
  console.log(unparsedLines);

  console.log('\n=== VENDAS POR DIA E PRODUTO ===');
  for (const [day, prods] of Object.entries(statsByDay)) {
    console.log(`\n--- DIA: ${day} ---`);
    let dayTotalQty = 0;
    let dayTotalRev = 0;
    for (const [pName, pStats] of Object.entries(prods)) {
      console.log(`  ${pName.padEnd(25)}: ${String(pStats.quantity).padStart(4)} un  |  R$ ${pStats.revenue.toFixed(2).padStart(8)}`);
      dayTotalQty += pStats.quantity;
      dayTotalRev += pStats.revenue;
    }
    console.log(`  TOTAL DO DIA             : ${String(dayTotalQty).padStart(4)} un  |  R$ ${dayTotalRev.toFixed(2).padStart(8)}`);
  }

  console.log('\n=== TOTAL GERAL POR PRODUTO ===');
  for (const [pName, pStats] of Object.entries(overallProductTotals)) {
    console.log(`  ${pName.padEnd(25)}: ${String(pStats.quantity).padStart(4)} un  |  R$ ${pStats.revenue.toFixed(2).padStart(8)}`);
  }
  console.log(`  TOTAL GERAL              : ${String(totalHamburgersCount).padStart(4)} un  |  R$ ${totalHamburgersRevenue.toFixed(2).padStart(8)}`);
});
