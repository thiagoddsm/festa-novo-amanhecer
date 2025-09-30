'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { rechargeCard } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Recarregar Saldo'}
    </Button>
  );
}

export default function RechargeForm() {
  const [state, formAction] = useFormState(rechargeCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.message) return;

    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro ao recarregar',
        description: state.message,
      });
    } else if (state.status === 'success') {
      toast({
        title: 'Recarga bem-sucedida!',
        description: `Novo saldo: ${formatCurrency(state.data.novo_saldo_centavos)}`,
      });
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recarregar Saldo</CardTitle>
        <CardDescription>
          Adicione créditos a um cartão existente escaneando o QR Code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr_code_id">QR Code ID</Label>
            <Input
              id="qr_code_id"
              name="qr_code_id"
              placeholder="Escaneie ou digite o ID"
              required
            />
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
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
