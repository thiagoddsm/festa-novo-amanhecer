'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sendCardCreationNotification } from '@/lib/flows/notification-service';
import type { Card } from '@/lib/definitions';
import { Loader2, Send } from 'lucide-react';

export default function ResendQrWhatsappButton({ card }: { card: Card }) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    if (!card.telefone_cliente?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Telefone não cadastrado',
        description: 'Este cartão não possui número de WhatsApp cadastrado para envio.',
      });
      return;
    }

    setIsSending(true);
    try {
      const res = await sendCardCreationNotification(card.id);
      if (res.success) {
        toast({
          title: 'QR Code Reenviado!',
          description: `Enviado via WhatsApp para ${card.telefone_cliente}${res.instanceUsed ? ` (${res.instanceUsed})` : ''}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao reenviar QR Code',
          description: res.error || 'Não foi possível enviar a mensagem pelo WhatsApp.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar',
        description: err instanceof Error ? err.message : 'Erro inesperado ao enviar QR Code.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleResend}
      disabled={isSending}
      title={card.telefone_cliente ? `Reenviar QR Code para ${card.telefone_cliente}` : 'Cartão sem telefone cadastrado'}
    >
      {isSending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {isSending ? 'Enviando...' : 'Reenviar QR Code'}
    </Button>
  );
}
