'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { processSale } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { Pdv } from '@/lib/definitions';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Cobrar'}
    </Button>
  );
}

export default function SaleForm({ pdvs }: { pdvs: Pdv[] }) {
  const [state, formAction] = useFormState(processSale, initialState);
  const [confirmation, setConfirmation] = useState<{ status: 'success' | 'error'; message: string; details?: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!state.message) return;

    if (state.status === 'error') {
      setConfirmation({ status: 'error', message: 'Venda Recusada', details: state.message });
    } else {
      setConfirmation({
        status: 'success',
        message: 'Venda Aprovada',
        details: `Novo saldo: ${formatCurrency(state.data.novo_saldo_centavos)}`,
      });
      formRef.current?.reset();
    }

    const timer = setTimeout(() => setConfirmation(null), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  const onPdvChange = (value: string) => {
    const hiddenInput = formRef.current?.querySelector('input[name="pdv_id"]') as HTMLInputElement | null;
    if (hiddenInput) {
        hiddenInput.value = value;
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ponto de Venda</CardTitle>
          <CardDescription>
            Realize uma nova cobrança escaneando o QR Code do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor_venda">Valor da Venda (R$)</Label>
              <Input
                id="valor_venda"
                name="valor_venda"
                type="number"
                placeholder="Ex: 15.50"
                step="0.01"
                required
                className="h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr_code_id">QR Code ID</Label>
              <Input
                id="qr_code_id"
                name="qr_code_id"
                placeholder="Escaneie ou digite o ID do cliente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdv_select">Ponto de Venda</Label>
               <Select name="pdv_select" onValueChange={onPdvChange} required>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o PDV" />
                    </SelectTrigger>
                    <SelectContent>
                        {pdvs.map((pdv) => (
                            <SelectItem key={pdv.id} value={String(pdv.id)}>{pdv.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <input type="hidden" name="pdv_id" />
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
      {confirmation && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center text-white transition-opacity',
            confirmation.status === 'success' ? 'bg-green-500/95' : 'bg-red-500/95'
          )}
        >
          {confirmation.status === 'success' ? (
            <CheckCircle2 className="h-24 w-24" />
          ) : (
            <XCircle className="h-24 w-24" />
          )}
          <h2 className="mt-4 text-4xl font-bold">{confirmation.message}</h2>
          {confirmation.details && <p className="mt-2 text-lg">{confirmation.details}</p>}
        </div>
      )}
    </>
  );
}
