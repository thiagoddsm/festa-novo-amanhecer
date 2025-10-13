'use client'
import { getSalesReport, getTransactions, getPdvById } from '@/lib/data';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AiSummary from '@/components/dashboard/AiSummary';
import { DollarSign, CreditCard, ShoppingBag, TrendingUp, TestTube } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { useState, useEffect } from 'react';
import type { Pdv, Transaction } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type Report = {
  total_vendido_centavos: number;
  total_recarregado_centavos: number;
  vendas_por_pdv: {
    pdv_id: number;
    nome: string;
    total_centavos: number;
  }[];
}

export default function DashboardPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    // Data fetching is now client-side
    setReport(getSalesReport());
    setRecentTransactions(getTransactions(10));
  }, []);

  const handleTestWrite = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Firestore não está inicializado. Verifique a configuração do Firebase.',
      });
      return;
    }
    try {
      const testCollection = collection(firestore, 'test_writes');
      await addDoc(testCollection, {
        message: 'Hello Firestore!',
        timestamp: serverTimestamp(),
      });
      toast({
        title: 'Sucesso!',
        description: 'Um documento de teste foi escrito no Firestore com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao escrever no Firestore:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      toast({
        variant: 'destructive',
        title: 'Falha na Escrita no Firestore',
        description: `Não foi possível escrever no banco de dados. Verifique o console e suas regras de segurança do Firestore. Erro: ${errorMessage}`,
      });
    }
  };

  if (!report) {
    return <div>Carregando relatório...</div>;
  }

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
        <div className="flex flex-col gap-6">
          <AiSummary />
           <Card>
            <CardHeader>
              <CardTitle>Teste do Firestore</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Clique no botão abaixo para tentar escrever um documento na coleção 'test_writes' do Firestore.
              </p>
              <Button onClick={handleTestWrite} className="w-full">
                <TestTube className="mr-2" />
                Testar Escrita no Firestore
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
