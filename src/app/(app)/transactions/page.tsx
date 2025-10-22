'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Transaction, Card as CardType } from '@/lib/definitions';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { List, Search } from 'lucide-react';
import { getPdvById } from '@/lib/data';

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
          
          // Get PDV name
          details.pdv_nome = getPdvById(trans.pdv_id)?.nome || `PDV ID: ${trans.pdv_id}`;

          // Get Card QR Code ID
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

export default function TransactionsPage() {
  const allTransactions = useTransactionDetails();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (allTransactions !== null) {
      setIsLoading(false);
    }
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    const lowercasedFilter = searchTerm.toLowerCase();
    return allTransactions.filter(trans =>
      trans.card_qr_code_id?.toLowerCase().includes(lowercasedFilter) ||
      trans.pdv_nome?.toLowerCase().includes(lowercasedFilter) ||
      trans.tipo.toLowerCase().includes(lowercasedFilter)
    );
  }, [allTransactions, searchTerm]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <List />
            Histórico de Transações
        </CardTitle>
        <CardDescription>
            Visualize e pesquise todas as transações do evento.
        </CardDescription>
        <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Buscar por PDV, Tipo ou QR Code do Cartão..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PDV</TableHead>
                  <TableHead>Cartão (QR Code)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data e Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? filteredTransactions.map((trans) => (
                  <TableRow key={trans.id}>
                    <TableCell>{trans.pdv_nome}</TableCell>
                    <TableCell className="font-mono text-xs">{trans.card_qr_code_id}</TableCell>
                    <TableCell>
                      <Badge variant={getTipoVariant(trans.tipo)}>{trans.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(trans.valor_centavos)}</TableCell>
                    <TableCell>{formatTimestamp(trans.created_at)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
