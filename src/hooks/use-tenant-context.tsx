'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Tenant, Event } from '@/lib/definitions';
import { useAuth } from '@/hooks/use-auth-context';
import { useFirestore } from '@/firebase';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';

interface TenantContextType {
  currentTenant: Tenant | null;
  currentEvent: Event | null;
  tenantsList: Tenant[];
  eventsList: Event[];
  setCurrentTenant: (tenant: Tenant) => void;
  setCurrentEvent: (event: Event) => void;
  isLoadingTenant: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const firestore = useFirestore();

  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [currentEvent, setCurrentEventState] = useState<Event | null>(null);
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);
  const [eventsList, setEventsList] = useState<Event[]>([]);
  const [isLoadingTenant, setIsLoadingTenant] = useState<boolean>(true);

  // Real-time listener for user's accessible tenants
  useEffect(() => {
    if (!user || !firestore) {
      setIsLoadingTenant(false);
      return;
    }

    const tenantsRef = collection(firestore, 'tenants');
    let unsubTenants: (() => void) | null = null;

    if (user?.role === 'SUPERADMIN' || user?.email === 'thiagoddsm@gmail.com') {
      unsubTenants = onSnapshot(tenantsRef, (snapshot) => {
        const loadedTenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
        setTenantsList(loadedTenants);

        if (loadedTenants.length > 0) {
          const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem('festapay_tenant_id') : null;
          setCurrentTenantState(prev => {
            if (prev && loadedTenants.some(t => t.id === prev.id)) return prev;
            return loadedTenants.find(t => t.id === savedTenantId) || loadedTenants[0];
          });
        }
        setIsLoadingTenant(false);
      });
    } else if (user?.tenants && Object.keys(user.tenants).length > 0) {
      unsubTenants = onSnapshot(tenantsRef, (snapshot) => {
        const userTenantIds = Object.keys(user.tenants || {});
        const loadedTenants = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Tenant))
          .filter(t => userTenantIds.includes(t.id));
        
        setTenantsList(loadedTenants);

        if (loadedTenants.length > 0) {
          const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem('festapay_tenant_id') : null;
          setCurrentTenantState(prev => {
            if (prev && loadedTenants.some(t => t.id === prev.id)) return prev;
            return loadedTenants.find(t => t.id === savedTenantId) || loadedTenants[0];
          });
        }
        setIsLoadingTenant(false);
      });
    } else {
      setIsLoadingTenant(false);
    }

    return () => {
      if (unsubTenants) unsubTenants();
    };
  }, [user, firestore]);

  // Real-time listener for events of active tenant
  useEffect(() => {
    if (!currentTenant || !firestore) {
      setEventsList([]);
      setCurrentEventState(null);
      return;
    }

    const eventsRef = collection(firestore, 'tenants', currentTenant.id, 'events');
    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setEventsList(loadedEvents);

      if (loadedEvents.length > 0) {
        const savedEventId = typeof window !== 'undefined' ? localStorage.getItem(`festapay_event_id_${currentTenant.id}`) : null;
        setCurrentEventState(prev => {
          if (prev && loadedEvents.some(e => e.id === prev.id)) return prev;
          return loadedEvents.find(e => e.id === savedEventId) || loadedEvents[0];
        });
      } else {
        setCurrentEventState(null);
      }
    });

    return () => unsubEvents();
  }, [currentTenant, firestore]);

  const setCurrentTenant = (tenant: Tenant) => {
    setCurrentTenantState(tenant);
    if (typeof window !== 'undefined') {
      localStorage.setItem('festapay_tenant_id', tenant.id);
    }
  };

  const setCurrentEvent = (event: Event) => {
    setCurrentEventState(event);
    if (typeof window !== 'undefined' && currentTenant) {
      localStorage.setItem(`festapay_event_id_${currentTenant.id}`, event.id);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        currentEvent,
        tenantsList,
        eventsList,
        setCurrentTenant,
        setCurrentEvent,
        isLoadingTenant,
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
