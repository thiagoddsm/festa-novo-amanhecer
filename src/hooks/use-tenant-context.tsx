'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './use-auth-context';
import type { Tenant, TenantEvent } from '@/lib/definitions';

type TenantContextType = {
  currentTenant: Tenant | null;
  currentEvent: TenantEvent | null;
  tenantsList: Tenant[];
  eventsList: TenantEvent[];
  setCurrentTenant: (tenant: Tenant | null) => void;
  setCurrentEvent: (event: TenantEvent | null) => void;
  isLoadingTenants: boolean;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const firestore = useFirestore();

  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [eventsList, setEventsList] = useState<TenantEvent[]>([]);
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [currentEvent, setCurrentEventState] = useState<TenantEvent | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);

  const userUid = user?.uid;
  const userRole = user?.role;
  const userEmail = user?.email;
  const userTenantsKey = JSON.stringify(user?.tenants || {});
  const currentTenantId = currentTenant?.id;

  // 1. Listen to all tenants from Firestore
  useEffect(() => {
    if (!firestore || !userUid) {
      setTenantsList([]);
      setIsLoadingTenants(false);
      return;
    }

    const isSuperAdmin = userRole === 'SUPERADMIN' || userEmail === 'thiagoddsm@gmail.com';

    const unsubscribe = onSnapshot(collection(firestore, 'tenants'), (snapshot) => {
      const allTenants = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Tenant),
      );

      // SuperAdmin sees all tenants; others see only linked tenants
      const visibleTenants = isSuperAdmin
        ? allTenants
        : allTenants.filter((t) => user?.tenants && user.tenants[t.id]);

      setTenantsList(visibleTenants);
      setIsLoadingTenants(false);

      // Auto-select or restore saved tenant
      const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem('festapay_tenant_id') : null;
      const matchedTenant = visibleTenants.find((t) => t.id === savedTenantId) || visibleTenants[0] || null;
      
      setCurrentTenantState((prev) => {
        if (prev) {
          const fresh = visibleTenants.find((t) => t.id === prev.id);
          if (fresh) return fresh;
        }
        return matchedTenant;
      });
    });

    return () => unsubscribe();
  }, [firestore, userUid, userRole, userEmail, userTenantsKey]);

  // 2. Listen to events of currentTenant
  useEffect(() => {
    if (!firestore || !currentTenantId) {
      setEventsList([]);
      setCurrentEventState(null);
      return;
    }

    const isSuperAdmin = userRole === 'SUPERADMIN' || userEmail === 'thiagoddsm@gmail.com';
    const isTenantAdmin = user?.tenants?.[currentTenantId]?.role === 'ADMIN';
    const allowedEventIds = user?.tenants?.[currentTenantId]?.allowedEventIds;

    const eventsRef = collection(firestore, 'tenants', currentTenantId, 'events');
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const loadedEvents = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as TenantEvent),
      );

      // Filter events by allowedEventIds if not admin
      const visibleEvents = isSuperAdmin || isTenantAdmin || !allowedEventIds || allowedEventIds.length === 0
        ? loadedEvents
        : loadedEvents.filter((e) => allowedEventIds.includes(e.id));

      setEventsList(visibleEvents);

      // Auto-select or restore saved event
      const savedEventId = typeof window !== 'undefined' ? localStorage.getItem('festapay_event_id') : null;
      const matchedEvent = visibleEvents.find((e) => e.id === savedEventId) || visibleEvents[0] || null;

      setCurrentEventState((prev) => {
        if (prev) {
          const fresh = visibleEvents.find((e) => e.id === prev.id);
          if (fresh) return fresh;
        }
        return matchedEvent;
      });
    });

    return () => unsubscribe();
  }, [firestore, currentTenantId, userRole, userEmail, userTenantsKey]);

  const setCurrentTenant = useCallback((tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    setCurrentEventState(null);
    if (typeof window !== 'undefined') {
      if (tenant) {
        localStorage.setItem('festapay_tenant_id', tenant.id);
      } else {
        localStorage.removeItem('festapay_tenant_id');
      }
      localStorage.removeItem('festapay_event_id');
    }
  }, []);

  const setCurrentEvent = useCallback((event: TenantEvent | null) => {
    setCurrentEventState(event);
    if (typeof window !== 'undefined') {
      if (event) {
        localStorage.setItem('festapay_event_id', event.id);
      } else {
        localStorage.removeItem('festapay_event_id');
      }
    }
  }, []);

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        currentEvent,
        tenantsList,
        eventsList,
        setCurrentTenant,
        setCurrentEvent,
        isLoadingTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
