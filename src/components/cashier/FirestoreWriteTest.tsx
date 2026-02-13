'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { testFirestoreWrite } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TestTube } from 'lucide-react';

const initialState = {
  status: 'idle' as 'idle' | 'success' | 'error',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin" /> : 'Executar Teste de Escrita'}
    </Button>
  );
}

export default function FirestoreWriteTest() {
  const [state, formAction] = useActionState(testFirestoreWrite, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state || state.status === 'idle') return;

    toast({
      title: state.status === 'success' ? 'Sucesso!' : 'Erro no Teste!',
      description: state.message,
      variant: state.status === 'success' ? 'default' : 'destructive',
    });
    
  }, [state, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <TestTube />
            Teste de Conexão
        </CardTitle>
        <CardDescription>
          Clique para realizar um teste de escrita simples no banco de dados e verificar a conexão do servidor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
            <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
