import React from 'react';
import {
  CupSoda,
  Beer,
  Coffee,
  Cake,
  Candy,
  Flame,
  Beef,
  UtensilsCrossed,
  Sandwich,
  Pizza,
  Popcorn,
  IceCream2,
  Store,
  Tag,
  Gamepad2,
  Fish,
  Soup,
} from 'lucide-react';

export interface PdvIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  borderHover: string;
}

export const PDV_ICON_OPTIONS: PdvIconOption[] = [
  {
    id: 'bebidas',
    label: 'Bebidas / Bar',
    icon: CupSoda,
    iconBg: 'bg-purple-100/90',
    iconColor: 'text-purple-600',
    borderHover: 'hover:border-purple-300',
  },
  {
    id: 'chopp',
    label: 'Chopp / Cerveja',
    icon: Beer,
    iconBg: 'bg-amber-100/90',
    iconColor: 'text-amber-600',
    borderHover: 'hover:border-amber-300',
  },
  {
    id: 'doces',
    label: 'Doces / Sobremesas',
    icon: Candy,
    iconBg: 'bg-pink-100/90',
    iconColor: 'text-pink-600',
    borderHover: 'hover:border-pink-300',
  },
  {
    id: 'bolo',
    label: 'Bolos / Confeitaria',
    icon: Cake,
    iconBg: 'bg-rose-100/90',
    iconColor: 'text-rose-600',
    borderHover: 'hover:border-rose-300',
  },
  {
    id: 'churrasco',
    label: 'Churrasco / Espetinho',
    icon: Flame,
    iconBg: 'bg-amber-100/90',
    iconColor: 'text-amber-700',
    borderHover: 'hover:border-amber-400',
  },
  {
    id: 'carnes',
    label: 'Carnes / Pratos',
    icon: Beef,
    iconBg: 'bg-red-100/90',
    iconColor: 'text-red-700',
    borderHover: 'hover:border-red-300',
  },
  {
    id: 'pastel',
    label: 'Pastel / Salgados',
    icon: UtensilsCrossed,
    iconBg: 'bg-orange-100/90',
    iconColor: 'text-orange-600',
    borderHover: 'hover:border-orange-300',
  },
  {
    id: 'lanches',
    label: 'Lanches / Hot-dog',
    icon: Sandwich,
    iconBg: 'bg-yellow-100/90',
    iconColor: 'text-yellow-700',
    borderHover: 'hover:border-yellow-300',
  },
  {
    id: 'pizza',
    label: 'Pizza / Massas',
    icon: Pizza,
    iconBg: 'bg-red-100/90',
    iconColor: 'text-red-600',
    borderHover: 'hover:border-red-300',
  },
  {
    id: 'pipoca',
    label: 'Pipoca / Milho',
    icon: Popcorn,
    iconBg: 'bg-amber-100/90',
    iconColor: 'text-amber-600',
    borderHover: 'hover:border-amber-300',
  },
  {
    id: 'sorvete',
    label: 'Sorvetes / Açaí',
    icon: IceCream2,
    iconBg: 'bg-cyan-100/90',
    iconColor: 'text-cyan-600',
    borderHover: 'hover:border-cyan-300',
  },
  {
    id: 'cafe',
    label: 'Café / Matinal',
    icon: Coffee,
    iconBg: 'bg-stone-200/90',
    iconColor: 'text-stone-700',
    borderHover: 'hover:border-stone-400',
  },
  {
    id: 'caldos',
    label: 'Caldos / Sopas',
    icon: Soup,
    iconBg: 'bg-emerald-100/90',
    iconColor: 'text-emerald-700',
    borderHover: 'hover:border-emerald-300',
  },
  {
    id: 'peixe',
    label: 'Peixe / Frutos do Mar',
    icon: Fish,
    iconBg: 'bg-sky-100/90',
    iconColor: 'text-sky-600',
    borderHover: 'hover:border-sky-300',
  },
  {
    id: 'brincadeiras',
    label: 'Brincadeiras / Jogos',
    icon: Gamepad2,
    iconBg: 'bg-emerald-100/90',
    iconColor: 'text-emerald-600',
    borderHover: 'hover:border-emerald-300',
  },
  {
    id: 'bazar',
    label: 'Bazar / Lembranças',
    icon: Tag,
    iconBg: 'bg-blue-100/90',
    iconColor: 'text-blue-600',
    borderHover: 'hover:border-blue-300',
  },
  {
    id: 'geral',
    label: 'Barraca Geral / Outros',
    icon: Store,
    iconBg: 'bg-indigo-100/90',
    iconColor: 'text-indigo-600',
    borderHover: 'hover:border-indigo-300',
  },
];

