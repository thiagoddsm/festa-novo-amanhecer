'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { useTenant } from '@/hooks/use-tenant-context';
import { collection, query, where, doc, runTransaction, getDocs, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, ArrowRightLeft } from 'lucide-react';
import QrScannerDialog from '../common/QrScannerDialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency } from '@/lib/utils';
import type { Card as CardType } from '@/lib/definitions';


const TransferBalanceSchema = z.object({
  origin_qr_code_id: z.string().min(1, 'ID do cartão de origem é obrigatório.'),
  destination_qr_code_id: z.string().min(1, 'ID do cartão de destino é obrigatório.'),
  valor_transferencia: z.coerce.number().positive('O valor deve ser positivo.'),
}).refine(data => data.origin_qr_code_id !== data.destination_qr_code_id, {
  message: 'O cartão de origem e destino não podem ser os mesmos.',
  path: ['destination_qr_code_id'],
});

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Loader2 className="animate-spin" /> : 'Confirmar Transferência'}
    </Button>
  );
}

export default function TransferBalanceForm() {
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [originQr, setOriginQr] = useState('');
  const [destQr, setDestQr] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerTargetRef = useRef<'origin' | 'destination' | null>(null);

  const openScanner = (target: 'origin' | 'destination') => {
    scannerTargetRef.current = target;
    setIsScannerOpen(true);
  };

  const handleScan = useCallback((data: string) => {
    if (scannerTargetRef.current === 'origin') {
      setOriginQr(data);
    } else if (scannerTargetRef.current === 'destination') {
      setDestQr(data);
    }
    setIsScannerOpen(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
        return;
    }
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const validatedFields = TransferBalanceSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Dados inválidos.';
      toast({ variant: 'destructive', title: 'Erro de Validação', description: firstError });
      setIsPending(false);
      return;
    }

    try {
        const { origin_qr_code_id, destination_qr_code_id, valor_transferencia } = validatedFields.data;
        const valor_centavos = valor_transferencia * 100;
        
        await runTransaction(firestore, async (transaction) => {
            const cardsRef = collection(firestore, 'cards');
            
            // Get origin card
            const originQuery = query(cardsRef, where('qr_code_id', '==', origin_qr_code_id));
            const originSnapshot = await getDocs(originQuery);
            if (originSnapshot.empty) throw new Error('Cartão de origem não encontrado.');
            const originCardDoc = originSnapshot.docs[0];
            const originCard = originCardDoc.data() as CardType;

            // Get destination card
            const destQuery = query(cardsRef, where('qr_code_id', '==', destination_qr_code_id));
            const destSnapshot = await getDocs(destQuery);
            if (destSnapshot.empty) throw new Error('Cartão de destino não encontrado.');
            const destCardDoc = destSnapshot.docs[0];
            const destCard = destCardDoc.data() as CardType;

            // Validations
            if (originCard.saldo_centavos < valor_centavos) throw new Error('Saldo insuficiente no cartão de origem.');
            if (originCard.status !== 'ATIVO' || destCard.status !== 'ATIVO') throw new Error('Ambos os cartões devem estar ATIVOS.');

            // Update balances
            const newOriginBalance = originCard.saldo_centavos - valor_centavos;
            const newDestBalance = destCard.saldo_centavos + valor_centavos;

            transaction.update(originCardDoc.ref, { saldo_centavos: newOriginBalance, updated_at: Timestamp.now() });
            transaction.update(destCardDoc.ref, { saldo_centavos: newDestBalance, updated_at: Timestamp.now() });

            // Create transactions
            const transactionsRef = collection(firestore, 'transactions');
            const originTxRef = doc(transactionsRef);
            transaction.set(originTxRef, {
                cartao_id: originCardDoc.id, pdv_id: 'caixa_central', tipo: 'TRANSFER_OUT',
                valor_centavos, created_at: Timestamp.now(), usuario_responsavel: user.name,
                tenant_id: currentTenant?.id ?? null, event_id: currentEvent?.id ?? null,
            });
            const destTxRef = doc(transactionsRef);
            transaction.set(destTxRef, {
                cartao_id: destCardDoc.id, pdv_id: 'caixa_central', tipo: 'TRANSFER_IN',
                valor_centavos, created_at: Timestamp.now(), usuario_responsavel: user.name,
                tenant_id: currentTenant?.id ?? null, event_id: currentEvent?.id ?? null,
            });
        });

        toast({
            title: 'Sucesso!',
            description: `Transferência de ${formatCurrency(valor_centavos)} realizada com sucesso!`,
        });
        formRef.current?.reset();
        setOriginQr('');
        setDestQr('');

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        toast({ variant: 'destructive', title: 'Erro na Transferência', description: message });
    } finally {
        setIsPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transferir Saldo</CardTitle>
          <CardDescription>
            Mova o saldo de um cartão para outro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="origin_qr_code_id">Cartão de Origem</Label>
              <div className="flex gap-2">
                <Input
                  id="origin_qr_code_id"
                  name="origin_qr_code_id"
                  placeholder="ID do cartão de origem"
                  required
                  value={originQr}
                  onChange={(e) => setOriginQr(e.target.value)}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => openScanner('origin')}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_qr_code_id">Cartão de Destino</Label>
              <div className="flex gap-2">
                <Input
                  id="destination_qr_code_id"
                  name="destination_qr_code_id"
                  placeholder="ID do cartão de destino"
                  required
                  value={destQr}
                  onChange={(e) => setDestQr(e.target.value)}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => openScanner('destination')}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="valor_transferencia">Valor a Transferir (R$)</Label>
              <Input
                id="valor_transferencia"
                name="valor_transferencia"
                type="number"
                placeholder="Ex: 25.50"
                step="0.01"
                required
              />
            </div>
            <SubmitButton isPending={isPending} />
          </form>
        </CardContent>
      </Card>

      <QrScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
