'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { useTenant } from '@/hooks/use-tenant-context';
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
import { formatCurrency, buildCardAppUrl } from '@/lib/utils';
import { Loader2, QrCode } from 'lucide-react';
import type { Card as CardType } from '@/lib/definitions';
import { toDataURL as generateQrCodeDataUrl } from 'qrcode';
import { notifyCardCreation } from '@/lib/flows/notify-flow';
import { sanitizeSlug, formatWhatsAppNumber } from '@/lib/whatsapp';


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
  const { currentTenant, currentEvent } = useTenant();
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
      const qrPayload = buildCardAppUrl(card.qr_code_id, 'https://festanovoamanhecer.com.br');
      // Generate QR code data URL asynchronously
      const qrCodeDataUrl = await generateQrCodeDataUrl(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 148,
      });

      // Now write the content to the opened window
      printWindow.document.write(`
        <html>
          <head>
            <title>FestaPay - Cartão de Consumo</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap');
              @page { 
                size: auto;
                margin: 0mm; 
              }
              body { 
                font-family: 'Inter', Arial, sans-serif;
                color: #000;
                margin: 0; 
                padding: 8px 4px;
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: flex-start; 
                text-align: center;
              }
              .content {
                text-align: center;
                break-inside: avoid;
                width: 100%;
                max-width: 240px;
              }
              .event-header {
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                line-height: 1.2;
              }
              .event-sub {
                font-size: 10px;
                font-weight: 600;
                margin-bottom: 6px;
                padding-bottom: 5px;
                border-bottom: 1.5px solid #000;
              }
              .client-name {
                font-size: 16px;
                font-weight: 800;
                margin: 6px 0 4px 0;
                line-height: 1.2;
              }
              .qr-img {
                display: block;
                margin: 0 auto;
              }
              .qr-id {
                font-family: monospace;
                font-size: 9.5px;
                font-weight: 600;
                margin-top: 2px;
              }
              .balance-box {
                margin: 6px 0;
                padding: 4px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }
              .balance-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
              }
              .balance-value {
                font-size: 20px;
                font-weight: 800;
                line-height: 1.15;
              }
              .section-box {
                text-align: left;
                margin-top: 6px;
                padding: 5px 6px;
                border: 1px solid #000;
                border-radius: 6px;
              }
              .section-title {
                font-size: 10px;
                font-weight: 800;
                text-transform: uppercase;
                text-align: center;
                margin-bottom: 3px;
                padding-bottom: 2px;
                border-bottom: 1px dotted #000;
              }
              .section-list {
                margin: 0;
                padding: 0;
                list-style: none;
                font-size: 9.5px;
                font-weight: 600;
                line-height: 1.35;
              }
              .section-list li {
                margin-top: 2px;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="content">
              <div class="event-header">Festa Novo Amanhecer 2026</div>
              <div class="event-sub">Cartão de Consumo • FestaPay</div>

              ${card.nome_cliente ? `<div class="client-name">${card.nome_cliente}</div>` : ''}
              <img class="qr-img" src="${qrCodeDataUrl}" alt="QR Code" />
              <div class="qr-id">${card.qr_code_id}</div>

              <div class="balance-box">
                <div class="balance-label">Saldo Inicial</div>
                <div class="balance-value">${formatCurrency(card.saldo_centavos ?? 0)}</div>
              </div>

              <div class="section-box">
                <div class="section-title">1. Como usar este papel</div>
                <ul class="section-list">
                  <li>• <strong>Nas Barracas:</strong> apresente este QR Code para comprar.</li>
                  <li>• <strong>No Caixa:</strong> apresente para recarregar ou consultar saldo.</li>
                </ul>
              </div>

              <div class="section-box">
                <div class="section-title">2. Use também pelo Celular</div>
                <ul class="section-list">
                  <li>Aponte a câmera do celular para este QR Code para:</li>
                  <li>✓ Conferir seu <strong>Saldo</strong> ao vivo</li>
                  <li>✓ Ver seu <strong>Extrato</strong> de compras/recargas</li>
                  <li>✓ Acompanhar <strong>Pedidos</strong> na fila</li>
                  <li>✓ Acessar seu <strong>QR Code Digital</strong></li>
                </ul>
              </div>
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
        const normalizedPhone = formatWhatsAppNumber(telefone_cliente);
        const saldo_centavos = saldo_inicial * 100;
        const eventSlug = currentEvent?.name ? sanitizeSlug(currentEvent.name, 18) : 'festa-2026';
        const qr_code_id = `${eventSlug}-${generateRandomId().slice(0, 16)}`;
        const now = Timestamp.now();

        const cardData: Record<string, any> = {
            qr_code_id,
            saldo_centavos,
            nome_cliente: nome_cliente ?? '',
            telefone_cliente: normalizedPhone,
            status: 'ATIVO' as const,
            created_at: now,
            updated_at: now,
            tenant_id: currentTenant?.id ?? null,
            event_id: currentEvent?.id ?? null,
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
                tenant_id: currentTenant?.id ?? null,
                event_id: currentEvent?.id ?? null,
            });
        }
        
        await batch.commit();

        const createdCard = { id: cardDocRef.id, ...cardData } as unknown as CardType;
        setNewCard(createdCard);
        setDialogOpen(true);
        formRef.current?.reset();
        
        // Delay print slightly
        setTimeout(() => handlePrint(createdCard as CardType), 100);

        // Trigger WhatsApp welcome notification with QR Code
        if (telefone_cliente) {
          notifyCardCreation(cardDocRef.id).catch((err) => {
            console.error('Falha ao disparar boas-vindas do WhatsApp:', err);
          });
        }

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
      <Card className="screen-only w-full min-w-0">
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
              <Label htmlFor="telefone_cliente" className="font-semibold text-sm">
                WhatsApp do Cliente (DDD + Número)
              </Label>
              <Input
                id="telefone_cliente"
                name="telefone_cliente"
                type="tel"
                placeholder="Ex: (11) 99999-8888"
                required
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-green-700 font-medium flex items-start gap-1.5 leading-tight">
                <span className="shrink-0">📲</span>
                <span>O cliente recebe o QR Code e comprovante direto no WhatsApp!</span>
              </p>
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
                className="h-10 text-sm"
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
