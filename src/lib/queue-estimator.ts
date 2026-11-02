/**
 * Queue Estimator & Production Capacity Engine for FestaPay
 * Calibrated specifically for community and church festivals.
 */

export type BoothCategory =
  | 'HAMBURGUER'
  | 'PASTEL'
  | 'BATATA_FRITA'
  | 'PIZZA'
  | 'CHURRASCO'
  | 'MASSA'
  | 'CACHORRO_QUENTE'
  | 'CALDO'
  | 'BEBIDA'
  | 'DOCE'
  | 'KIDS'
  | 'GERAL';

export interface ItemSlotCount {
  units: number; // Quantidade de itens/lanches
  slots: number; // Espaços de produção (ex: carnes na chapa para burger)
}

export interface QueueEstimateResult {
  title: string;
  timeText: string;
  detailInfo: string;
  chapaInfo: string;
  unitLabel: string;
  totalUnits: number;
  totalSlots: number;
  ordersCount: number;
  colorScheme: 'emerald' | 'amber' | 'orange' | 'rose';
  containerClass: string;
  iconClass: string;
  badgeClass: string;
  headerClass: string;
  mobileChipClass: string;
}

/**
 * Detecta a categoria operacional da barraca com base no nome e no ícone.
 */
export function detectBoothCategory(pdvName: string = '', pdvIcon: string = ''): BoothCategory {
  const norm = (pdvName + ' ' + pdvIcon).toLowerCase();

  if (norm.includes('hamburg') || norm.includes('burger') || norm.includes('smash') || norm.includes('chapa')) {
    return 'HAMBURGUER';
  }
  if (norm.includes('pastel') || norm.includes('pasteis') || norm.includes('fritura')) {
    return 'PASTEL';
  }
  if (norm.includes('batata') || norm.includes('frita')) {
    return 'BATATA_FRITA';
  }
  if (norm.includes('pizza') || norm.includes('forno') || norm.includes('calzone')) {
    return 'PIZZA';
  }
  if (norm.includes('churras') || norm.includes('espet') || norm.includes('carne')) {
    return 'CHURRASCO';
  }
  if (norm.includes('massa') || norm.includes('macarr') || norm.includes('penne') || norm.includes('espaguete') || norm.includes('nhoque')) {
    return 'MASSA';
  }
  if (norm.includes('cachorro') || norm.includes('hot dog') || norm.includes('dog') || norm.includes('prensa')) {
    return 'CACHORRO_QUENTE';
  }
  if (norm.includes('caldo') || norm.includes('sopa') || norm.includes('canja')) {
    return 'CALDO';
  }
  if (norm.includes('bebida') || norm.includes('refrigerante') || norm.includes('cerveja') || norm.includes('suco') || norm.includes('agua') || norm.includes('bar')) {
    return 'BEBIDA';
  }
  if (norm.includes('doce') || norm.includes('sobremesa') || norm.includes('bolo') || norm.includes('torta') || norm.includes('churros')) {
    return 'DOCE';
  }
  if (norm.includes('kid') || norm.includes('infantil') || norm.includes('pipoca') || norm.includes('algodao')) {
    return 'KIDS';
  }
  return 'GERAL';
}

/**
 * Calcula quantas unidades e quantos slots de produção um item consome.
 * Ex: Hambúrguer Duplo conta como 1 lanche, mas consome 2 carnes (2 slots da chapa).
 */
export function getItemSlots(
  item: { name?: string; nome?: string; ingredientes?: string[]; quantity?: number },
  category: BoothCategory = 'HAMBURGUER'
): ItemSlotCount {
  const quantity = Math.max(1, item.quantity || 1);
  const name = (item.name || item.nome || '').toLowerCase();

  if (category === 'HAMBURGUER') {
    const isDouble =
      name.includes('duplo') ||
      name.includes('dupla') ||
      name.includes('2x') ||
      name.includes('2 x') ||
      name.includes('2 carnes') ||
      name.includes('2 blend') ||
      (Array.isArray(item.ingredientes) &&
        item.ingredientes.some((ing) => {
          const lower = ing.toLowerCase();
          return (
            lower.includes('2 x blend') ||
            lower.includes('2 x carne') ||
            lower.includes('2x blend') ||
            lower.includes('duas carnes')
          );
        }));

    const slotsPerUnit = isDouble ? 2 : 1;
    return {
      units: quantity,
      slots: quantity * slotsPerUnit,
    };
  }

  // Para as outras barracas, cada porção/item é uma unidade de cocção/entrega
  return {
    units: quantity,
    slots: quantity,
  };
}

