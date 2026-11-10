const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('relatorio_vendas_festa_novo_amanhecer_2026.csv', 'utf8'),
  crlfDelay: Infinity
});

let isHeader = true;
const pdvMap = {};
const allHamburguerItems = {};
const dates = new Set();

// Aggregation by date and item
// structure: { [date]: { [itemName]: totalQty } }
const salesByDayAndItem = {};
let totalBurgersOverall = 0;

rl.on('line', (line) => {
  if (isHeader) {
    isHeader = false;
    return;
  }
  
  // Format: "ID Transação";"Data/Hora";"Tipo";"Ponto de Venda (PDV)";"Valor (R$)";"Valor (Centavos)";"QR Code Cartão";"Nome Cliente";"Telefone Cliente";"Operador Responsável";"Itens / Produtos Detalhados"
  // Split considering semicolons inside quotes or standard split
  const cleanLine = line.trim();
  if (!cleanLine) return;

  const parts = cleanLine.split(';').map(p => p.replace(/^"|"$/g, ''));
  if (parts.length < 11) return;

  const dataHora = parts[1];
  const tipo = parts[2];
  const pdv = parts[3];
  const valor = parts[4];
  const itensStr = parts[10];

  const dateMatch = dataHora.match(/^(\d{2}\/\d{2}\/\d{4})/);
  const date = dateMatch ? dateMatch[1] : 'Data Desconhecida';
  dates.add(date);

  // Check if PDV is hamburguer or item mentions hamburguer
  const isPdvHamburguer = pdv.toLowerCase().includes('hamb') || pdv.toLowerCase().includes('burger');
  
  if (isPdvHamburguer || (itensStr && (itensStr.toLowerCase().includes('hamb') || itensStr.toLowerCase().includes('burger')))) {
    if (!salesByDayAndItem[date]) {
      salesByDayAndItem[date] = {};
    }

    // Parse items: e.g. "2x X-Burguer (R$ 40,00), 1x Smash Burger (R$ 25,00)"
    if (itensStr && itensStr.trim()) {
      // Split items by comma or semicolon
      const items = itensStr.split(/,\s*(?=\d+x)/);
      for (const item of items) {
        // e.g. "2x Hamburguer Artesanal (R$ 30,00)" or "1x X-Tudo"
        const match = item.match(/^(\d+)x\s*(.*?)(?:\s*\([^\)]*\))?$/);
        if (match) {
          const qty = parseInt(match[1], 10);
          const name = match[2].trim();
          salesByDayAndItem[date][name] = (salesByDayAndItem[date][name] || 0) + qty;
          allHamburguerItems[name] = (allHamburguerItems[name] || 0) + qty;
          totalBurgersOverall += qty;
        } else {
          // If no "Nx" prefix, maybe just product name
          const name = item.trim();
          salesByDayAndItem[date][name] = (salesByDayAndItem[date][name] || 0) + 1;
          allHamburguerItems[name] = (allHamburguerItems[name] || 0) + 1;
          totalBurgersOverall += 1;
        }
      }
    } else {
      // Item string is empty, but PDV is hamburguer!
      const name = `Venda Avulsa no PDV (${pdv})`;
      salesByDayAndItem[date][name] = (salesByDayAndItem[date][name] || 0) + 1;
      allHamburguerItems[name] = (allHamburguerItems[name] || 0) + 1;
    }
  }
});

rl.on('close', () => {
  console.log('=== DATAS ENCONTRADAS ===');
  console.log(Array.from(dates));
  console.log('\n=== TODOS OS TIPOS DE ITENS DE HAMBÚRGUER ===');
  console.log(allHamburguerItems);
  console.log('\n=== VENDAS POR DIA E TIPO ===');
  console.log(JSON.stringify(salesByDayAndItem, null, 2));
  console.log('\nTotal de hambúrgueres:', totalBurgersOverall);
});
