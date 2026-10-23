'use client';

import { Pdv } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { 
  Store, 
  Plus, 
  Settings, 
  ChevronRight, 
  CupSoda, 
  Cake, 
  Flame, 
  UtensilsCrossed 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-context';
import { useTenant } from '@/hooks/use-tenant-context';
import Link from 'next/link';

interface PdvSelectorProps {
  pdvs: Pdv[] | null;
  operatorCounts?: Record<string, number>;
  onPdvSelect: (pdv: Pdv) => void;
}

interface CategoryConfig {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

function getPdvCategoryConfig(nome: string): CategoryConfig {
  const n = (nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (
    n.includes('bebida') ||
    n.includes('bar') ||
    n.includes('chopp') ||
    n.includes('cerveja') ||
    n.includes('refrigerante') ||
    n.includes('suco') ||
    n.includes('drink')
  ) {
    return {
      icon: CupSoda,
      iconBg: 'bg-purple-100/90',
      iconColor: 'text-purple-600',
    };
  }

  if (
    n.includes('doce') ||
    n.includes('sobremesa') ||
    n.includes('bolo') ||
    n.includes('churros') ||
    n.includes('pipoca') ||
    n.includes('sorvete') ||
    n.includes('algodao')
  ) {
    return {
      icon: Cake,
      iconBg: 'bg-pink-100/90',
      iconColor: 'text-pink-600',
    };
  }

  if (
    n.includes('churrasco') ||
    n.includes('carne') ||
    n.includes('espeto') ||
    n.includes('espetinho') ||
    n.includes('costela') ||
    n.includes('brasa')
  ) {
    return {
      icon: Flame,
      iconBg: 'bg-amber-100/90',
      iconColor: 'text-amber-700',
    };
  }

  if (
    n.includes('pastel') ||
    n.includes('salgado') ||
    n.includes('lanche') ||
    n.includes('coxinha') ||
    n.includes('hamburguer') ||
    n.includes('pizza') ||
    n.includes('torta') ||
    n.includes('milho') ||
    n.includes('caldo')
  ) {
    return {
      icon: UtensilsCrossed,
      iconBg: 'bg-orange-100/90',
      iconColor: 'text-orange-600',
    };
  }

  return {
    icon: Store,
    iconBg: 'bg-indigo-100/90',
    iconColor: 'text-indigo-600',
  };
}

export default function PdvSelector({ pdvs, operatorCounts = {}, onPdvSelect }: PdvSelectorProps) {
  const { user } = useAuth();
  const { currentEvent } = useTenant();
  const isAdmin = ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '');

  return (
    <div className="mx-auto max-w-xl w-full min-w-0 space-y-3.5 sm:space-y-4">
      {/* Hero Card */}
      <div className="rounded-3xl border border-purple-100/80 bg-gradient-to-b from-white via-white to-purple-50/30 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-purple-100/80 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              Selecionar Ponto de Venda
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="truncate">
                {currentEvent ? `PDVs ativos em ${currentEvent.name}` : 'PDVs ativos no evento'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado
              </span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <Button
            variant="outline"
            asChild
            className="w-full mt-4 h-10 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Link href="/admin/pdvs">
              <Settings className="h-4 w-4 text-slate-500" />
              Gerenciar PDVs & Caixas
            </Link>
          </Button>
        )}
      </div>

      {/* Grid of PDVs */}
      {pdvs === null && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-36 sm:h-40 w-full rounded-2xl" />
          <Skeleton className="h-36 sm:h-40 w-full rounded-2xl" />
          <Skeleton className="h-36 sm:h-40 w-full rounded-2xl" />
          <Skeleton className="h-36 sm:h-40 w-full rounded-2xl" />
        </div>
      )}

      {pdvs && pdvs.length === 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center space-y-3 shadow-xs">
          <Store className="h-10 w-10 mx-auto text-slate-300" />
          <p className="text-sm text-slate-500 font-medium">
            Nenhum PDV cadastrado para este evento.
          </p>
          {isAdmin && (
            <Button asChild size="sm" className="rounded-xl">
              <Link href="/admin/pdvs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Cadastrar PDVs do Evento
              </Link>
            </Button>
          )}
        </div>
      )}

      {pdvs && pdvs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {pdvs.map((pdv) => {
            const config = getPdvCategoryConfig(pdv.nome);
            const Icon = config.icon;
            const opCount = operatorCounts[pdv.id] || 0;

            return (
              <button
                key={pdv.id}
                type="button"
                onClick={() => onPdvSelect(pdv)}
                className="group relative flex flex-col justify-between bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 text-left shadow-xs hover:shadow-md hover:border-purple-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all min-h-[142px] sm:min-h-[155px]"
              >
                {/* Top Row: Category Icon + Online Badge */}
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`h-11 w-11 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold border border-emerald-100/60 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                </div>

                {/* Center: PDV Title */}
                <div className="my-2.5">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                    {pdv.nome}
                  </h3>
                </div>

                {/* Footer: Operator Count + Arrow */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between w-full text-xs text-slate-500">
                  <span className="font-medium text-[11px] sm:text-xs text-slate-500 truncate mr-1">
                    {opCount === 0
                      ? 'Livre para operar'
                      : `${opCount} operador${opCount > 1 ? 'es' : ''}`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Security & Version Footer Pill */}
      <div className="rounded-2xl bg-white border border-slate-100/80 p-3 px-4 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 min-w-0">
          <span className="h-2 w-2 rounded-full bg-purple-600 shrink-0" />
          <span className="truncate">Transações locais seguras via RFID/QR Code</span>
        </div>
        <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ml-2">
          v4.2.0
        </span>
      </div>
    </div>
  );
}