'use client';
import { useState, useEffect, useMemo, useTransition } from 'react';
import { useFirestore } from '@/firebase';
import { collection, Timestamp, query, orderBy } from 'firebase/firestore';
import type { Transaction, Card as CardType, Pdv } from '@/lib/definitions';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { List, Package, User, CornerDownRight, UserCog, Undo2, Loader2, ArrowRightLeft } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { type ColumnDef, type Row } from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/hooks/use-auth-context';
import { deleteTransactions, reverseTransaction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


type TransactionDetails = Transaction & {
  card_qr_code_id?: string;
  pdv_nome?: string;
  nome_cliente?: string;
};

function useTransactionDetails() {
  const firestore = useFirestore();

  const transactionsQuery = useMemoFirebase(() => query(collection(firestore, 'transactions'), orderBy('created_at', 'desc')), [firestore]);
  const cardsQuery = useMemoFirebase(() => collection(firestore, 'cards'), [firestore]);
  const pdvsQuery = useMemoFirebase(() => collection(firestore, 'pdvs'), [firestore]);

  const { data: transactions, isLoading: loadingTxs } = useCollection<Transaction>(transactionsQuery);
  const { data: cards, isLoading: loadingCards } = useCollection<CardType>(cardsQuery);
  const { data: pdvs, isLoading: loadingPdvs } = useCollection<Pdv>(pdvsQuery);

  const cardMap = useMemo(() => {
    const map = new Map<string, CardType>();
    cards?.forEach(card => map.set(card.id, card));
    return map;
  }, [cards]);

  const pdvMap = useMemo(() => {
    const map = new Map<string, string>();
    pdvs?.forEach(pdv => map.set(pdv.id, pdv.nome));
    map.set('caixa_central', 'Caixa Central');
    return map;
  }, [pdvs]);

  const enrichedTransactions = useMemo(() => {
    if (!transactions || !cards || !pdvs) return null;

    return transactions.map((trans) => {
      const card = trans.cartao_id ? cardMap.get(trans.cartao_id) : undefined;
      return {
        ...trans,
        pdv_nome: pdvMap.get(trans.pdv_id) || `PDV ID: ${trans.pdv_id}`,
        card_qr_code_id: card?.qr_code_id || 'Desconhecido',
        nome_cliente: card?.nome_cliente || 'N/A',
      };
    });
  }, [transactions, cards, pdvs, cardMap, pdvMap]);

  return {
    transactions: enrichedTransactions,
    pdvs: pdvs || [],
    isLoading: loadingTxs || loadingCards || loadingPdvs,
  };
}

const getTipoVariant = (tipo: string) => {
    switch (tipo) {
      case 'VENDA': return 'destructive';
      case 'RECARGA': return 'secondary';
      case 'REEMBOLSO': return 'outline';
      case 'TRANSFER_IN': return 'default';
      case 'TRANSFER_OUT': return 'secondary';
      default: return 'default';
    }
  };

  const formatTimestamp = (ts: unknown): Date => {
    if (ts instanceof Timestamp) {
      return ts.toDate();
    }
    if (ts instanceof Date) {
      return ts;
    }
    if (typeof ts === 'string') {
      return new Date(ts);
    }
    return new Date();
  }

  function ReversalButton({ transaction, user }: { transaction: TransactionDetails, user: any }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleReversal = () => {
        startTransition(async () => {
            const result = await reverseTransaction(transaction.id, user?.name || 'Admin');
            toast({
                title: result.status === 'success' ? 'Sucesso!' : 'Erro!',
                description: result.message,
                variant: result.status === 'success' ? 'default' : 'destructive'
            });
        });
    }
    
    // Disable if transaction is a refund or transfer
    if (transaction.tipo === 'REEMBOLSO' || transaction.tipo === 'TRANSFER_IN' || transaction.tipo === 'TRANSFER_OUT' || !user || !['SUPERADMIN', 'ADMIN_ORGANIZACAO'].includes(user.role ?? '')) {
        return null;
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
                    Estornar
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Estorno</AlertDialogTitle>
                    <AlertDialogDescription>
                        Você está prestes a estornar esta transação de {formatCurrency(transaction.valor_centavos)}. 
                        Esta ação é irreversível. O saldo do cartão será ajustado.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReversal}>Confirmar Estorno</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

const getColumns = (user: any): ColumnDef<TransactionDetails>[] => [
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
      accessorKey: 'nome_cliente',
      header: 'Cliente',
    },
    {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => {
            const tipo: string = row.getValue('tipo');
            return <Badge variant={getTipoVariant(tipo)}>{tipo.replace('_', ' ')}</Badge>
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        }
    },
    {
        accessorKey: 'valor_centavos',
        header: 'Valor',
        cell: ({ row }) => {
          const tipo: string = row.original.tipo;
          const valor: number = row.getValue('valor_centavos');
          const isDebit = tipo === 'VENDA' || tipo === 'TRANSFER_OUT';
          return <div className={`text-right ${isDebit ? 'text-destructive' : ''}`}>{isDebit ? '-' : '+'}{formatCurrency(valor)}</div>
        }
    },
    {
        accessorKey: 'usuario_responsavel',
        header: 'Usuário Responsável',
        cell: ({ row }) => <div className="flex items-center gap-2"><UserCog className="h-4 w-4 text-muted-foreground" /> {row.original.usuario_responsavel || 'N/A'}</div>
    },
    {
        accessorKey: 'created_at',
        header: 'Data e Hora',
        cell: ({ row }) => formatDateTime(formatTimestamp(row.getValue('created_at'))),
    },
    {
        id: 'actions',
        header: 'Ações',
        cell: ({ row }) => <ReversalButton transaction={row.original} user={user} />,
    },
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
                                     {item.observation && (
                                        <p className="text-xs text-blue-600 pl-4 flex items-center gap-1">
                                            <CornerDownRight className="h-3 w-3" /> {item.observation}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                     ) : (
                        <p className="text-sm text-muted-foreground">Nenhum item registrado (Recarga, Reembolso ou Transferência).</p>
                     )}
                </div>
            </div>
        </div>
    );
};

