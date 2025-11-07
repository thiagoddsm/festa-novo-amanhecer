'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Card as CardType } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef } from '@tanstack/react-table';
import RechargeDialog from '@/components/cards/RechargeDialog';
import ReprintQrButton from '@/components/cards/ReprintQrButton';
import { deleteCards } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth-context';

function useCollection<T>(path: string) {
  const [data, setData] = useState<T[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const collRef = collection(firestore, path);
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const allDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
      setData(allDocs);
    });

    return () => unsubscribe();
  }, [firestore, path]);

  return data;
}

const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'secondary';
      case 'INATIVO': return 'outline';
      case 'BLOQUEADO': return 'destructive';
      default: return 'default';
    }
};

const columns: ColumnDef<CardType>[] = [
    {
        accessorKey: 'nome_cliente',
        header: 'Nome',
        cell: ({ row }) => row.getValue('nome_cliente') || 'N/A'
    },
    {
        accessorKey: 'telefone_cliente',
        header: 'Telefone',
        cell: ({ row }) => row.getValue('telefone_cliente') || 'N/A'
    },
    {
        accessorKey: 'qr_code_id',
        header: 'QR Code ID'
    },
    {
        accessorKey: 'saldo_centavos',
        header: 'Saldo',
        cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('saldo_centavos'))}</div>
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status: string = row.getValue('status');
            return <Badge variant={getStatusVariant(status)}>{status}</Badge>
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        }
    },
    {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => {
            const card = row.original;
            return (
              <div className="flex gap-2">
                <RechargeDialog card={card} />
                <ReprintQrButton card={card} />
              </div>
            )
        }
    }
]

export default function CardsPage() {
  const { user } = useAuth();
  const allCards = useCollection<CardType>('cards');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (allCards !== null) {
      setIsLoading(false);
    }
  }, [allCards]);

  const handleDeleteSelected = async (selectedData: CardType[]) => {
    const cardIds = selectedData.map(card => card.id);
    const result = await deleteCards(cardIds);
    toast({
        title: result.status === 'success' ? 'Sucesso!' : 'Erro!',
        description: result.message,
        variant: result.status === 'success' ? 'default' : 'destructive'
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Users />
            Gerenciar Cartões
        </CardTitle>
        <CardDescription>
            Visualize, pesquise e filtre todos os cartões cadastrados no sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={allCards || []}
            filterColumns={[
                {
                    columnId: 'nome_cliente',
                    placeholder: 'Buscar por nome...'
                },
                 {
                    columnId: 'telefone_cliente',
                    placeholder: 'Buscar por telefone...'
                },
                {
                    columnId: 'qr_code_id',
                    placeholder: 'Buscar por QR Code...'
                },
                {
                    columnId: 'status',
                    placeholder: 'Filtrar status...',
                    options: [
                        {value: "ATIVO", label: "Ativo"},
                        {value: "INATIVO", label: "Inativo"},
                        {value: "BLOQUEADO", label: "Bloqueado"},
                    ]
                }
            ]}
            onDeleteSelected={user?.role === 'ADMIN' ? handleDeleteSelected : undefined}
           />
        )}
      </CardContent>
    </Card>
  );
}
