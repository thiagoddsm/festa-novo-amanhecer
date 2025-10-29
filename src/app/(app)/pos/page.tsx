'use client';

import { useState, useEffect } from 'react';
import PdvSelector from '@/components/pos/PdvSelector';
import SaleTerminal from '@/components/pos/SaleTerminal';
import type { Pdv } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { FullPageLoader } from '@/components/ui/loader';

export default function PosPage() {
  const { user } = useAuth();
  const [selectedPdv, setSelectedPdv] = useState<Pdv | null>(null);
  const [pdvs, setPdvs] = useState<Pdv[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const pdvCollection = collection(firestore, 'pdvs');
    const q = query(pdvCollection, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPdvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
      setPdvs(allPdvs);
    }, (error) => {
      console.error("Error fetching PDVs:", error);
      setPdvs([]);
    });

    return () => unsubscribe();
  }, [firestore]);

  useEffect(() => {
    if (pdvs === null || !user) {
        // Still waiting for data
        return;
    }

    if (user.role === 'PDV' && user.pdvId) {
        const assignedPdv = pdvs.find(p => p.id === user.pdvId);
        if (assignedPdv) {
            setSelectedPdv(assignedPdv);
        }
    }
    // For ADMIN or PDV without assigned pdvId, we let them choose.
    setIsLoading(false);

  }, [user, pdvs]);


  const handlePdvSelect = (pdv: Pdv) => {
    setSelectedPdv(pdv);
  };

  const handleGoBack = () => {
    // Only ADMINs should be able to go back to selector
    if (user?.role === 'ADMIN') {
        setSelectedPdv(null);
    }
  }
  
  if (isLoading) {
    return <FullPageLoader />
  }

  if (selectedPdv) {
    return <SaleTerminal pdv={selectedPdv} onGoBack={handleGoBack} />;
  }
  
  // Only show selector if no PDV is selected (for ADMINS or unassigned PDVs)
  return <PdvSelector pdvs={pdvs} onPdvSelect={handlePdvSelect} />;
}
