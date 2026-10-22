'use client';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { LogOut, Building2, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useTenant } from "@/hooks/use-tenant-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NetworkStatusIndicator from "../common/NetworkStatusIndicator";

const getTitleFromPathname = (pathname: string): string => {
    switch (pathname) {
        case '/dashboard':
            return 'Painel Administrativo';
        case '/cashier':
            return 'Caixa';
        case '/pos':
            return 'Ponto de Venda (PDV)';
        case '/cards':
            return 'Gerenciar Cartões';
        case '/transactions':
            return 'Histórico de Transações';
        case '/admin/users':
            return 'Gerenciar Usuários';
        case '/admin/tenants':
            return 'Organizações & Eventos';
        case '/admin/pdvs':
            return 'Gerenciar PDVs & Cardápios';
        case '/manual':
            return 'Manual de Operações';
        default:
            return 'FestaPay';
    }
}

export function Header() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const {
      currentTenant,
      currentEvent,
      tenantsList,
      eventsList,
      setCurrentTenant,
      setCurrentEvent,
    } = useTenant();
    const title = getTitleFromPathname(pathname || '');
    
    return (
        <header className="flex h-14 items-center gap-2 sm:gap-4 border-b bg-card px-2.5 sm:px-4 lg:h-[60px] lg:px-6 max-w-full overflow-hidden">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-2">
                 <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate">
                   <span className="sm:hidden">{pathname === '/pos' ? 'PDV' : title}</span>
                   <span className="hidden sm:inline">{title}</span>
                 </h1>
                 <div className="shrink-0 hidden xs:block">
                   <NetworkStatusIndicator />
                 </div>
            </div>

            {user && (
                 <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    {/* Tenant Selector */}
                    {tenantsList.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground hidden md:inline shrink-0" />
                        <Select
                          value={currentTenant?.id ?? ''}
                          onValueChange={(val) => {
                            const found = tenantsList.find((t) => t.id === val);
                            if (found) setCurrentTenant(found);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs max-w-[85px] xs:max-w-[110px] sm:max-w-[150px] md:max-w-[200px] px-2 bg-background truncate">
                            <SelectValue placeholder="Org" />
                          </SelectTrigger>
                          <SelectContent>
                            {tenantsList.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id} className="text-xs">
                                {tenant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Event Selector */}
                    {currentTenant && eventsList.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground hidden md:inline shrink-0" />
                        <Select
                          value={currentEvent?.id ?? ''}
                          onValueChange={(val) => {
                            const found = eventsList.find((e) => e.id === val);
                            if (found) setCurrentEvent(found);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px] sm:text-xs max-w-[85px] xs:max-w-[110px] sm:max-w-[150px] md:max-w-[200px] px-2 bg-background truncate">
                            <SelectValue placeholder="Evento" />
                          </SelectTrigger>
                          <SelectContent>
                            {eventsList.map((event) => (
                              <SelectItem key={event.id} value={event.id} className="text-xs">
                                {event.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <span className="text-sm text-muted-foreground hidden lg:inline ml-2 border-l pl-3">
                        Olá, {user.name}
                    </span>
                    <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="h-8 w-8 shrink-0">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </header>
    );
}
