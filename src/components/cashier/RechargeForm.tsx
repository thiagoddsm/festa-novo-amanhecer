'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { collection, query, where, getDocs, writeBatch, Timestamp, doc } from 'firebase/firestore';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Loader2, QrCode } from 'lucide-react';
import QrScannerDialog from '../common/QrScannerDialog';
import type { Card as CardType } from '@/lib/definitions';
import { notifyRecharge } from '@/lib/flows/notify-flow';

const RechargeSchema = z.object({
  qr_code_id: z.string().min(1, 'QR Code ID é obrigatório.'),
  valor_recarga: z.coerce.number().positive('Valor da recarga deve ser positivo.'),
});

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Loader2 className="animate-spin" /> : 'Recarregar Saldo'}
    </Button>
  );
}

export default function RechargeForm() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [qrCodeId, setQrCodeId] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleScan = useCallback((data: string) => {
    setQrCodeId(data);
    setIsScannerOpen(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou conexão indisponível.' });
      return;
    }
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const validatedFields = RechargeSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Dados inválidos.';
      toast({ variant: 'destructive', title: 'Erro de Validação', description: firstError });
      setIsPending(false);
      return;
    }

    try {
      const { qr_code_id, valor_recarga } = validatedFields.data;
      const cardsRef = collection(firestore, 'cards');
      const q = query(cardsRef, where('qr_code_id', '==', qr_code_id));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Cartão não encontrado.');
      }

      const cardDoc = querySnapshot.docs[0];
      const card = cardDoc.data() as CardType;

      if (card.status !== 'ATIVO') {
        throw new Error(`Cartão com status ${card.status} não pode ser recarregado.`);
      }

      const valor_recarga_centavos = valor_recarga * 100;
      const novo_saldo_centavos = card.saldo_centavos + valor_recarga_centavos;

      const batch = writeBatch(firestore);

      batch.update(cardDoc.ref, {
        saldo_centavos: novo_saldo_centavos,
        updated_at: Timestamp.now()
      });

      const transactionRef = doc(collection(firestore, "transactions"));
      batch.set(transactionRef, {
        cartao_id: cardDoc.id,
        pdv_id: 'caixa_central',
        tipo: 'RECARGA',
        valor_centavos: valor_recarga_centavos,
        created_at: Timestamp.now(),
        usuario_responsavel: user.name || 'Caixa',
      });

      await batch.commit();

      toast({
        title: 'Recarga bem-sucedida!',
        description: `Novo saldo: ${formatCurrency(novo_saldo_centavos)}`,
      });

      notifyRecharge(cardDoc.id, valor_recarga_centavos).catch(console.error);

      formRef.current?.reset();
      setQrCodeId('');

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      toast({
        variant: 'destructive',
        title: 'Erro ao recarregar',
        description: message,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Recarregar Saldo</CardTitle>
          <CardDescription>
            Adicione créditos a um cartão existente escaneando o QR Code.
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
                <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                  <QrCode className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_recarga">Valor da Recarga (R$)</Label>
              <Input
                id="valor_recarga"
                name="valor_recarga"
                type="number"
                placeholder="Ex: 20.00"
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