const generatePDF = (filteredData: Row<TransactionDetails>[]) => {
    const doc = new jsPDF();
    const tableRows: any[] = [];
    let totalValue = 0;

    filteredData.forEach(row => {
        const rowData = row.original;
        tableRows.push([
            rowData.pdv_nome,
            rowData.card_qr_code_id,
            rowData.tipo,
            rowData.usuario_responsavel || 'N/A',
            formatCurrency(rowData.valor_centavos),
            formatDateTime(formatTimestamp(rowData.created_at))
        ]);
        totalValue += rowData.valor_centavos;
    });

    const reportDate = formatDateTime(new Date());

    doc.setFontSize(18);
    doc.text('Relatório de Transações', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${reportDate}`, 14, 30);

    autoTable(doc, {
        head: [['PDV', 'Cartão (QR)', 'Tipo', 'Responsável', 'Valor', 'Data e Hora']],
        body: tableRows,
        startY: 35,
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setFontSize(12);
    doc.text(`Total de Transações: ${filteredData.length}`, 14, finalY + 10);
    doc.text(`Valor Total: ${formatCurrency(totalValue)}`, 14, finalY + 17);


    doc.save(`relatorio_transacoes_${Date.now()}.pdf`);
};

import { useTenant } from '@/hooks/use-tenant-context';

export default function TransactionsPage() {
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const { transactions: allTransactions, pdvs, isLoading } = useTransactionDetails();
  const { toast } = useToast();
  
  const columns = useMemo(() => getColumns(user), [user]);

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    return allTransactions.filter((tx) => {
      if (currentTenant && tx.tenant_id && tx.tenant_id !== currentTenant.id) return false;
      if (currentEvent && tx.event_id && tx.event_id !== currentEvent.id) return false;
      return true;
    });
  }, [allTransactions, currentTenant, currentEvent]);

  const pdvOptions = useMemo(() => {
    const options = pdvs.map(pdv => ({ value: pdv.nome, label: pdv.nome }));
    // Add Caixa Central if not already present
    if (!options.some(opt => opt.value === 'Caixa Central')) {
      options.push({ value: 'Caixa Central', label: 'Caixa Central' });
    }
    return options;
  }, [pdvs]);
  
  const handleDeleteSelected = async (selectedData: TransactionDetails[]) => {
    const transactionIds = selectedData.map(t => t.id);
    const result = await deleteTransactions(transactionIds);
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
            data={filteredTransactions}
            renderSubComponent={SubRowComponent}
            onGeneratePdf={generatePDF}
            onDeleteSelected={['SUPERADMIN', 'ADMIN_ORGANIZACAO'].includes(user?.role ?? '') ? handleDeleteSelected : undefined}
            filterColumns={[
                {
                    columnId: 'card_qr_code_id',
                    placeholder: 'Buscar por QR Code...'
                },
                {
                    columnId: 'usuario_responsavel',
                    placeholder: 'Buscar por usuário...'
                },
                {
                    columnId: 'nome_cliente',
                    placeholder: 'Buscar por cliente...'
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
                        {value: 'TRANSFER_IN', label: 'Transferência (Entrada)'},
                        {value: 'TRANSFER_OUT', label: 'Transferência (Saída)'},
                    ]
                }
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

    