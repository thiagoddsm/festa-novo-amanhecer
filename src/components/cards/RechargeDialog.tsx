'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { rechargeCard } from '@/lib/actions';
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

const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Confirmar Recarga'}
    </Button>
  );
}

export default function RechargeDialog({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(rechargeCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || !state.message || state.status === 'idle') return;

    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro ao recarregar',
        description: state.message,
      });
    } else if (state.status === 'success') {
      toast({
        title: 'Recarga bem-sucedida!',
        description: `O cartão ${card.qr_code_id} foi recarregado. Novo saldo: ${formatCurrency(state.data.novo_saldo_centavos)}`,
      });
      formRef.current?.reset();
      setOpen(false); // Close dialog on success
    }
  }, [state, toast, card.qr_code_id]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      formRef.current?.reset();
    }
  }, [open]);


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
            <br/>
            <span className="text-xs font-mono text-muted-foreground">{card.qr_code_id}</span>
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4 py-4">
            <input type="hidden" name="qr_code_id" value={card.qr_code_id} />
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
                <SubmitButton />
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
