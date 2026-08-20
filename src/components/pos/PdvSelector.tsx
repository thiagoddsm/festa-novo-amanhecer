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
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Selecionar Ponto de Venda
            </CardTitle>
            <CardDescription>
              {currentEvent ? `PDVs disponíveis em ${currentEvent.name}` : 'Escolha o PDV que você está operando para iniciar as vendas.'}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/pdvs">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Gerenciar PDVs
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pdvs === null && (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
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
                className="h-24 text-lg font-medium shadow-sm hover:border-primary hover:bg-primary/5 transition-all flex flex-col justify-center items-center gap-1"
                onClick={() => onPdvSelect(pdv)}
              >
                <Store className="h-5 w-5 text-primary opacity-80" />
                <span>{pdv.nome}</span>
              </Button>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}