'use client';

import React, { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createCard } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import Image from 'next/image';

const initialState = {
  status: 'idle' as 'idle' |'success' | 'error',
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

// This component is only visible when printing
const PrintableCard = React.forwardRef<HTMLDivElement, { card: CardType | null }>(({ card }, ref) => {
    if (!card) return null;

    return (
        <div ref={ref} className="print-only">
             <div className="printable-card">
                <div className="flex justify-center items-center mb-2">
                    <h3 className='text-lg font-bold ml-1 text-black'>FestaPay</h3>
                </div>
                {card.nome_cliente && (
                    <div className='mb-2 text-center'>
                        <p className="text-xs font-medium text-gray-600">Cliente</p>
                        <p className="text-sm font-semibold text-black flex items-center justify-center gap-1">
                            <User className='h-3 w-3' /> {card.nome_cliente}
                        </p>
                    </div>
                )}
                <div className="flex justify-center my-2">
                    <QRCode value={card.qr_code_id} size={80} />
                </div>
                <p className="text-xs font-mono text-gray-700">ID: {card.qr_code_id}</p>
                <p className="mt-2 text-xs font-medium text-gray-600">Saldo Inicial</p>
                <p className="text-xl font-bold text-black">
                {formatCurrency(card.saldo_centavos ?? 0)}
                </p>
            </div>
        </div>
    );
});
PrintableCard.displayName = 'PrintableCard';


export default function CreateCardForm() {
  const [state, formAction] = useActionState(createCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState<CardType | null>(null);

  const handlePrint = () => {
    window.print();
  };
  
  const resetForm = () => {
      setNewCard(null);
      formRef.current?.reset();
      // Reset the action state if possible, or handle UI reset logic here
  }

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
      setNewCard(null);
    }
    if (state.status === 'success' && state.data) {
      setNewCard(state.data);
      setDialogOpen(true); // Open dialog for confirmation
      formRef.current?.reset();
      // The printing will be triggered by the user from the UI
      // but we will trigger it automatically here.
      // Small delay to ensure the state is set and the printable component is rendered.
      setTimeout(() => {
          handlePrint();
      }, 100);
    }
  }, [state, toast]);

  return (
    <>
      <PrintableCard card={newCard} ref={printableRef} />
      
      <Card className="screen-only">
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
        {newCard && (
            <CardFooter className="flex-col items-stretch gap-2 border-t pt-4">
                <p className="text-sm text-center text-muted-foreground">Cartão para <span className="font-bold text-primary">{newCard.nome_cliente || 'cliente'}</span> criado!</p>
                 <Button variant="secondary" onClick={resetForm}>
                    Criar Novo Cartão
                </Button>
            </CardFooter>
        )}
      </Card>
      
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <QrCode /> Cartão Criado com Sucesso!
            </AlertDialogTitle>
            <AlertDialogDescription>
              O comprovante será impresso automaticamente. Você pode fechar esta janela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}>
                Fechar
              </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
