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
  const [operatorCounts, setOperatorCounts] = useState<Record<string, number>>({});
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

  // Listen to users to count assigned operators per PDV
  useEffect(() => {
    if (!firestore) return;
    const usersCollection = collection(firestore, 'users');

    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const pId = data.pdvId || data.pdv_id;
        if (pId) {
          counts[pId] = (counts[pId] || 0) + 1;
        }
      });
      setOperatorCounts(counts);
    }, (error) => {
      console.error("Error fetching users for operator counts:", error);
    });

    return () => unsubscribe();
  }, [firestore]);

  // Filter PDVs strictly by active tenant & event
  const pdvs = (allPdvs || []).filter((p) => {
    if (!currentTenant) return false;
    if (p.tenant_id !== currentTenant.id) return false;
    if (currentEvent) {
      return p.event_id === currentEvent.id;
    }
    return !p.event_id;
  });

  // Automatically select assigned PDV for PDV role
  useEffect(() => {
    if (!user || allPdvs === null) {
      setIsLoading(true);
      return;
    }

    if (user.role === 'PDV' && user.pdvId) {
      const assignedPdv = (allPdvs || []).find((p) => p.id === user.pdvId);
      if (assignedPdv) {
        setSelectedPdv(assignedPdv);
      }
    }

    setIsLoading(false);
  }, [user, allPdvs, user?.pdvId, user?.role]);

  // Keep selectedPdv in sync with fresh updates from allPdvs
  useEffect(() => {
    if (selectedPdv && allPdvs) {
      const fresh = allPdvs.find((p) => p.id === selectedPdv.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedPdv)) {
        setSelectedPdv(fresh);
      }
    }
  }, [allPdvs, selectedPdv]);

  // Reset selected PDV if it does not belong to the active tenant/event (only for admin roles)
  useEffect(() => {
    if (user?.role !== 'PDV' && selectedPdv) {
      if (currentTenant && selectedPdv.tenant_id && selectedPdv.tenant_id !== currentTenant.id) {
        setSelectedPdv(null);
      }
      if (currentEvent && selectedPdv.event_id && selectedPdv.event_id !== currentEvent.id) {
        setSelectedPdv(null);
      }
    }
  }, [currentTenant, currentEvent, selectedPdv, user?.role]);

  const handlePdvSelect = (pdv: Pdv) => {
    setSelectedPdv(pdv);
  };

  const handleGoBack = () => {
    // Only admin-level roles can go back to the selector
    if (['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '')) {
      setSelectedPdv(null);
    }
  };

  if (isLoading) {
    return <FullPageLoader />;
  }

  // If a PDV is assigned to user or chosen by admin, show terminal
  if (selectedPdv) {
    const canChangePdv = ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '');
    return <SaleTerminal pdv={selectedPdv} onGoBack={canChangePdv ? handleGoBack : undefined} />;
  }

  // Otherwise, show the selector (for admins or unassigned PDVs)
  return <PdvSelector pdvs={pdvs} operatorCounts={operatorCounts} onPdvSelect={handlePdvSelect} />;
}
