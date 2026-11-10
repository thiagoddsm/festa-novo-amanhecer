// Calculation for Friday + 70%
const sextaBase = {
  tradicional: 78,
  smashSimples: 64,
  smashDuplo: 67
};

const factor = 1.70;

const sextaMais70 = {
  tradicional: Math.round(sextaBase.tradicional * factor), // 133
  smashSimples: Math.round(sextaBase.smashSimples * factor), // 109
  smashDuplo: Math.round(sextaBase.smashDuplo * factor) // 114
};

console.log('Demanda Projetada Sexta (+70%):', sextaMais70);
console.log('Total lanches:', sextaMais70.tradicional + sextaMais70.smashSimples + sextaMais70.smashDuplo);

// Recipes per burger:
// Tradicional:
//   paoGergelim: 1
//   carneProcessada: 1
//   queijoFatias: 2
//   presuntoFatias: 1
//   baconG: 40
//   ovo: 1
//   batataPalhaG: 20
//   alfacePorcao: 1
//   tomateFatias: 1
//   maioneseG: 10
//
// Smash Simples:
//   paoSal: 1
//   blendBovino90g: 1
//   queijoFatias: 2
//   baconG: 40
//   chutneyG: 15
//   maioneseG: 10
//
// Smash Duplo:
//   paoSal: 1
//   blendBovino90g: 2
//   queijoFatias: 4
//   baconG: 40
//   chutneyG: 15
//   maioneseG: 10

const paoGergelim = sextaMais70.tradicional; // 133
const paoSal = sextaMais70.smashSimples + sextaMais70.smashDuplo; // 109 + 114 = 223
const totalPao = paoGergelim + paoSal; // 356

const carneProcessada = sextaMais70.tradicional; // 133
const blendBovino90g = (sextaMais70.smashSimples * 1) + (sextaMais70.smashDuplo * 2); // 109 + 228 = 337
const carneBovinaKg = blendBovino90g * 0.09; // 337 * 0.09 = 30.33 kg

const queijoFatias = (sextaMais70.tradicional * 2) + (sextaMais70.smashSimples * 2) + (sextaMais70.smashDuplo * 4); // 266 + 218 + 456 = 940 fatias
const queijoKg20g = queijoFatias * 0.02; // 18.8 kg
const queijoKg25g = queijoFatias * 0.025; // 23.5 kg

const presuntoFatias = sextaMais70.tradicional * 1; // 133 fatias (~2.66 kg)

const baconG = (sextaMais70.tradicional + sextaMais70.smashSimples + sextaMais70.smashDuplo) * 40; // 356 * 40 = 14240 g = 14.24 kg

const ovos = sextaMais70.tradicional * 1; // 133 un

const batataPalhaG = sextaMais70.tradicional * 20; // 133 * 20 = 2660 g = 2.66 kg

const alfacePorcao = sextaMais70.tradicional * 1; // 133 porções (~10-12 pés)

const tomateFatias = sextaMais70.tradicional * 1; // 133 fatias (~23-27 tomates, ~3.5 kg)

const chutneyG = (sextaMais70.smashSimples + sextaMais70.smashDuplo) * 15; // 223 * 15 = 3345 g = 3.35 kg

const maioneseG = (sextaMais70.tradicional + sextaMais70.smashSimples + sextaMais70.smashDuplo) * 10; // 356 * 10 = 3560 g = 3.56 kg

console.log({
  paoGergelim,
  paoSal,
  totalPao,
  carneProcessada,
  blendBovino90g,
  carneBovinaKg: carneBovinaKg.toFixed(2),
  queijoFatias,
  queijoKg20g: queijoKg20g.toFixed(2),
  queijoKg25g: queijoKg25g.toFixed(2),
  presuntoFatias,
  baconKg: (baconG / 1000).toFixed(2),
  ovos,
  batataPalhaKg: (batataPalhaG / 1000).toFixed(2),
  alfacePorcao,
  tomateFatias,
  chutneyKg: (chutneyG / 1000).toFixed(2),
  maioneseKg: (maioneseG / 1000).toFixed(2)
});
