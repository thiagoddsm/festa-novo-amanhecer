'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { generateSummary } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

const initialState = {
  status: 'success' as 'success' | 'error',
  message: '',
  data: { summary: '' },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar Resumo com IA
        </>
      )}
    </Button>
  );
}

export default function AiSummary() {
  const [state, formAction] = useActionState(generateSummary, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo de Vendas por IA</CardTitle>
        <CardDescription>
          Use IA para analisar os dados de vendas e obter insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction}>
          <SubmitButton />
        </form>
        {state.data?.summary && (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/50 p-4">
            <p className="whitespace-pre-wrap font-sans">{state.data.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
