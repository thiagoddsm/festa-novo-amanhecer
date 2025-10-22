'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Transaction, Card as CardType } from '@/lib/definitions';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { List } from 'lucide-react';
import { getPdvById, getPdvs } from '@/lib/data';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef, SortingState, getSortedRowModel } from '@tanstack/react-table';

type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
};

// A simple cache to avoid re-fetching card details
const cardCache = new Map<string, CardType>();

function useTransactionDetails() {
  const [transactions, setTransactions] = useState<TransactionDetails[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const transCollRef = collection(firestore, 'transactions');
    const unsubscribe = onSnapshot(transCollRef, async (snapshot) => {
      const allTransDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));

      // Enrich transactions with details
      const enrichedTransactions = await Promise.all(
        allTransDocs.map(async (trans) => {
          const details: TransactionDetails = { ...trans };
          
          details.pdv_nome = getPdvById(trans.pdv_id)?.nome || `PDV ID: ${trans.pdv_id}`;

          if (trans.cartao_id) {
            let cardData = cardCache.get(trans.cartao_id);
            if (!cardData) {
              const cardRef = doc(firestore, 'cards', trans.cartao_id);
              const cardSnap = await getDoc(cardRef);
              if (cardSnap.exists()) {
                cardData = cardSnap.data() as CardType;
                cardCache.set(trans.cartao_id, cardData);
              }
            }
            details.card_qr_code_id = cardData?.qr_code_id || 'Desconhecido';
          }
          
          return details;
        })
      );
      
      const sortedTransactions = enrichedTransactions.sort((a,b) => {
          const dateA = a.created_at instanceof Timestamp ? a.created_at.toDate() : new Date();
          const dateB = b.created_at instanceof Timestamp ? b.created_at.toDate() : new Date();
          return dateB.getTime() - dateA.getTime();
      });

      setTransactions(sortedTransactions);
    });

    return () => unsubscribe();
  }, [firestore]);

  return transactions;
}

const getTipoVariant = (tipo: string) => {
    switch (tipo) {
      case 'VENDA': return 'destructive';
      case 'RECARGA': return 'secondary';
      case 'REEMBOLSO': return 'outline';
      default: return 'default';
    }
  };

  const formatTimestamp = (ts: Timestamp | Date) => {
    const date = ts instanceof Timestamp ? ts.toDate() : ts;
    return formatDateTime(date);
  }

const columns: ColumnDef<TransactionDetails>[] = [
    {
        accessorKey: 'pdv_nome',
        header: 'PDV',
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        }
    },
    {
        accessorKey: 'card_qr_code_id',
        header: 'Cartão (QR Code)',
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue('card_qr_code_id')}</div>
    },
    {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => {
            const tipo: string = row.getValue('tipo');
            return <Badge variant={getTipoVariant(tipo)}>{tipo}</Badge>
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        }
    },
    {
        accessorKey: 'valor_centavos',
        header: 'Valor',
        cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('valor_centavos'))}</div>
    },
    {
        accessorKey: 'created_at',
        header: 'Data e Hora',
        cell: ({ row }) => formatTimestamp(row.getValue('created_at')),
    }
]


export default function TransactionsPage() {
  const allTransactions = useTransactionDetails();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (allTransactions !== null) {
      setIsLoading(false);
    }
  }, [allTransactions]);

  const pdvOptions = getPdvs().map(pdv => ({ value: pdv.nome, label: pdv.nome }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <List />
            Histórico de Transações
        </CardTitle>
        <CardDescription>
            Visualize, filtre e ordene todas as transações do evento.
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
            data={allTransactions || []}
            filterColumns={[
                {
                    columnId: 'card_qr_code_id',
                    placeholder: 'Buscar por QR Code...'
                },
                {
                    columnId: 'pdv_nome',
                    placeholder: 'Filtrar PDV...',
                    options: pdvOptions
                },
                {
                    columnId: 'tipo',
                    placeholder: 'Filtrar tipo...',
                    options: [
                        {value: 'VENDA', label: 'Venda'},
                        {value: 'RECARGA', label: 'Recarga'},
                        {value: 'REEMBOLSO', label: 'Reembolso'},
                    ]
                }
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
