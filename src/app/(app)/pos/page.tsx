'use client';

import { useState } from 'react';
import PdvSelector from '@/components/pos/PdvSelector';
import SaleTerminal from '@/components/pos/SaleTerminal';
import type { Pdv } from '@/lib/definitions';

export default function PosPage() {
  const [selectedPdv, setSelectedPdv] = useState<Pdv | null>(null);

  const handlePdvSelect = (pdv: Pdv) => {
    setSelectedPdv(pdv);
  };

  const handleGoBack = () => {
    setSelectedPdv(null);
  }

  if (!selectedPdv) {
    return <PdvSelector onPdvSelect={handlePdvSelect} />;
  }

  return <SaleTerminal pdv={selectedPdv} onGoBack={handleGoBack} />;
}
