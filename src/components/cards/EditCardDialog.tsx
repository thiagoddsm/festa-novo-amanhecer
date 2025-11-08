'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { updateCardDetails } from '@/lib/actions';
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
import { Loader2, Pencil } from 'lucide-react';
import type { Card } from '@/lib/definitions';
import { useFormStatus } from 'react-dom';

const initialState = {
  status: 'idle' as 'idle' | 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Salvar Alterações'}
    </Button>
  );
}

export default function EditCardDialog({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateCardDetails, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state.status === 'idle') return;

    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: state.message,
      });
    } else if (state.status === 'success') {
      toast({
        title: 'Sucesso!',
        description: 'Os dados do cartão foram atualizados.',
      });
      setOpen(false);
    }
  }, [state, toast]);

  useEffect(() => {
    if (!open) {
      // Reset form state when dialog is closed
      formRef.current?.reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Cartão</DialogTitle>
          <DialogDescription>
            Altere o nome e o telefone associados a este cartão.
            <br />
            <span className="text-xs font-mono text-muted-foreground">{card.qr_code_id}</span>
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4 py-4">
          <input type="hidden" name="cardId" value={card.id} />
          <div className="space-y-2">
            <Label htmlFor="nome_cliente">Nome do Cliente (Opcional)</Label>
            <Input
              id="nome_cliente"
              name="nome_cliente"
              defaultValue={card.nome_cliente}
              className="col-span-3"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone_cliente">Telefone do Cliente</Label>
            <Input
              id="telefone_cliente"
              name="telefone_cliente"
              defaultValue={card.telefone_cliente}
              className="col-span-3"
              required
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
