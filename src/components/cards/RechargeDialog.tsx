'use client';

import { useState, useRef } from 'react';
import { useFirestore, useAuth } from '@/firebase';
import { doc, writeBatch, Timestamp, collection } from 'firebase/firestore';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Wallet } from 'lucide-react';
import type { Card } from '@/lib/definitions';
import { notifyRecharge } from '@/lib/flows/notify-flow';


const RechargeSchema = z.object({
  valor_recarga: z.coerce.number().positive('Valor da recarga deve ser positivo.'),
});


function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : 'Confirmar Recarga'}
    </Button>
  );
}

export default function RechargeDialog({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const { user } = useAuth();
  const firestore = useFirestore();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
        return;
    }
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const validatedFields = RechargeSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      const errorMsg = validatedFields.error.flatten().fieldErrors.valor_recarga?.[0] || 'Valor inválido.';
      toast({ variant: 'destructive', title: 'Erro de Validação', description: errorMsg });
      setIsPending(false);
      return;
    }

    try {
        if (card.status !== 'ATIVO') {
            throw new Error(`Cartão com status ${card.status} não pode ser recarregado.`);
        }

        const { valor_recarga } = validatedFields.data;
        const valor_recarga_centavos = valor_recarga * 100;
        const novo_saldo_centavos = card.saldo_centavos + valor_recarga_centavos;

        const batch = writeBatch(firestore);

        const cardDocRef = doc(firestore, 'cards', card.id);
        batch.update(cardDocRef, {
            saldo_centavos: novo_saldo_centavos,
            updated_at: Timestamp.now()
        });

        const transactionRef = doc(collection(firestore, "transactions"));
        batch.set(transactionRef, {
            cartao_id: card.id,
            pdv_id: 'caixa_central',
            tipo: 'RECARGA',
            valor_centavos: valor_recarga_centavos,
            created_at: Timestamp.now(),
            usuario_responsavel: user.name || 'Caixa',
        });
        
        await batch.commit();

        toast({
            title: 'Recarga bem-sucedida!',
            description: `O cartão ${card.qr_code_id} foi recarregado. Novo saldo: ${formatCurrency(novo_saldo_centavos)}`,
        });

        notifyRecharge(card.id, valor_recarga_centavos).catch(console.error);
        
        setOpen(false);

    } catch(error) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wallet className="mr-2 h-4 w-4" />
          Recarregar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Recarregar Cartão</DialogTitle>
          <DialogDescription>
            Adicione créditos para o cartão de <span className="font-semibold text-primary">{card.nome_cliente || 'Cliente sem nome'}</span>.
            <br />
            <span className="text-xs font-mono text-muted-foreground">{card.qr_code_id}</span>
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="valor_recarga" className="text-right">
              Valor da Recarga (R$)
            </Label>
            <Input
              id="valor_recarga"
              name="valor_recarga"
              type="number"
              placeholder="Ex: 20.00"
              step="0.01"
              className="col-span-3"
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancelar</Button>
            </DialogClose>
            <SubmitButton isPending={isPending} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
