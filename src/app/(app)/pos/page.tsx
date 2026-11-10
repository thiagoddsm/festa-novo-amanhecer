'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  const hasAutoSelectedRef = useRef(false);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    const pdvCollection = collection(firestore, 'pdvs');
    const q = query(pdvCollection, orderBy('nome', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Pdv));
        setAllPdvs(fetched);
      },
      (error) => {
        console.error('Error fetching PDVs:', error);
        setAllPdvs([]);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  // Listen to users to count assigned operators per PDV
  useEffect(() => {
    if (!firestore) return;
    const usersCollection = collection(firestore, 'users');

    const unsubscribe = onSnapshot(
      usersCollection,
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const pIds: string[] =
            Array.isArray(data.pdvIds) && data.pdvIds.length > 0
              ? data.pdvIds
              : data.pdvId || data.pdv_id
              ? [data.pdvId || data.pdv_id]
              : [];
          pIds.forEach((pId) => {
            if (pId) {
              counts[pId] = (counts[pId] || 0) + 1;
            }
          });
        });
        setOperatorCounts(counts);
      },
      (error) => {
        console.error('Error fetching users for operator counts:', error);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  // Assigned PDV IDs for PDV operator role
  const userPdvIds = useMemo(() => {
    if (!user) return [];
    if (user.pdvIds && user.pdvIds.length > 0) return user.pdvIds;
    if (user.pdvId) return [user.pdvId];
    return [];
  }, [user]);

  // Filter PDVs: for PDV role, show their assigned PDVs; for admins, filter by active tenant & event
  const pdvs = useMemo(() => {
    const list = allPdvs || [];
    if (user?.role === 'PDV') {
      return list.filter((p) => userPdvIds.includes(p.id));
    }
    return list.filter((p) => {
      if (!currentTenant) return false;
      if (p.tenant_id !== currentTenant.id) return false;
      if (currentEvent) {
        return p.event_id === currentEvent.id;
      }
      return !p.event_id;
    });
  }, [allPdvs, user?.role, userPdvIds, currentTenant, currentEvent]);

  // Automatically select assigned PDV for PDV role on initial load
  useEffect(() => {
    if (!user || allPdvs === null) {
      setIsLoading(true);
      return;
    }

    if (user.role === 'PDV' && userPdvIds.length > 0 && !hasAutoSelectedRef.current) {
      const savedPdvId =
        typeof window !== 'undefined' ? localStorage.getItem('festapay_selected_pdv_id') : null;
      const targetId =
        savedPdvId && userPdvIds.includes(savedPdvId) ? savedPdvId : userPdvIds[0];
      const assignedPdv = allPdvs.find((p) => p.id === targetId) || allPdvs.find((p) => userPdvIds.includes(p.id));
      if (assignedPdv) {
        setSelectedPdv(assignedPdv);
        hasAutoSelectedRef.current = true;
      }
    }

    setIsLoading(false);
  }, [user, allPdvs, userPdvIds]);

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
    if (typeof window !== 'undefined') {
      localStorage.setItem('festapay_selected_pdv_id', pdv.id);
    }
  };

  const canChangePdv =
    ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'].includes(user?.role ?? '') ||
    (user?.role === 'PDV' && pdvs.length > 1);

  const handleGoBack = () => {
    if (canChangePdv) {
      setSelectedPdv(null);
    }
  };

  if (isLoading) {
    return <FullPageLoader />;
  }

  // If a PDV is assigned to user or chosen by admin, show terminal
  if (selectedPdv) {
    return (
      <SaleTerminal
        pdv={selectedPdv}
        onGoBack={canChangePdv ? handleGoBack : undefined}
        allowedPdvs={user?.role === 'PDV' && pdvs.length > 1 ? pdvs : undefined}
        onSwitchPdv={canChangePdv ? handlePdvSelect : undefined}
      />
    );
  }

  // Otherwise, show the selector (for admins, multi-PDV operators switching, or unassigned PDVs)
  return <PdvSelector pdvs={pdvs} operatorCounts={operatorCounts} onPdvSelect={handlePdvSelect} />;
}
