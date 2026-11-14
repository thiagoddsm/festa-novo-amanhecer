'use client';

import React, { use } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import CustomerWalletApp from '@/components/public/CustomerWalletApp';

export default function ShortCardLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  let decodedCode = code;
  try {
    decodedCode = decodeURIComponent(code);
  } catch {
    decodedCode = code;
  }

  return (
    <FirebaseClientProvider>
      <CustomerWalletApp initialCode={decodedCode} />
    </FirebaseClientProvider>
  );
}
