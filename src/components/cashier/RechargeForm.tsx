'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { rechargeCard } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Loader2, QrCode } from 'lucide-react';
import QrScannerDialog from '../common/QrScannerDialog';

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
  const [state, formAction] = useActionState(rechargeCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [qrCodeId, setQrCodeId] = useState('');


  useEffect(() => {
    if (!state || !state.message) return;

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
      setQrCodeId('');
    }
  }, [state, toast]);

  const handleScan = (data: string) => {
    setQrCodeId(data);
    setIsScannerOpen(false);
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
        <form ref={formRef} action={formAction} className="space-y-4">
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
          <SubmitButton />
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
