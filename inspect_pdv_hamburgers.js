const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('relatorio_vendas_festa_novo_amanhecer_2026.csv', 'utf8'),
  crlfDelay: Infinity
});

let isHeader = true;

const pdvProductMap = {};

rl.on('line', (line) => {
  if (isHeader) { isHeader = false; return; }
  const parts = line.split(';').map(p => p.replace(/^"|"$/g, ''));
  if (parts.length < 11) return;

  const pdv = parts[3];
  const itensStr = parts[10];

  if (pdv.toLowerCase().includes('hamb') || (itensStr && itensStr.toLowerCase().includes('hamb'))) {
    if (!pdvProductMap[pdv]) pdvProductMap[pdv] = new Set();
    if (itensStr) {
      pdvProductMap[pdv].add(itensStr);
    }
  }
});

rl.on('close', () => {
  for (const [pdv, items] of Object.entries(pdvProductMap)) {
    console.log(`\nPDV: ${pdv} (total unique strings: ${items.size})`);
    console.log(Array.from(items).slice(0, 10));
  }
});
