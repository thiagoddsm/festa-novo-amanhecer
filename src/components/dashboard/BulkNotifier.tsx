'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendBulkNotification } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
      Enviar para Todos
    </Button>
  );
}

export default function BulkNotifier() {
  const [state, formAction] = useActionState(sendBulkNotification, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state.status === 'idle') return;

    toast({
      title: state.status === 'success' ? 'Sucesso!' : 'Erro!',
      description: state.message,
      variant: state.status === 'success' ? 'default' : 'destructive',
      duration: state.status === 'success' ? 9000 : 5000,
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
            Notificar Participantes
        </CardTitle>
        <CardDescription>
          Envie uma mensagem via WhatsApp para todos os participantes com cartões cadastrados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Digite sua mensagem aqui. Ela será enviada para todos os participantes."
              required
              rows={5}
            />
          </div>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
