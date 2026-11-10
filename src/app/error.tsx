'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function clearLocalSelection() {
  try {
    localStorage.removeItem('festapay_tenant_id');
    localStorage.removeItem('festapay_event_id');
    localStorage.removeItem('festapay_camera_id');
  } catch {
    // ignore storage access errors
  }
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FestaPay] Erro de renderização:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold">Algo deu errado</h2>
        <p className="text-sm text-muted-foreground">
          Ocorreu um erro ao exibir esta tela. Se estiver usando a tradução automática do navegador, desative-a para este site.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              clearLocalSelection();
              window.location.reload();
            }}
          >
            <Trash2 className="h-4 w-4" /> Limpar seleção e recarregar
          </Button>
        </div>
      </div>
    </div>
  );
}
