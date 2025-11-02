'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getCardBalance } from '@/lib/actions';
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


const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
  data: null as CardType | null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Consultar Saldo'}
    </Button>
  );
}

export default function CheckBalanceForm() {
  const [state, formAction] = useActionState(getCardBalance, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [qrCodeId, setQrCodeId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (!state || !state.message) return;

    if (state.status === 'error' && state.message) {
      toast({
        variant: 'destructive',
        title: 'Erro na Consulta',
        description: state.message,
      });
    }
    
    // Reset form only on successful search
    if (state.status === 'success') {
      setQrCodeId('');
    }

  }, [state, toast]);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ATIVO':
        return 'secondary';
      case 'INATIVO':
        return 'outline';
      case 'BLOQUEADO':
        return 'destructive';
      default:
        return 'default';
    }
  }

  const handleScan = (data: string) => {
      setQrCodeId(data);
      setIsScannerOpen(false);
      // Automatically submit form after scanning
      setTimeout(() => {
          formRef.current?.requestSubmit();
      }, 100)
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
                <Button type='button' variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                    <QrCode className="h-4 w-4" />
                </Button>
            </div>
          </div>
          <SubmitButton />
        </form>
      </CardContent>
      {state?.status === 'success' && state.data && (
        <CardFooter className="flex flex-col items-start space-y-4 border-t px-6 py-4">
            <div className="flex w-full justify-between items-center">
                <h3 className="font-semibold text-lg">Detalhes do Cartão</h3>
                 <Badge variant={getStatusVariant(state.data.status)}>{state.data.status}</Badge>
            </div>
            {state.data.nome_cliente && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{state.data.nome_cliente}</span>
                </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                <span className="truncate">{state.data.qr_code_id}</span>
            </div>
            <div className="flex items-center gap-2 text-2xl font-bold text-primary">
                <Wallet className="h-6 w-6" />
                <span>{formatCurrency(state.data.saldo_centavos)}</span>
            </div>
        </CardFooter>
      )}
       {state?.status === 'error' && state.message && (
         <CardFooter className="flex flex-col items-center space-y-2 border-t px-6 py-4 text-center">
            <CircleAlert className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{state.message}</p>
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
