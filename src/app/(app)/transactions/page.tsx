'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, getDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import type { Transaction, Card as CardType, Pdv } from '@/lib/definitions';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { List, Package, User } from 'lucide-react';
import { getPdvNameById } from '@/lib/actions';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef } from '@tanstack/react-table';

type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
  nome_cliente?: string;
};

// A simple cache to avoid re-fetching details
const cardCache = new Map<string, CardType>();
const pdvCache = new Map<string, string>();
const pdvListCache: Pdv[] = [];


function useTransactionDetails() {
  const [transactions, setTransactions] = useState<TransactionDetails[] | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

     const pdvCollRef = collection(firestore, 'pdvs');
     const unsubPdvs = onSnapshot(pdvCollRef, (snapshot) => {
         const allPdvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
         pdvListCache.length = 0;
         Array.prototype.push.apply(pdvListCache, allPdvs);
         allPdvs.forEach(pdv => pdvCache.set(pdv.id, pdv.nome));
         setPdvs(allPdvs);
     });


    const transCollRef = collection(firestore, 'transactions');
    const q = query(transCollRef, orderBy('created_at', 'desc'));
    const unsubTrans = onSnapshot(q, async (snapshot) => {
      const allTransDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));

      // Enrich transactions with details
      const enrichedTransactions = await Promise.all(
        allTransDocs.map(async (trans) => {
          const details: TransactionDetails = { ...trans };
          
          details.pdv_nome = pdvCache.get(trans.pdv_id.toString()) || `PDV ID: ${trans.pdv_id}`;

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
            details.nome_cliente = cardData?.nome_cliente || 'N/A';
          }
          
          return details;
        })
      );
      

      setTransactions(enrichedTransactions);
    });

    return () => {
        unsubPdvs();
        unsubTrans();
    }
  }, [firestore]);

  return {transactions, pdvs};
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

const SubRowComponent = ({ row }: { row: { original: TransactionDetails } }) => {
    const { items, nome_cliente } = row.original;
    return (
        <div className="p-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><User className="h-4 w-4" /> Cliente</h4>
                    <p className="text-sm text-muted-foreground">{nome_cliente || 'Não informado'}</p>
                </div>
                <div>
                     <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Itens do Pedido</h4>
                     {items && items.length > 0 ? (
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {items.map((item, index) => (
                                <li key={index}>
                                    {item.quantity}x {item.name} ({formatCurrency(item.price * item.quantity)})
                                </li>
                            ))}
                        </ul>
                     ) : (
                        <p className="text-sm text-muted-foreground">Nenhum item registrado (Recarga ou Reembolso).</p>
                     )}
                </div>
            </div>
        </div>
    );
};


export default function TransactionsPage() {
  const { transactions: allTransactions, pdvs } = useTransactionDetails();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (allTransactions !== null) {
      setIsLoading(false);
    }
  }, [allTransactions]);

  const pdvOptions = pdvs.map(pdv => ({ value: pdv.nome, label: pdv.nome }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <List />
            Histórico de Transações
        </CardTitle>
        <CardDescription>
            Visualize, filtre e expanda para ver detalhes de todas as transações do evento.
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
            renderSubComponent={SubRowComponent}
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
