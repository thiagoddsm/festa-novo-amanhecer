'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { transferBalance } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, QrCode, ArrowRightLeft } from 'lucide-react';
import QrScannerDialog from '../common/QrScannerDialog';
import { useAuth } from '@/hooks/use-auth-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { formatCurrency } from '@/lib/utils';

const initialState = {
  status: 'idle' as 'idle' | 'success' | 'error',
  message: '',
  data: null as any,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Confirmar Transferência'}
    </Button>
  );
}

export default function TransferBalanceForm() {
  const { user } = useAuth();
  const [state, formAction] = useActionState(transferBalance, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [originQr, setOriginQr] = useState('');
  const [destQr, setDestQr] = useState('');

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'origin' | 'destination' | null>(null);

  useEffect(() => {
    if (!state || state.status === 'idle') return;

    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro na Transferência',
        description: state.message,
      });
    } else if (state.status === 'success') {
      const amount = state.data?.amountTransferred ?? 0;
      toast({
        title: 'Sucesso!',
        description: `Transferência de ${formatCurrency(amount)} realizada com sucesso!`,
      });
      formRef.current?.reset();
      setOriginQr('');
      setDestQr('');
    }
  }, [state, toast]);

  const openScanner = (target: 'origin' | 'destination') => {
    setScannerTarget(target);
    setIsScannerOpen(true);
  };

  const handleScan = (data: string) => {
    if (scannerTarget === 'origin') {
      setOriginQr(data);
    } else if (scannerTarget === 'destination') {
      setDestQr(data);
    }
    setIsScannerOpen(false);
    setScannerTarget(null);
  };

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
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="usuario_responsavel" value={user?.name || 'Sistema'} />
            
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
               {state.data?.origin_qr_code_id && <AlertDescription className="text-destructive text-xs">{state.data.origin_qr_code_id[0]}</AlertDescription>}
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
               {state.data?.destination_qr_code_id && <AlertDescription className="text-destructive text-xs">{state.data.destination_qr_code_id[0]}</AlertDescription>}
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
               {state.data?.valor_transferencia && <AlertDescription className="text-destructive text-xs">{state.data.valor_transferencia[0]}</AlertDescription>}
            </div>

            <SubmitButton />
          </form>
        </CardContent>
         {state.status === 'success' && state.data?.amountTransferred && (
            <CardFooter>
                 <Alert>
                    <AlertTitle>Transferência Concluída</AlertTitle>
                    <AlertDescription>
                        O valor de {formatCurrency(state.data.amountTransferred)} foi transferido.
                    </AlertDescription>
                </Alert>
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
