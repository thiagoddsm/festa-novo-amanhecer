'use client';
import { Pdv } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { Store } from 'lucide-react';

interface PdvSelectorProps {
  pdvs: Pdv[] | null;
  onPdvSelect: (pdv: Pdv) => void;
}

export default function PdvSelector({ pdvs, onPdvSelect }: PdvSelectorProps) {
  const filteredPdvs = pdvs?.filter(p => p.id !== 'caixa_central');

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store />
            Selecionar Ponto de Venda
          </CardTitle>
          <CardDescription>Escolha o PDV que você está operando para iniciar as vendas.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {pdvs === null && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}
          {filteredPdvs && filteredPdvs.length === 0 && (
              <p className='col-span-full text-center text-muted-foreground p-4'>Nenhum PDV encontrado. Vá ao Dashboard, clique em "Configurações" e depois em "Popular Dados Iniciais" para cadastrar as barracas e cardápios.</p>
          )}
          {filteredPdvs &&
            filteredPdvs.map(pdv => (
              <Button
                key={pdv.id}
                variant="outline"
                className="h-24 text-lg"
                onClick={() => onPdvSelect(pdv)}
              >
                {pdv.nome}
              </Button>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
