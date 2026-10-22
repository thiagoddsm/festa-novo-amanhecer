'use client';
import { Pdv } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { Store, Plus, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-context';
import { useTenant } from '@/hooks/use-tenant-context';
import Link from 'next/link';

interface PdvSelectorProps {
  pdvs: Pdv[] | null;
  onPdvSelect: (pdv: Pdv) => void;
}

export default function PdvSelector({ pdvs, onPdvSelect }: PdvSelectorProps) {
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const isAdmin = ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '');

  return (
    <div className="mx-auto max-w-2xl w-full min-w-0">
      <Card className="w-full min-w-0">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <Store className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Selecionar Ponto de Venda</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {currentEvent ? `PDVs disponíveis em ${currentEvent.name}` : 'Escolha o PDV que você está operando para iniciar as vendas.'}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" asChild className="shrink-0 w-full sm:w-auto h-8 text-xs">
              <Link href="/admin/pdvs">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Gerenciar PDVs
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-6 pt-0">
          {pdvs === null && (
            <>
              <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
              <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
              <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
              <Skeleton className="h-20 sm:h-24 w-full rounded-xl" />
            </>
          )}
          {pdvs && pdvs.length === 0 && (
            <div className="col-span-full text-center py-8 space-y-3">
              <Store className="h-10 w-10 mx-auto opacity-30 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum PDV cadastrado para este evento.
              </p>
              {isAdmin && (
                <Button asChild size="sm">
                  <Link href="/admin/pdvs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Cadastrar PDVs do Evento
                  </Link>
                </Button>
              )}
            </div>
          )}
          {pdvs &&
            pdvs.map((pdv) => (
              <Button
                key={pdv.id}
                variant="outline"
                className="h-20 sm:h-24 text-sm sm:text-base font-semibold shadow-xs hover:border-primary hover:bg-primary/5 transition-all flex flex-col justify-center items-center gap-1.5 p-2 text-center whitespace-normal break-words rounded-xl"
                onClick={() => onPdvSelect(pdv)}
              >
                <Store className="h-5 w-5 text-primary opacity-80 shrink-0" />
                <span className="line-clamp-2 leading-tight text-xs sm:text-sm">{pdv.nome}</span>
              </Button>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}