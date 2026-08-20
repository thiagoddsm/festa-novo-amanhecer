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

  // 1. Listen to all tenants from Firestore
  useEffect(() => {
    if (!firestore || !user) {
      setTenantsList([]);
      setIsLoadingTenants(false);
      return;
    }

    const isSuperAdmin = user.role === 'SUPERADMIN' || user.email === 'thiagoddsm@gmail.com';

    const unsubscribe = onSnapshot(collection(firestore, 'tenants'), (snapshot) => {
      const allTenants = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Tenant),
      );

      // SuperAdmin sees all tenants; others see only linked tenants
      const visibleTenants = isSuperAdmin
        ? allTenants
        : allTenants.filter((t) => user.tenants && user.tenants[t.id]);

      setTenantsList(visibleTenants);
      setIsLoadingTenants(false);

      // Auto-select or restore saved tenant
      const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem('festapay_tenant_id') : null;
      const matchedTenant = visibleTenants.find((t) => t.id === savedTenantId) || visibleTenants[0] || null;
      
      setCurrentTenantState((prev) => {
        if (prev && visibleTenants.some((t) => t.id === prev.id)) return prev;
        return matchedTenant;
      });
    });

    return () => unsubscribe();
  }, [firestore, user]);

  // 2. Listen to events of currentTenant
  useEffect(() => {
    if (!firestore || !currentTenant) {
      setEventsList([]);
      setCurrentEventState(null);
      return;
    }

    const isSuperAdmin = user?.role === 'SUPERADMIN' || user?.email === 'thiagoddsm@gmail.com';
    const isTenantAdmin = user?.tenants?.[currentTenant.id]?.role === 'ADMIN';
    const allowedEventIds = user?.tenants?.[currentTenant.id]?.allowedEventIds;

    const eventsRef = collection(firestore, 'tenants', currentTenant.id, 'events');
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
        if (prev && visibleEvents.some((e) => e.id === prev.id)) return prev;
        return matchedEvent;
      });
    });

    return () => unsubscribe();
  }, [firestore, currentTenant, user]);

  const setCurrentTenant = useCallback((tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (typeof window !== 'undefined') {
      if (tenant) {
        localStorage.setItem('festapay_tenant_id', tenant.id);
      } else {
        localStorage.removeItem('festapay_tenant_id');
      }
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
