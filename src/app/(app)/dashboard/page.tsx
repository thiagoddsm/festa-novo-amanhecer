import { getSalesReport, getTransactions, getPdvById } from '@/lib/data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AiSummary from '@/components/dashboard/AiSummary';
import { DollarSign, CreditCard, ShoppingBag, TrendingUp } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { checkAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { user } = await checkAuth();
  if (user?.role !== 'CAIXA') {
    redirect('/login');
  }

  const report = getSalesReport();
  const recentTransactions = getTransactions(10);

  const stats = [
    { title: 'Total Recarregado', value: formatCurrency(report.total_recarregado_centavos), icon: CreditCard },
    { title: 'Total Vendido', value: formatCurrency(report.total_vendido_centavos), icon: DollarSign },
    { title: 'Total de Vendas (Un)', value: report.vendas_por_pdv.length, icon: ShoppingBag },
    { title: 'Ticket Médio', value: formatCurrency(report.total_vendido_centavos / (report.vendas_por_pdv.length || 1)), icon: TrendingUp }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => <StatCard key={stat.title} {...stat} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">Nenhuma transação recente.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <AiSummary />
      </div>
    </div>
  );
}
