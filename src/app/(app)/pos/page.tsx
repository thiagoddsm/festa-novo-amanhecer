'use client';

import { useState, useEffect } from 'react';
import PdvSelector from '@/components/pos/PdvSelector';
import SaleTerminal from '@/components/pos/SaleTerminal';
import type { Pdv } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/use-auth-context';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { FullPageLoader } from '@/components/ui/loader';

import { useTenant } from '@/hooks/use-tenant-context';

export default function PosPage() {
  const { user } = useAuth();
  const { currentTenant, currentEvent } = useTenant();
  const [selectedPdv, setSelectedPdv] = useState<Pdv | null>(null);
  const [allPdvs, setAllPdvs] = useState<Pdv[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const pdvCollection = collection(firestore, 'pdvs');
    const q = query(pdvCollection, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pdv));
      setAllPdvs(fetched);
    }, (error) => {
      console.error("Error fetching PDVs:", error);
      setAllPdvs([]);
    });

    return () => unsubscribe();
  }, [firestore]);

  // Filter PDVs by active tenant & event
  const pdvs = (allPdvs || []).filter((p) => {
    if (currentTenant && p.tenant_id !== currentTenant.id) return false;
    if (currentEvent && p.event_id !== currentEvent.id) return false;
    return true;
  });

  useEffect(() => {
    // Wait for both user and pdvs data to be loaded
    if (!user || allPdvs === null) {
      setIsLoading(true);
      return;
    }

    let pdvToSelect = null;
    if (user.role === 'PDV' && user.pdvId) {
      const assignedPdv = (allPdvs || []).find(p => p.id === user.pdvId);
      if (assignedPdv) {
        pdvToSelect = assignedPdv;
      }
    }
    
    // If a PDV was found for the user, select it.
    if (pdvToSelect) {
        setSelectedPdv(pdvToSelect);
    }
    
    // Loading is finished once we have user/pdv data and have checked for an assigned pdv.
    setIsLoading(false);

  }, [user, allPdvs]);

  // Reset selected PDV if it does not belong to the active tenant/event
  useEffect(() => {
    if (selectedPdv) {
      if (currentTenant && selectedPdv.tenant_id !== currentTenant.id) {
        setSelectedPdv(null);
      }
      if (currentEvent && selectedPdv.event_id !== currentEvent.id) {
        setSelectedPdv(null);
      }
    }
  }, [currentTenant, currentEvent, selectedPdv]);

  const handlePdvSelect = (pdv: Pdv) => {
    setSelectedPdv(pdv);
  };

  const handleGoBack = () => {
    // Only admin-level roles can go back to the selector
    if (['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '')) {
        setSelectedPdv(null);
    }
  }
  
  if (isLoading) {
    return <FullPageLoader />
  }

  // If a PDV is selected (either by role assignment or by admin choice), show the terminal.
  if (selectedPdv) {
    return <SaleTerminal pdv={selectedPdv} onGoBack={handleGoBack} />;
  }
  
  // Otherwise, show the selector (for ADMINS or unassigned PDVs).
  return <PdvSelector pdvs={pdvs} onPdvSelect={handlePdvSelect} />;
}
