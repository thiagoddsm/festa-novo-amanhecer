'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createCard } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/utils';
import { QrCode, Loader2, User, Printer } from 'lucide-react';
import type { Card as CardType } from '@/lib/definitions';
import QRCode from 'react-qr-code';
import { useReactToPrint } from 'react-to-print';


const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Criar Novo Cartão'}
    </Button>
  );
}

const PrintableCard = React.forwardRef<HTMLDivElement, { card: CardType | null }>(({ card }, ref) => {
    if (!card) return null;

    return (
        <div ref={ref} className="my-4 rounded-lg border bg-white p-6 text-center text-black">
             <div className="flex justify-center items-center mb-4">
                <QrCode className="h-8 w-8 text-primary" />
                <h3 className='text-xl font-bold ml-2'>FestaPay</h3>
            </div>
            {card.nome_cliente && (
                <div className='mb-4'>
                    <p className="text-sm font-medium text-gray-500">Cliente</p>
                    <p className="flex items-center justify-center gap-2 text-lg font-semibold">
                        <User className='h-4 w-4' /> {card.nome_cliente}
                    </p>
                </div>
            )}
            <div className="flex justify-center my-4">
                <QRCode value={card.qr_code_id} size={128} />
            </div>
            <p className="text-xs font-medium text-gray-500">ID: {card.qr_code_id}</p>
            <p className="mt-4 text-sm font-medium text-gray-500">Saldo Inicial</p>
            <p className="text-2xl font-bold">
              {formatCurrency(card.saldo_centavos ?? 0)}
            </p>
        </div>
    );
});
PrintableCard.displayName = "PrintableCard";


export default function CreateCardForm() {
  const [state, formAction] = useActionState(createCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState<CardType | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
      content: () => printableRef.current,
  });

  useEffect(() => {
    if (!state) {
      return;
    }
    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar cartão',
        description: state.message,
      });
    }
    if (state.status === 'success' && state.message) {
      setNewCard(state.data);
      setDialogOpen(true);
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Novo Cartão</CardTitle>
          <CardDescription>
            Crie e ative um novo cartão cashless com um saldo inicial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome_cliente">Nome do Cliente (Opcional)</Label>
              <Input
                id="nome_cliente"
                name="nome_cliente"
                placeholder="Ex: João da Silva"
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="telefone_cliente">Telefone (Opcional)</Label>
              <Input
                id="telefone_cliente"
                name="telefone_cliente"
                placeholder="Ex: (11) 99999-8888"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo_inicial">Saldo Inicial (R$)</Label>
              <Input
                id="saldo_inicial"
                name="saldo_inicial"
                type="number"
                placeholder="Ex: 50.00"
                step="0.01"
                required
              />
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <QrCode /> Cartão Criado com Sucesso!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Entregue o QR Code ao cliente ou imprima o comprovante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <PrintableCard card={newCard} ref={printableRef} />
          
          <AlertDialogFooter className='sm:justify-between gap-2'>
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2" />
                Imprimir / Salvar PDF
            </Button>
            <AlertDialogAction onClick={() => setDialogOpen(false)}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
