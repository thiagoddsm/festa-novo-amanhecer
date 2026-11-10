// Calculation of burger ingredients for Sexta and Sábado

// Demand:
// Sexta:
//   Hambúrguer Tradicional: 78
//   Smash Simples: 64
//   Smash Duplo: 67
// Sábado:
//   Hambúrguer Tradicional: 55
//   Smash Simples: 101
//   Smash Duplo: 57

const recipes = {
  tradicional: {
    pao: 1, // un
    carneProcessada: 1, // un
    blendBovino90g: 0,
    queijoFatias: 2,
    presuntoFatias: 1,
    baconG: 40,
    ovo: 1,
    batataPalhaG: 20,
    alfacePorcao: 1,
    tomateFatias: 1,
    chutneyG: 0,
    maioneseG: 10
  },
  smashSimples: {
    pao: 1,
    carneProcessada: 0,
    blendBovino90g: 1,
    queijoFatias: 2,
    presuntoFatias: 0,
    baconG: 40,
    ovo: 0,
    batataPalhaG: 0,
    alfacePorcao: 0,
    tomateFatias: 0,
    chutneyG: 15,
    maioneseG: 10
  },
  smashDuplo: {
    pao: 1,
    carneProcessada: 0,
    blendBovino90g: 2,
    queijoFatias: 4,
    presuntoFatias: 0,
    baconG: 40,
    ovo: 0,
    batataPalhaG: 0,
    alfacePorcao: 0,
    tomateFatias: 0,
    chutneyG: 15,
    maioneseG: 10
  }
};

function calculate(demands) {
  const totals = {
    pao: 0,
    carneProcessada: 0,
    blendBovino90g: 0,
    queijoFatias: 0,
    presuntoFatias: 0,
    baconG: 0,
    ovo: 0,
    batataPalhaG: 0,
    alfacePorcao: 0,
    tomateFatias: 0,
    chutneyG: 0,
    maioneseG: 0
  };

  for (const [type, qty] of Object.entries(demands)) {
    const rec = recipes[type];
    for (const [ing, amount] of Object.entries(rec)) {
      totals[ing] += amount * qty;
    }
  }
  return totals;
}

const sexta = { tradicional: 78, smashSimples: 64, smashDuplo: 67 };
const sabado = { tradicional: 55, smashSimples: 101, smashDuplo: 57 };
const totalSextaSabado = {
  tradicional: sexta.tradicional + sabado.tradicional,
  smashSimples: sexta.smashSimples + sabado.smashSimples,
  smashDuplo: sexta.smashDuplo + sabado.smashDuplo
};

console.log('--- SEXTA ---');
console.log(calculate(sexta));

console.log('\n--- SÁBADO ---');
console.log(calculate(sabado));

console.log('\n--- TOTAL SEXTA + SÁBADO ---');
const total = calculate(totalSextaSabado);
console.log(total);

console.log('\n--- CONVERSÕES EM KG E PACOTES ---');
console.log('Pão de Hambúrguer:', total.pao, 'un');
console.log('Carne Processada (Hambúrguer Tradicional):', total.carneProcessada, 'un');
console.log('Blend Bovino 90g (Smash):', total.blendBovino90g, 'un (total de carne in natura:', (total.blendBovino90g * 0.09).toFixed(2), 'kg)');
console.log('Fatias de Queijo:', total.queijoFatias, 'fatias (~', (total.queijoFatias * 0.02).toFixed(2), 'kg considerando 20g/fatia, ou ~', (total.queijoFatias * 0.025).toFixed(2), 'kg a 25g/fatia)');
console.log('Fatias de Presunto:', total.presuntoFatias, 'fatias (~', (total.presuntoFatias * 0.02).toFixed(2), 'kg a 20g/fatia)');
console.log('Bacon:', total.baconG, 'g (', (total.baconG / 1000).toFixed(2), 'kg )');
console.log('Ovos:', total.ovo, 'un (', (total.ovo / 12).toFixed(1), 'dúzias ou', (total.ovo / 30).toFixed(1), 'cartelas de 30)');
console.log('Batata Palha:', total.batataPalhaG, 'g (', (total.batataPalhaG / 1000).toFixed(2), 'kg )');
console.log('Alface Americana:', total.alfacePorcao, 'porções (~', Math.ceil(total.alfacePorcao / 15), 'a', Math.ceil(total.alfacePorcao / 12), 'pés de alface)');
console.log('Tomate:', total.tomateFatias, 'fatias (~', Math.ceil(total.tomateFatias / 6), 'a', Math.ceil(total.tomateFatias / 5), 'tomates médios, aprox.', (Math.ceil(total.tomateFatias / 5) * 0.12).toFixed(1), 'kg)');
console.log('Chutney de Manga:', total.chutneyG, 'g (', (total.chutneyG / 1000).toFixed(2), 'kg )');
console.log('Maionese Temperada:', total.maioneseG, 'g (', (total.maioneseG / 1000).toFixed(2), 'kg )');
