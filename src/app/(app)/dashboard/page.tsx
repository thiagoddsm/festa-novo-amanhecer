'use client'
import { getPdvById } from '@/lib/data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AiSummary from '@/components/dashboard/AiSummary';
import { DollarSign, CreditCard, ShoppingBag, TrendingUp, TestTube, Users } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useState, useEffect, useMemo } from 'react';
import type { Card as CardType, Pdv, Transaction } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

function useCollection<T>(path: string) {
  const [data, setData] = useState<T[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const collRef = collection(firestore, path);
    // Note: This basic implementation doesn't include query parameters.
    // For more complex scenarios, you might need to pass queries to the hook.
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const allDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
      setData(allDocs);
    });

    return () => unsubscribe();
  }, [firestore, path]);

  return data;
}

const formatTimestamp = (ts: Timestamp | Date) => {
  if (ts instanceof Timestamp) {
    return ts.toDate();
  }
  return ts;
}

export default function DashboardPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Fetch data in real-time from Firestore
  const allCards = useCollection<CardType>('cards');
  const allTransactions = useCollection<Transaction>('transactions');
  
  const [isLoading, setIsLoading] = useState(true);

  // Memoize calculations to prevent re-running on every render
  const report = useMemo(() => {
    if (!allTransactions) return null;

    const total_recarregado_centavos = allTransactions
      .filter(t => t.tipo === 'RECARGA')
      .reduce((sum, t) => sum + t.valor_centavos, 0);

    const total_vendido_centavos = allTransactions
      .filter(t => t.tipo === 'VENDA')
      .reduce((sum, t) => sum + t.valor_centavos, 0);

    const totalVendasUn = allTransactions.filter(t => t.tipo === 'VENDA').length;
    
    return {
      total_recarregado_centavos,
      total_vendido_centavos,
      totalVendasUn,
      ticketMedio: total_vendido_centavos / (totalVendasUn || 1),
    };
  }, [allTransactions]);

  const recentTransactions = useMemo(() => {
    if (!allTransactions) return [];
    
    // Sort transactions by date and take the last 10
    return [...allTransactions]
      .sort((a, b) => formatTimestamp(b.created_at).getTime() - formatTimestamp(a.created_at).getTime())
      .slice(0, 10);
  }, [allTransactions]);

  useEffect(() => {
    if (allCards !== null && allTransactions !== null) {
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [allCards, allTransactions])


  const stats = [
    { title: 'Total Recarregado', value: report ? formatCurrency(report.total_recarregado_centavos) : 'R$ 0,00', icon: CreditCard },
    { title: 'Total Vendido', value: report ? formatCurrency(report.total_vendido_centavos) : 'R$ 0,00', icon: DollarSign },
    { title: 'Cartões Ativos', value: allCards?.length ?? 0, icon: Users },
    { title: 'Ticket Médio', value: report ? formatCurrency(report.ticketMedio) : 'R$ 0,00', icon: TrendingUp }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          stats.map(stat => <StatCard key={stat.title} {...stat} />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-96" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PDV</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.length > 0 ? recentTransactions.map((tx) => {
                    const pdv = getPdvById(tx.pdv_id);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>{pdv?.nome || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={tx.tipo === 'VENDA' ? 'destructive' : 'secondary'}>{tx.tipo}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(tx.valor_centavos)}</TableCell>
                        <TableCell>{formatDateTime(formatTimestamp(tx.created_at))}</TableCell>
                      </TableRow>
                    )
                  }) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">Nenhuma transação recente.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <AiSummary />
        </div>
      </div>
    </div>
  );
}
