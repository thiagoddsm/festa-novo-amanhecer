'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFirestore, useAuth } from '@/firebase';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { generateRandomId } from '@/lib/data';
import { z } from 'zod';

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
import { Loader2 } from 'lucide-react';
import type { Card as CardType } from '@/lib/definitions';
import { toDataURL as generateQrCodeDataUrl } from 'qrcode';


// Schema for client-side validation
const CreateCardSchema = z.object({
  saldo_inicial: z.coerce.number().min(0, 'Valor deve ser positivo.'),
  nome_cliente: z.string().optional(),
  telefone_cliente: z.string().min(1, 'O telefone é obrigatório.'),
});


function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button type="submit" disabled={isPending} className="w-full">
      {isPending ? <Loader2 className="animate-spin" /> : 'Criar Novo Cartão'}
    </Button>
  );
}

export default function CreateCardForm() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [isPending, setIsPending] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado ou conexão indisponível.' });
        return;
    }
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const validatedFields = CreateCardSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errors)[0]?.[0] || 'Dados inválidos.';
      toast({ variant: 'destructive', title: 'Erro de Validação', description: firstError });
      setIsPending(false);
      return;
    }

    try {
        const { saldo_inicial, nome_cliente, telefone_cliente } = validatedFields.data;
        const saldo_centavos = saldo_inicial * 100;
        const qr_code_id = `festa-2025-${generateRandomId().slice(0, 18)}`;
        const now = Timestamp.now();

        const cardData = {
            qr_code_id,
            saldo_centavos,
            nome_cliente: nome_cliente ?? '',
            telefone_cliente: telefone_cliente ?? '',
            status: 'ATIVO' as const,
            created_at: now,
            updated_at: now,
        };

        const batch = writeBatch(firestore);

        const cardDocRef = doc(collection(firestore, "cards"));
        batch.set(cardDocRef, cardData);

        if (saldo_centavos > 0) {
            const transactionRef = doc(collection(firestore, "transactions"));
            batch.set(transactionRef, {
                cartao_id: cardDocRef.id,
                pdv_id: 'caixa_central',
                tipo: 'RECARGA' as const,
                valor_centavos: saldo_centavos,
                created_at: now,
                usuario_responsavel: user.name || 'Caixa',
            });
        }
        
        await batch.commit();

        const createdCard = { id: cardDocRef.id, ...cardData };
        setNewCard(createdCard);
        setDialogOpen(true);
        formRef.current?.reset();
        
        // Delay print slightly
        setTimeout(() => handlePrint(createdCard as CardType), 100);

        // TODO: Re-implement notification by calling a server action here.
        // For now, focusing on core functionality.

    } catch (error) {
        console.error("Client-side card creation failed:", error);
        const message = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
        toast({
            variant: 'destructive',
            title: 'Erro ao Criar Cartão',
            description: `A operação falhou no navegador. Verifique sua conexão e as permissões. Erro: ${message}`,
        });
    } finally {
        setIsPending(false);
    }
  }


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
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
            <SubmitButton isPending={isPending} />
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
