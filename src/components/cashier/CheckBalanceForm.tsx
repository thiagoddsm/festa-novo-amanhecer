'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { Card as CardType } from '@/lib/definitions';
import { Loader2, User, CircleAlert, Wallet, Hash, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import QrScannerDialog from '../common/QrScannerDialog';

const CheckBalanceSchema = z.object({
  qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
});

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Loader2 className="animate-spin" /> : 'Consultar Saldo'}
    </Button>
  );
}

export default function CheckBalanceForm() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [qrCodeId, setQrCodeId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ status: 'success' | 'error' | 'idle', message?: string, data?: CardType } | null>(null);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'secondary';
      case 'INATIVO': return 'outline';
      case 'BLOQUEADO': return 'destructive';
      default: return 'default';
    }
  }

  const handleScan = (data: string) => {
    setQrCodeId(data);
    setIsScannerOpen(false);
    setTimeout(() => {
      formRef.current?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 100);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setResult({ status: 'idle' });

    const formData = new FormData(e.currentTarget);
    const validatedFields = CheckBalanceSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.qr_code_id?.[0] || 'QR Code ID inválido.';
      toast({ variant: 'destructive', title: 'Erro de Validação', description: errorMsg });
      setIsPending(false);
      return;
    }

    try {
      const { qr_code_id } = validatedFields.data;
      const cardsRef = collection(firestore, 'cards');
      const q = query(cardsRef, where('qr_code_id', '==', qr_code_id));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setResult({ status: 'error', message: 'Cartão não encontrado.' });
        formRef.current?.reset();
        setQrCodeId('');
        setIsPending(false);
        return;
      }

      const cardDoc = querySnapshot.docs[0];
      const cardData = { id: cardDoc.id, ...cardDoc.data() } as CardType;

      setResult({ status: 'success', data: cardData });
      formRef.current?.reset();
      setQrCodeId('');

    } catch (error) {
      console.error("Client-side balance check failed:", error);
      const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      setResult({ status: 'error', message: `Erro ao consultar saldo: ${message}` });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Consultar Saldo</CardTitle>
          <CardDescription>
            Verifique o saldo e o status de um cartão pelo QR Code ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr_code_id">QR Code ID</Label>
              <div className="flex gap-2">
                <Input
                  id="qr_code_id"
                  name="qr_code_id"
                  placeholder="Escaneie ou digite o ID"
                  required
                  value={qrCodeId}
                  onChange={(e) => setQrCodeId(e.target.value)}
                />
                <Button type='button' variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <SubmitButton isPending={isPending} />
          </form>
        </CardContent>
        {result?.status === 'success' && result.data && (
          <CardFooter className="flex flex-col items-start space-y-4 border-t px-6 py-4">
            <div className="flex w-full justify-between items-center">
              <h3 className="font-semibold text-lg">Detalhes do Cartão</h3>
              <Badge variant={getStatusVariant(result.data.status)}>{result.data.status}</Badge>
            </div>
            {result.data.nome_cliente && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{result.data.nome_cliente}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span className="truncate">{result.data.qr_code_id}</span>
            </div>
            <div className="flex items-center gap-2 text-2xl font-bold text-primary">
              <Wallet className="h-6 w-6" />
              <span>{formatCurrency(result.data.saldo_centavos)}</span>
            </div>
          </CardFooter>
        )}
        {result?.status === 'error' && result.message && (
          <CardFooter className="flex flex-col items-center space-y-2 border-t px-6 py-4 text-center">
            <CircleAlert className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{result.message}</p>
          </CardFooter>
        )}
      </Card>
      <QrScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