/**
 * Calcula os totais de itens e de slots de produção a partir de uma lista de pedidos.
 */
export function calculateQueueTotals(
  orders: Array<{ items?: Array<{ name?: string; nome?: string; ingredientes?: string[]; quantity?: number }> }>,
  category: BoothCategory
): { totalUnits: number; totalSlots: number } {
  let units = 0;
  let slots = 0;

  orders.forEach((order) => {
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const res = getItemSlots(item, category);
        units += res.units;
        slots += res.slots;
      });
    }
  });

  return { totalUnits: units, totalSlots: slots };
}

/**
 * Estimativa global da fila para o PDV (Caixa) e Tela de Cozinha (KDS).
 */
export function getQueueEstimate(
  category: BoothCategory,
  ordersCount: number,
  totalUnits: number = 0,
  totalSlots: number = 0
): QueueEstimateResult {
  const units = totalUnits > 0 ? totalUnits : ordersCount;
  const slots = totalSlots > 0 ? totalSlots : units;

  // Sem pedidos na fila
  if (ordersCount === 0 && slots === 0) {
    const idleMsg = getIdleMessage(category);
    return {
      title: 'Sem fila de espera',
      timeText: '~2 a 4 min (Imediato)',
      detailInfo: idleMsg,
      chapaInfo: idleMsg,
      unitLabel: getUnitLabel(category, 0),
      totalUnits: 0,
      totalSlots: 0,
      ordersCount: 0,
      colorScheme: 'emerald',
      containerClass:
        'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
      iconClass: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
      badgeClass:
        'bg-emerald-100/90 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      headerClass:
        'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
      mobileChipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }

  // Hamburguer: 2 chapas x 12 carnes = 24 carnes por rodada
  if (category === 'HAMBURGUER') {
    if (slots <= 12) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'lanche' : 'lanches'} (${slots} ${slots === 1 ? 'carne' : 'carnes'})`,
        timeText: '~5 a 8 min',
        detailInfo: '1ª rodada (cabe na chapa atual)',
        colorScheme: 'emerald',
      });
    }
    if (slots <= 24) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} lanches (${slots} carnes)`,
        timeText: '~8 a 13 min',
        detailInfo: '1ª rodada (distribuído nas 2 chapas)',
        colorScheme: 'emerald',
      });
    }
    if (slots <= 48) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} lanches (${slots} carnes)`,
        timeText: '~13 a 20 min',
        detailInfo: '2ª rodada nas 2 chapas',
        colorScheme: 'amber',
      });
    }
    if (slots <= 72) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} lanches (${slots} carnes)`,
        timeText: '~20 a 28 min',
        detailInfo: '~3ª rodada nas chapas',
        colorScheme: 'orange',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} lanches (${slots} carnes)`,
      timeText: '+30 min de espera',
      detailInfo: 'Fila intensa nas chapas (+3 rodadas)',
      colorScheme: 'rose',
    });
  }

  // Pastel: Tacho comporta 6 a 8 pastéis por fritada (~3 a 4 min)
  if (category === 'PASTEL') {
    if (units <= 8) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'pastel' : 'pastéis'}`,
        timeText: '~4 a 7 min',
        detailInfo: '1ª rodada na fritadeira / tacho',
        colorScheme: 'emerald',
      });
    }
    if (units <= 16) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} pastéis`,
        timeText: '~8 a 12 min',
        detailInfo: '2ª rodada nas fritadeiras',
        colorScheme: 'amber',
      });
    }
    if (units <= 24) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} pastéis`,
        timeText: '~13 a 18 min',
        detailInfo: '3ª rodada nas fritadeiras',
        colorScheme: 'orange',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} pastéis`,
      timeText: '+20 min de espera',
      detailInfo: 'Fritadeiras em capacidade máxima',
      colorScheme: 'rose',
    });
  }

  // Batata Frita: Cestos de fritadeira (~3 a 4 porções por cesto, ~4 min)
  if (category === 'BATATA_FRITA') {
    if (units <= 4) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'porção' : 'porções'}`,
        timeText: '~5 a 8 min',
        detailInfo: '1ª fritada nos cestos',
        colorScheme: 'emerald',
      });
    }
    if (units <= 10) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} porções`,
        timeText: '~8 a 13 min',
        detailInfo: '2ª fritada nos cestos',
        colorScheme: 'amber',
      });
    }
    if (units <= 18) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} porções`,
        timeText: '~14 a 20 min',
        detailInfo: '3ª remessa de batatas',
        colorScheme: 'orange',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} porções`,
      timeText: '+20 min de espera',
      detailInfo: 'Fritadeiras em alta demanda',
      colorScheme: 'rose',
    });
  }

  // Pizza: Forno comporta ~4 a 6 brotinhos/pizzas (~5 min)
  if (category === 'PIZZA') {
    if (units <= 4) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'pizza' : 'pizzas'}`,
        timeText: '~6 a 10 min',
        detailInfo: '1ª fornada de pizzas',
        colorScheme: 'emerald',
      });
    }
    if (units <= 10) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} pizzas`,
        timeText: '~10 a 16 min',
        detailInfo: '2ª fornada de pizzas',
        colorScheme: 'amber',
      });
    }
    if (units <= 18) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} pizzas`,
        timeText: '~16 a 24 min',
        detailInfo: '3ª fornada de pizzas',
        colorScheme: 'orange',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} pizzas`,
      timeText: '+25 min de espera',
      detailInfo: 'Forno de pizza com fila intensa',
      colorScheme: 'rose',
    });
  }

  // Churrasco: Grelha comporta 25 a 30 espetos simultâneos
  if (category === 'CHURRASCO') {
    if (units <= 8) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'espeto' : 'espetos'}`,
        timeText: '~5 a 8 min',
        detailInfo: 'Na brasa agora • Ponto rápido',
        colorScheme: 'emerald',
      });
    }
    if (units <= 20) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} espetos`,
        timeText: '~8 a 14 min',
        detailInfo: 'Rodada atual na grelha',
        colorScheme: 'amber',
      });
    }
    if (units <= 35) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} espetos`,
        timeText: '~15 a 22 min',
        detailInfo: 'Próxima remessa na brasa',
        colorScheme: 'orange',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} espetos`,
      timeText: '+25 min de espera',
      detailInfo: 'Churrasqueira em capacidade máxima',
      colorScheme: 'rose',
    });
  }

  // Massa: Empratamento rápido (~2 min por prato)
  if (category === 'MASSA') {
    if (units <= 4) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'prato' : 'pratos'}`,
        timeText: '~4 a 7 min',
        detailInfo: 'Montagem dos pratos agora',
        colorScheme: 'emerald',
      });
    }
    if (units <= 10) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} pratos`,
        timeText: '~7 a 13 min',
        detailInfo: 'Fila de montagem nos rechauds',
        colorScheme: 'amber',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} pratos`,
      timeText: '~14 a 20 min',
      detailInfo: 'Fila moderada de massas',
      colorScheme: 'orange',
    });
  }

  // Cachorro Quente: Montagem + prensa rápida (4 a 6 pães por prensa)
  if (category === 'CACHORRO_QUENTE') {
    if (units <= 6) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'hot dog' : 'hot dogs'}`,
        timeText: '~4 a 7 min',
        detailInfo: '1ª rodada na prensa',
        colorScheme: 'emerald',
      });
    }
    if (units <= 14) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} hot dogs`,
        timeText: '~7 a 12 min',
        detailInfo: '2ª rodada nas prensas',
        colorScheme: 'amber',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} hot dogs`,
      timeText: '~13 a 18 min',
      detailInfo: 'Prensas em alta demanda',
      colorScheme: 'orange',
    });
  }

  // Caldo: Caldeirão contínuo (~1 min por cumbuca)
  if (category === 'CALDO') {
    if (units <= 5) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'caldo' : 'caldos'}`,
        timeText: '~2 a 4 min',
        detailInfo: 'Serviço expresso no caldeirão',
        colorScheme: 'emerald',
      });
    }
    if (units <= 12) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} caldos`,
        timeText: '~4 a 8 min',
        detailInfo: 'Saída contínua de caldos',
        colorScheme: 'amber',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} caldos`,
      timeText: '~8 a 14 min',
      detailInfo: 'Fila na bancada de caldos',
      colorScheme: 'orange',
    });
  }

  // Bebida: Freezer/balcão imediato
  if (category === 'BEBIDA') {
    if (units <= 5) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'bebida' : 'bebidas'}`,
        timeText: '~1 a 3 min',
        detailInfo: 'Retirada imediata no balcão',
        colorScheme: 'emerald',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} bebidas`,
      timeText: '~3 a 6 min',
      detailInfo: 'Fila rápida de entrega',
      colorScheme: 'amber',
    });
  }

  // Doces: Vitrine pronta
  if (category === 'DOCE') {
    if (units <= 4) {
      return makeResult({
        ordersCount,
        totalUnits: units,
        totalSlots: slots,
        unitLabel: `${units} ${units === 1 ? 'doce' : 'doces'}`,
        timeText: '~1 a 3 min',
        detailInfo: 'Retirada rápida na vitrine',
        colorScheme: 'emerald',
      });
    }
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} doces`,
      timeText: '~3 a 7 min',
      detailInfo: 'Separação e embalagem na vitrine',
      colorScheme: 'amber',
    });
  }

  // Padrão Geral / Kids
  if (units <= 5) {
    return makeResult({
      ordersCount,
      totalUnits: units,
      totalSlots: slots,
      unitLabel: `${units} ${units === 1 ? 'item' : 'itens'}`,
      timeText: '~3 a 6 min',
      detailInfo: 'Início imediato do preparo',
      colorScheme: 'emerald',
    });
  }
  return makeResult({
    ordersCount,
    totalUnits: units,
    totalSlots: slots,
    unitLabel: `${units} itens`,
    timeText: '~7 a 14 min',
    detailInfo: 'Fila normal de produção',
    colorScheme: 'amber',
  });
}

/**
 * Estimativa individual para o cliente acompanhando seu pedido no celular.
 */
export function calculateCustomerWaitEstimate(
  category: BoothCategory,
  positionInQueue: number, // 0 = sendo preparado agora, 1 = 1 na frente, etc.
  totalSlotsAhead: number
): { time: string; info: string } {
  if (positionInQueue <= 0) {
    return { time: '~2 a 4 min', info: 'Seu pedido está sendo preparado agora!' };
  }

  if (category === 'HAMBURGUER') {
    if (positionInQueue === 1) return { time: '~5 a 8 min', info: '1ª rodada (na chapa agora)' };
    if (totalSlotsAhead <= 24) return { time: '~8 a 13 min', info: '1ª rodada nas 2 chapas' };
    if (totalSlotsAhead <= 48) return { time: '~13 a 20 min', info: '2ª rodada nas chapas' };
    if (totalSlotsAhead <= 72) return { time: '~20 a 28 min', info: '~3ª rodada nas chapas' };
    return { time: '+30 min', info: 'Fila intensa nas chapas' };
  }

  if (category === 'PASTEL') {
    if (positionInQueue === 1) return { time: '~4 a 7 min', info: 'No tacho agora' };
    if (positionInQueue <= 3) return { time: '~7 a 12 min', info: 'Próxima rodada do tacho' };
    if (positionInQueue <= 6) return { time: '~12 a 18 min', info: '~2ª ou 3ª rodada de fritura' };
    return { time: '+20 min', info: 'Fritadeiras em alta demanda' };
  }

  if (category === 'BATATA_FRITA') {
    if (positionInQueue === 1) return { time: '~4 a 7 min', info: 'Nos cestos da fritadeira agora' };
    if (positionInQueue <= 3) return { time: '~7 a 12 min', info: 'Próxima fritada' };
    return { time: '~13 a 18 min', info: 'Remessa nos cestos' };
  }

  if (category === 'PIZZA') {
    if (positionInQueue === 1) return { time: '~5 a 8 min', info: 'No forno agora' };
    if (positionInQueue <= 3) return { time: '~8 a 14 min', info: 'Próxima fornada' };
    return { time: '~15 a 22 min', info: 'Fornadas em andamento' };
  }

  if (category === 'CHURRASCO') {
    if (positionInQueue === 1) return { time: '~4 a 7 min', info: 'Na brasa agora' };
    if (positionInQueue <= 3) return { time: '~7 a 12 min', info: 'Grelha atual' };
    return { time: '~13 a 20 min', info: 'Próxima remessa na brasa' };
  }

  if (category === 'CALDO' || category === 'BEBIDA') {
    if (positionInQueue <= 2) return { time: '~1 a 3 min', info: 'Saída rápida no balcão' };
    return { time: '~3 a 6 min', info: 'Fila rápida de entrega' };
  }

  // Geral / Outros
  if (positionInQueue <= 2) return { time: '~4 a 7 min', info: 'Preparo em andamento' };
  if (positionInQueue <= 5) return { time: '~7 a 13 min', info: 'Fila de pedidos na frente' };
  return { time: '+15 min', info: 'Fila em produção' };
}

// Helpers
function getIdleMessage(category: BoothCategory): string {
  switch (category) {
    case 'HAMBURGUER':
      return '2 chapas livres • Início imediato';
    case 'PASTEL':
      return 'Fritadeiras livres • Fritura imediata';
    case 'BATATA_FRITA':
      return 'Fritadeira pronta • Saída imediata';
    case 'PIZZA':
      return 'Forno livre • Início imediato';
    case 'CHURRASCO':
      return 'Brasa ativa • Saída imediata';
    case 'MASSA':
      return 'Rechauds aquecidos • Montagem imediata';
    case 'CACHORRO_QUENTE':
      return 'Prensas livres • Montagem imediata';
    case 'CALDO':
      return 'Caldeirão aquecido • Serviço expresso';
    case 'BEBIDA':
      return 'Retirada rápida no freezer/balcão';
    case 'DOCE':
      return 'Retirada rápida na vitrine';
    default:
      return 'Cozinha livre • Início imediato';
  }
}

function getUnitLabel(category: BoothCategory, count: number): string {
  switch (category) {
    case 'HAMBURGUER':
      return count === 1 ? '1 lanche' : `${count} lanches`;
    case 'PASTEL':
      return count === 1 ? '1 pastel' : `${count} pastéis`;
    case 'BATATA_FRITA':
      return count === 1 ? '1 porção' : `${count} porções`;
    case 'PIZZA':
      return count === 1 ? '1 pizza' : `${count} pizzas`;
    case 'CHURRASCO':
      return count === 1 ? '1 espeto' : `${count} espetos`;
    case 'MASSA':
      return count === 1 ? '1 prato' : `${count} pratos`;
    case 'CACHORRO_QUENTE':
      return count === 1 ? '1 hot dog' : `${count} hot dogs`;
    case 'CALDO':
      return count === 1 ? '1 caldo' : `${count} caldos`;
    case 'BEBIDA':
      return count === 1 ? '1 bebida' : `${count} bebidas`;
    case 'DOCE':
      return count === 1 ? '1 doce' : `${count} doces`;
    default:
      return count === 1 ? '1 item' : `${count} itens`;
  }
}

function makeResult(params: {
  ordersCount: number;
  totalUnits: number;
  totalSlots: number;
  unitLabel: string;
  timeText: string;
  detailInfo: string;
  colorScheme: 'emerald' | 'amber' | 'orange' | 'rose';
}): QueueEstimateResult {
  const { ordersCount, totalUnits, totalSlots, unitLabel, timeText, detailInfo, colorScheme } = params;

  const title = `${ordersCount} ${ordersCount === 1 ? 'pedido' : 'pedidos'} • ${unitLabel} na frente`;

  const classes = {
    emerald: {
      container:
        'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200',
      icon: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
      badge:
        'bg-emerald-100/90 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
      header:
        'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
      mobileChip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    amber: {
      container:
        'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200',
      icon: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
      badge:
        'bg-amber-100/90 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      header:
        'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
      mobileChip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    orange: {
      container:
        'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200',
      icon: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300',
      badge:
        'bg-orange-100/90 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700',
      header:
        'bg-orange-50/90 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
      mobileChip: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    },
    rose: {
      container:
        'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200',
      icon: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
      badge:
        'bg-rose-100/90 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
      header:
        'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300',
      mobileChip: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    },
  }[colorScheme];

  return {
    title,
    timeText,
    detailInfo,
    chapaInfo: detailInfo,
    unitLabel,
    totalUnits,
    totalSlots,
    ordersCount,
    colorScheme,
    containerClass: classes.container,
    iconClass: classes.icon,
    badgeClass: classes.badge,
    headerClass: classes.header,
    mobileChipClass: classes.mobileChip,
  };
}
