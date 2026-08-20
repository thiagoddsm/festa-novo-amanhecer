'use client';

import React from 'react';
import { useTenant } from '@/hooks/use-tenant-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Calendar } from 'lucide-react';

export default function TenantSelector() {
  const { currentTenant, currentEvent, tenantsList, eventsList, setCurrentTenant, setCurrentEvent } = useTenant();

  if (tenantsList.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Tenant Selector */}
      {currentTenant && (
        <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-md border border-border/60 text-xs">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {tenantsList.length > 1 ? (
            <Select
              value={currentTenant.id}
              onValueChange={(val) => {
                const selected = tenantsList.find((t) => t.id === val);
                if (selected) setCurrentTenant(selected);
              }}
            >
              <SelectTrigger className="h-7 border-none bg-transparent shadow-none p-0 text-xs font-semibold focus:ring-0">
                <SelectValue placeholder="Selecione a Organização" />
              </SelectTrigger>
              <SelectContent>
                {tenantsList.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id} className="text-xs">
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-semibold text-xs text-foreground">{currentTenant.name}</span>
          )}
        </div>
      )}

      {/* Event Selector */}
      {currentTenant && eventsList.length > 0 && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-md border border-primary/20 text-xs font-medium">
          <Calendar className="h-3.5 w-3.5" />
          <Select
            value={currentEvent?.id}
            onValueChange={(val) => {
              const selected = eventsList.find((e) => e.id === val);
              if (selected) setCurrentEvent(selected);
            }}
          >
            <SelectTrigger className="h-7 border-none bg-transparent shadow-none p-0 text-xs font-bold text-primary focus:ring-0">
              <SelectValue placeholder="Selecione o Evento" />
            </SelectTrigger>
            <SelectContent>
              {eventsList.map((evt) => (
                <SelectItem key={evt.id} value={evt.id} className="text-xs">
                  {evt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
