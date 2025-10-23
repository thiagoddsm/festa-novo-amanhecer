'use client';

import { useState, useEffect } from 'react';
import PdvSelector from '@/components/pos/PdvSelector';
import SaleTerminal from '@/components/pos/SaleTerminal';
import type { Pdv } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function PosPage() {
  const [selectedPdv, setSelectedPdv] = useState<Pdv | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const pdvCollection = collection(firestore, 'pdvs');
    const q = query(pdvCollection, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPdvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
      setPdvs(allPdvs);
    });

    return () => unsubscribe();
  }, [firestore]);


  const handlePdvSelect = (pdv: Pdv) => {
    setSelectedPdv(pdv);
  };

  const handleGoBack = () => {
    setSelectedPdv(null);
  }

  if (!selectedPdv) {
    return <PdvSelector pdvs={pdvs} onPdvSelect={handlePdvSelect} />;
  }

  return <SaleTerminal pdv={selectedPdv} onGoBack={handleGoBack} />;
}
