'use client'
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CreditCard, TrendingUp, Users, MessageSquare, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useState, useEffect, useMemo } from 'react';
import type { Card as CardType, Pdv, Transaction, Order } from '@/lib/definitions';
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
  const { currentTenant, currentEvent, isLoadingTenants } = useTenant();

  const cardsQuery = useMemoFirebase(() => collection(firestore, 'cards'), [firestore]);
  const transactionsQuery = useMemoFirebase(() => collection(firestore, 'transactions'), [firestore]);
  const pdvsQuery = useMemoFirebase(() => collection(firestore, 'pdvs'), [firestore]);
  const ordersQuery = useMemoFirebase(() => collection(firestore, 'orders'), [firestore]);
  
  const { data: allCards, isLoading: loadingCards } = useCollection<CardType>(cardsQuery);
  const { data: allTransactions, isLoading: loadingTransactions } = useCollection<Transaction>(transactionsQuery);
  const { data: allPdvs, isLoading: loadingPdvs } = useCollection<Pdv>(pdvsQuery);
  const { data: allOrders, isLoading: loadingOrders } = useCollection<Order>(ordersQuery);
  
  const isLoading = loadingCards || loadingTransactions || loadingPdvs || loadingOrders || isLoadingTenants;

  // Filter cards strictly by current tenant and event
  const filteredCards = useMemo(() => {
    if (!allCards || !currentTenant) return [];
    if (currentEvent) {
      return allCards.filter((card) => card.tenant_id === currentTenant.id && card.event_id === currentEvent.id);
    }
    return allCards.filter((card) => card.tenant_id === currentTenant.id && !card.event_id);
  }, [allCards, currentTenant, currentEvent]);

  // Filter transactions strictly by current tenant and event
  const filteredTransactions = useMemo(() => {
    if (!allTransactions || !currentTenant) return [];
    if (currentEvent) {
      return allTransactions.filter((tx) => tx.tenant_id === currentTenant.id && tx.event_id === currentEvent.id);
    }
    return allTransactions.filter((tx) => tx.tenant_id === currentTenant.id && !tx.event_id);
  }, [allTransactions, currentTenant, currentEvent]);

  // Filter PDVs strictly by current tenant and event
  const filteredPdvs = useMemo(() => {
    if (!allPdvs || !currentTenant) return [];
    if (currentEvent) {
      return allPdvs.filter((pdv) => pdv.tenant_id === currentTenant.id && pdv.event_id === currentEvent.id);
    }
    return allPdvs.filter((pdv) => pdv.tenant_id === currentTenant.id && !pdv.event_id);
  }, [allPdvs, currentTenant, currentEvent]);

  // Filter Orders strictly by current tenant and event
  const filteredOrders = useMemo(() => {
    if (!allOrders || !currentTenant) return [];
    if (currentEvent) {
      return allOrders.filter((order) => order.tenant_id === currentTenant.id && order.event_id === currentEvent.id);
    }
    return allOrders.filter((order) => order.tenant_id === currentTenant.id && !order.event_id);
  }, [allOrders, currentTenant, currentEvent]);

  // Calculate WhatsApp Operational Metrics
  const whatsappStats = useMemo(() => {
    const totalSent = filteredOrders.filter(o => o.notification_status === 'SENT').length;
    const sentByPdv = filteredOrders.filter(o => o.notification_status === 'SENT' && o.notification_route === 'PDV').length;
    const sentByFallback = filteredOrders.filter(o => o.notification_status === 'SENT' && o.notification_route === 'EVENT_FALLBACK').length;
    const totalFailed = filteredOrders.filter(o => o.notification_status === 'FAILED').length;
    const connectedPdvsCount = filteredPdvs.filter(p => p.whatsapp?.status === 'CONNECTED').length;
    const totalPdvsCount = filteredPdvs.length;

    return {
      totalSent,
      sentByPdv,
      sentByFallback,
      totalFailed,
      connectedPdvsCount,
      totalPdvsCount,
    };
  }, [filteredOrders, filteredPdvs]);

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

        <div className="flex flex-col gap-6">
          {/* WhatsApp Operational Metrics */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp Operacional do Evento
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                  Evolution API
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Métricas de disparo de pedidos prontos e status das conexões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-muted/40 rounded-lg border text-center">
                  <p className="text-[11px] text-muted-foreground font-medium">Total Enviadas</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">{whatsappStats.totalSent}</p>
                </div>
                <div className="p-3 bg-green-50/70 border border-green-200/80 rounded-lg text-center">
                  <p className="text-[11px] text-green-800 font-medium">Via Barracas</p>
                  <p className="text-lg font-bold text-green-700 mt-0.5">{whatsappStats.sentByPdv}</p>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-center">
                  <p className="text-[11px] text-blue-800 font-medium">Fallback IBM</p>
                  <p className="text-lg font-bold text-blue-700 mt-0.5">{whatsappStats.sentByFallback}</p>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-center">
                  <p className="text-[11px] text-amber-800 font-medium">Barracas On</p>
                  <p className="text-lg font-bold text-amber-900 mt-0.5">
                    {whatsappStats.connectedPdvsCount}/{whatsappStats.totalPdvsCount}
                  </p>
                </div>
              </div>

              {whatsappStats.totalFailed > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{whatsappStats.totalFailed} notificações falharam (ex: telefone ausente/inválido).</span>
                </div>
              )}
            </CardContent>
          </Card>

          <BulkNotifier />
        </div>
      </div>
    </div>
  );
}
