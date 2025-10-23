'use client';
import { useFirestore } from '@/firebase';
import { Pdv } from '@/lib/definitions';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import { Store } from 'lucide-react';

interface PdvSelectorProps {
  onPdvSelect: (pdv: Pdv) => void;
}

export default function PdvSelector({ onPdvSelect }: PdvSelectorProps) {
  const firestore = useFirestore();
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const pdvCollection = collection(firestore, 'pdvs');
    const unsubscribe = onSnapshot(pdvCollection, snapshot => {
      const pdvList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
      setPdvs(pdvList.filter(p => p.id !== 'caixa_central')); // Filter out central cashier
    });
    return () => unsubscribe();
  }, [firestore]);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store />
            Selecionar Ponto de Venda
          </CardTitle>
          <CardDescription>Escolha o PDV que você está operando.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {pdvs === null && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}
          {pdvs && pdvs.length === 0 && <p className='col-span-full text-center text-muted-foreground'>Nenhum PDV encontrado. Popule o banco de dados no Dashboard.</p>}
          {pdvs &&
            pdvs.map(pdv => (
              <Button
                key={pdv.id}
                variant="outline"
                className="h-20 text-lg"
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
