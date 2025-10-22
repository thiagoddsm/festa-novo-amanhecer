'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Card as CardType } from '@/lib/definitions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';

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

export default function CardsPage() {
  const allCards = useCollection<CardType>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (allCards !== null) {
      setIsLoading(false);
    }
  }, [allCards]);

  const filteredCards = useMemo(() => {
    if (!allCards) return [];
    const lowercasedFilter = searchTerm.toLowerCase();
    return allCards.filter(card => 
      card.nome_cliente?.toLowerCase().includes(lowercasedFilter) ||
      card.telefone_cliente?.toLowerCase().includes(lowercasedFilter) ||
      card.qr_code_id.toLowerCase().includes(lowercasedFilter)
    );
  }, [allCards, searchTerm]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'secondary';
      case 'INATIVO': return 'outline';
      case 'BLOQUEADO': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Users />
            Gerenciar Cartões
        </CardTitle>
        <CardDescription>
            Visualize e pesquise todos os cartões cadastrados no sistema.
        </CardDescription>
        <div className="relative pt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Buscar por nome, telefone ou QR Code ID..."
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>QR Code ID</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length > 0 ? filteredCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>{card.nome_cliente || 'N/A'}</TableCell>
                    <TableCell>{card.telefone_cliente || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-xs">{card.qr_code_id}</TableCell>
                    <TableCell className="text-right">{formatCurrency(card.saldo_centavos)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getStatusVariant(card.status)}>{card.status}</Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum cartão encontrado.
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
