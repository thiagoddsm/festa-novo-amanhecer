'use client'
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, TrendingUp, Users } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useState, useEffect, useMemo } from 'react';
import type { Card as CardType, Pdv, Transaction } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import BulkNotifier from '@/components/dashboard/BulkNotifier';
import SalesChart from '@/components/dashboard/SalesChart';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/provider';

import { useTenant } from '@/hooks/use-tenant-context';

const formatTimestamp = (ts: unknown): Date => {
  if (ts instanceof Timestamp) {
    return ts.toDate();
  }
  // Handle cases where the timestamp might already be a Date object or an ISO string
  if (ts instanceof Date) {
    return ts;
  }
  if (typeof ts === 'string') {
    return new Date(ts);
  }
  // Fallback for any other unexpected type
  return new Date();
}


export default function DashboardPage() {
  const firestore = useFirestore();
  const { currentTenant, currentEvent } = useTenant();

  const cardsQuery = useMemoFirebase(() => collection(firestore, 'cards'), [firestore]);
  const transactionsQuery = useMemoFirebase(() => collection(firestore, 'transactions'), [firestore]);
  const pdvsQuery = useMemoFirebase(() => collection(firestore, 'pdvs'), [firestore]);
  
  const { data: allCards, isLoading: loadingCards } = useCollection<CardType>(cardsQuery);
  const { data: allTransactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);
  const { data: allPdvs, isLoading: loadingPdvs } = useCollection<Pdv>(pdvsQuery);
  
  const isLoading = loadingCards || loadingTransactions || loadingPdvs;

  // Filter cards by current tenant and event
  const filteredCards = useMemo(() => {
    if (!allCards) return [];
    return allCards.filter((card) => {
      if (currentTenant && card.tenant_id && card.tenant_id !== currentTenant.id) return false;
      if (currentEvent && card.event_id && card.event_id !== currentEvent.id) return false;
      return true;
    });
  }, [allCards, currentTenant, currentEvent]);

  // Filter transactions by current tenant and event
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    return allTransactions.filter((tx) => {
      if (currentTenant && tx.tenant_id && tx.tenant_id !== currentTenant.id) return false;
      if (currentEvent && tx.event_id && tx.event_id !== currentEvent.id) return false;
      return true;
    });
  }, [allTransactions, currentTenant, currentEvent]);

  const pdvNameMap = useMemo(() => {
    if (!allPdvs) return new Map<string, string>();
    const map = new Map<string, string>();
    allPdvs.forEach(pdv => map.set(pdv.id, pdv.nome));
    map.set('caixa_central', 'Caixa Central');
    return map;
  }, [allPdvs]);

  const recentTransactions = useMemo(() => {
    if (!filteredTransactions) return [];
    
    return [...filteredTransactions]
      .sort((a, b) => formatTimestamp(b.created_at).getTime() - formatTimestamp(a.created_at).getTime())
      .slice(0, 10);
      
  }, [filteredTransactions]);

  const report = useMemo(() => {
    if (!filteredTransactions) return null;

    const total_recarregado_centavos = filteredTransactions
      .filter(t => t.tipo === 'RECARGA')
      .reduce((sum, t) => sum + t.valor_centavos, 0);

    const total_vendido_centavos = filteredTransactions
      .filter(t => t.tipo === 'VENDA')
      .reduce((sum, t) => sum + t.valor_centavos, 0);

    const totalVendasUn = filteredTransactions.filter(t => t.tipo === 'VENDA').length;
    
    return {
      total_recarregado_centavos,
      total_vendido_centavos,
      totalVendasUn,
      ticketMedio: total_vendido_centavos / (totalVendasUn || 1),
    };
  }, [filteredTransactions]);

  const salesByHour = useMemo(() => {
    if (!filteredTransactions) return [];
    
    const sales = filteredTransactions.filter(t => t.tipo === 'VENDA');
    const hourlyMap = new Map<string, { total: number; count: number }>();

    // Group by HH:00
    sales.forEach(tx => {
      const date = formatTimestamp(tx.created_at);
      const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
      const current = hourlyMap.get(hourStr) || { total: 0, count: 0 };
      hourlyMap.set(hourStr, {
        total: current.total + tx.valor_centavos,
        count: current.count + 1
      });
    });

    // Sort by hour
    return Array.from(hourlyMap.entries())
      .map(([hour, val]) => ({ hour, ...val }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [filteredTransactions]);

  const activeCardsStat = { title: 'Cartões Ativos', value: filteredCards?.length ?? 0, icon: Users };

  const stats = [
    { title: 'Total Recarregado', value: report ? formatCurrency(report.total_recarregado_centavos) : 'R$ 0,00', icon: CreditCard },
    { title: 'Total Vendido', value: report ? formatCurrency(report.total_vendido_centavos) : 'R$ 0,00', icon: DollarSign },
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
          <>
            {stats.map(stat => <StatCard key={stat.title} {...stat} />)}
            <Link href="/cards">
                <StatCard {...activeCardsStat} />
            </Link>
          </>
        )}
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Evolução de Vendas por Hora</CardTitle>
          <CardDescription>Acompanhe o volume financeiro vendido no decorrer do evento</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : salesByHour.length > 0 ? (
            <SalesChart data={salesByHour} />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma venda registrada até o momento.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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
                    return (
                        <TableRow key={tx.id}>
                        <TableCell>{pdvNameMap.get(tx.pdv_id) || 'Desconhecido'}</TableCell>
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
        <BulkNotifier />
      </div>
    </div>
  );
}
