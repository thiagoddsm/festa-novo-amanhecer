'use client';

import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase';
import PublicOrderTracker from '@/components/public/PublicOrderTracker';
import { Loader2 } from 'lucide-react';

interface TenantEventPedidosPageProps {
  params: Promise<{ tenant: string; event: string }>;
}

function TenantEventPedidosContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ tenant: string; event: string }>;
}) {
  const { tenant, event } = use(paramsPromise);
  const searchParams = useSearchParams();
  const pdv = searchParams.get('pdv');
  const busca = searchParams.get('busca') || searchParams.get('senha');

  return (
    <PublicOrderTracker
      tenantId={tenant}
      eventId={event}
      initialPdvId={pdv}
      initialQuery={busca}
      basePath={`/${tenant}/${event}/pedidos`}
    />
  );
}

export default function TenantEventPedidosPage({ params }: TenantEventPedidosPageProps) {
  return (
    <FirebaseClientProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
            <p className="text-sm font-semibold">Carregando barracas da festa...</p>
          </div>
        }
      >
        <TenantEventPedidosContent paramsPromise={params} />
      </Suspense>
    </FirebaseClientProvider>
  );
}
