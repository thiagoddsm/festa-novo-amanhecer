'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase';
import CustomerWalletApp from '@/components/public/CustomerWalletApp';
import { Loader2 } from 'lucide-react';

function MeuCartaoContent() {
  const searchParams = useSearchParams();
  const code =
    searchParams.get('c') ||
    searchParams.get('card') ||
    searchParams.get('code') ||
    searchParams.get('qr');
  const tel = searchParams.get('tel') || searchParams.get('telefone');

  return <CustomerWalletApp initialCode={code} initialPhone={tel} />;
}

export default function MeuCartaoPage() {
  return (
    <FirebaseClientProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center text-slate-800 gap-3 p-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-700" />
            <p className="text-lg font-extrabold">Abrindo Meu Cartão da Festa...</p>
          </div>
        }
      >
        <MeuCartaoContent />
      </Suspense>
    </FirebaseClientProvider>
  );
}