export function detectPdvIconId(nome: string): string {
  const n = (nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    n.includes('pastel') ||
    n.includes('coxinha') ||
    n.includes('salgado') ||
    n.includes('esfirra') ||
    n.includes('empada')
  ) {
    return 'pastel';
  }
  if (
    n.includes('churrasco') ||
    n.includes('espeto') ||
    n.includes('espetinho') ||
    n.includes('brasa') ||
    n.includes('costela')
  ) {
    return 'churrasco';
  }
  if (
    n.includes('doce') ||
    n.includes('sobremesa') ||
    n.includes('churros') ||
    n.includes('brigadeiro') ||
    n.includes('pudim')
  ) {
    return 'doces';
  }
  if (n.includes('bolo') || n.includes('torta') || n.includes('confeitaria')) {
    return 'bolo';
  }
  if (n.includes('chopp') || n.includes('cerveja') || n.includes('chope')) {
    return 'chopp';
  }
  if (
    n.includes('bebida') ||
    n.includes('refrigerante') ||
    n.includes('suco') ||
    n.includes('drink') ||
    /\bbar\b/.test(n) ||
    /\bbars\b/.test(n)
  ) {
    return 'bebidas';
  }
  if (n.includes('pizza') || n.includes('massa') || n.includes('macarrao')) {
    return 'pizza';
  }
  if (
    n.includes('lanche') ||
    n.includes('hamburguer') ||
    n.includes('hot dog') ||
    n.includes('hotdog') ||
    n.includes('sanduiche')
  ) {
    return 'lanches';
  }
  if (n.includes('pipoca') || n.includes('milho') || n.includes('algodao')) {
    return 'pipoca';
  }
  if (
    n.includes('sorvete') ||
    n.includes('acai') ||
    n.includes('picole') ||
    n.includes('gelato')
  ) {
    return 'sorvete';
  }
  if (n.includes('cafe') || n.includes('cappuccino')) {
    return 'cafe';
  }
  if (n.includes('caldo') || n.includes('sopa') || n.includes('quentao')) {
    return 'caldos';
  }
  if (n.includes('peixe') || n.includes('pescado')) {
    return 'peixe';
  }
  if (
    n.includes('pescaria') ||
    n.includes('jogo') ||
    n.includes('brincadeira') ||
    n.includes('bingo') ||
    n.includes('roleta')
  ) {
    return 'brincadeiras';
  }
  if (n.includes('bazar') || n.includes('lembranca') || n.includes('artesanato')) {
    return 'bazar';
  }
  if (n.includes('carne')) {
    return 'carnes';
  }

  return 'geral';
}

export function getPdvIconConfig(iconId?: string, nome: string = ''): PdvIconOption {
  if (iconId) {
    const found = PDV_ICON_OPTIONS.find((opt) => opt.id === iconId);
    if (found) return found;
  }

  const detectedId = detectPdvIconId(nome);
  const detected = PDV_ICON_OPTIONS.find((opt) => opt.id === detectedId);
  return detected || PDV_ICON_OPTIONS[PDV_ICON_OPTIONS.length - 1];
}
