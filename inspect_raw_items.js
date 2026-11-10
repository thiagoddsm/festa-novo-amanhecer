const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('relatorio_vendas_festa_novo_amanhecer_2026.csv', 'utf8'),
  crlfDelay: Infinity
});

let isHeader = true;
let samples = 0;

rl.on('line', (line) => {
  if (isHeader) { isHeader = false; return; }
  const parts = line.split(';').map(p => p.replace(/^"|"$/g, ''));
  if (parts.length < 11) return;

  const pdv = parts[3];
  const itensStr = parts[10];

  if ((pdv.includes('Hambúrguer') || itensStr.includes('Smash') || itensStr.includes('Hamburguer') || itensStr.includes('Hambúrguer')) && samples < 10) {
    console.log('---');
    console.log('Data:', parts[1]);
    console.log('PDV:', pdv);
    console.log('Valor:', parts[4]);
    console.log('Itens RAW:', itensStr);
    samples++;
  }
});
