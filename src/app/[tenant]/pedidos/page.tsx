'use client';

import { Suspense, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase';
import PublicOrderTracker from '@/components/public/PublicOrderTracker';
import { Loader2 } from 'lucide-react';

interface TenantPedidosPageProps {
  params: Promise<{ tenant: string }>;
}

function TenantPedidosContent({
  tenantPromise,
}: {
  tenantPromise: Promise<{ tenant: string }>;
}) {
  const { tenant } = use(tenantPromise);
  const searchParams = useSearchParams();
  const event = searchParams.get('event') || searchParams.get('evento');
  const pdv = searchParams.get('pdv');
  const busca = searchParams.get('busca') || searchParams.get('senha');

  return (
    <PublicOrderTracker
      tenantId={tenant}
      eventId={event}
      initialPdvId={pdv}
      initialQuery={busca}
      basePath={`/${tenant}/pedidos`}
    />
  );
}

export default function TenantPedidosPage({ params }: TenantPedidosPageProps) {
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
        <TenantPedidosContent tenantPromise={params} />
      </Suspense>
    </FirebaseClientProvider>
  );
}
