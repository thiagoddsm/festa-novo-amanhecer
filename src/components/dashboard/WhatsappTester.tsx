'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendTestWhatsappMessage } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import type { ActionState } from '@/lib/actions';


const initialState: ActionState = {
  status: 'idle',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Enviar Teste
    </Button>
  );
}

export default function WhatsappTester() {
  const [state, formAction] = useActionState(sendTestWhatsappMessage, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state.status === 'idle') return;

    toast({
      title: state.status === 'success' ? 'Sucesso!' : 'Erro!',
      description: state.message,
      variant: state.status === 'success' ? 'default' : 'destructive',
    });

    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
            <MessageSquare />
            Testar Notificações
        </CardTitle>
        <CardDescription>
          Envie uma mensagem de teste para verificar se a integração com o WhatsApp está funcionando.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefone_destinatario">Número do WhatsApp</Label>
            <Input
              id="telefone_destinatario"
              name="telefone_destinatario"
              placeholder="Ex: 5511999998888"
              required
            />
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
