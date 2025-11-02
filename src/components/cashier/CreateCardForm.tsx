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
import { toDataURL as generateQrCodeDataUrl } from 'qrcode';


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

export default function CreateCardForm() {
  const [state, formAction] = useActionState(createCard, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState<CardType | null>(null);

  const handlePrint = async (card: CardType) => {
    // Open the window immediately on user action to avoid popup blockers
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: 'destructive',
        title: 'Erro de Impressão',
        description: 'Não foi possível abrir a janela de impressão. Verifique se os pop-ups estão bloqueados.',
      });
      return;
    }

    try {
      // Generate QR code data URL asynchronously
      const qrCodeDataUrl = await generateQrCodeDataUrl(card.qr_code_id, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 128,
      });

      // Now write the content to the opened window
      printWindow.document.write(`
        <html>
          <head>
            <title>FestaPay - Comprovante</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              @page { 
                size: auto;
                margin: 0mm; 
              }
              body { 
                font-family: 'Inter', sans-serif;
                margin: 0; 
                padding: 0;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center; 
                text-align: center;
                height: 100vh;
              }
              .content {
                text-align: center;
                break-inside: avoid;
              }
              .qr-id {
                font-family: monospace;
                font-size: 10px;
                margin-top: 4px;
              }
              .client-name {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 6px;
              }
              .balance-label {
                 font-size: 12px;
                 font-weight: 500;
                 margin-top: 6px;
              }
              .balance-value {
                font-size: 20px;
                font-weight: 700;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="content">
              ${card.nome_cliente ? `<div class="client-name">${card.nome_cliente}</div>` : ''}
              <img src="${qrCodeDataUrl}" alt="QR Code" />
              <div class="qr-id">${card.qr_code_id}</div>
              <div class="balance-label">Saldo Inicial</div>
              <div class="balance-value">${formatCurrency(card.saldo_centavos ?? 0)}</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (err) {
       console.error("Failed to generate QR code for printing:", err);
       toast({
         variant: 'destructive',
         title: 'Erro de QR Code',
         description: 'Não foi possível gerar a imagem do QR code para impressão.',
       });
       printWindow.close(); // Close the window on error
    }
  };
  
  const resetForm = () => {
      setNewCard(null);
      formRef.current?.reset();
  }

  useEffect(() => {
    if (!state) return;
    if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar cartão',
        description: state.message,
      });
      setNewCard(null);
    }
    if (state.status === 'success' && state.data) {
      const cardData = state.data as CardType;
      setNewCard(cardData);
      setDialogOpen(true);
      formRef.current?.reset();
      
      // Delay to allow state to update before printing
      setTimeout(() => {
          handlePrint(cardData);
      }, 100);
    }
  }, [state, toast]);

  return (
    <>
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
              <Label htmlFor="telefone_cliente">Telefone (para notificações via WhatsApp)</Label>
              <Input
                id="telefone_cliente"
                name="telefone_cliente"
                placeholder="Ex: 5511999998888"
                required
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
              O comprovante foi enviado para a impressão. Você pode fechar esta janela.
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
