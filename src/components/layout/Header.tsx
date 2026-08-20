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
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1 flex items-center gap-3">
                 <h1 className="text-lg font-semibold whitespace-nowrap">{title}</h1>
                 <NetworkStatusIndicator />
            </div>

            {user && (
                 <div className="flex items-center gap-2 md:gap-3">
                    {/* Tenant Selector */}
                    {tenantsList.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-muted-foreground hidden sm:inline" />
                        <Select
                          value={currentTenant?.id ?? ''}
                          onValueChange={(val) => {
                            const found = tenantsList.find((t) => t.id === val);
                            if (found) setCurrentTenant(found);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs max-w-[170px] md:max-w-[210px] bg-background">
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
                      </div>
                    )}

                    {/* Event Selector */}
                    {currentTenant && eventsList.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-muted-foreground hidden sm:inline" />
                        <Select
                          value={currentEvent?.id ?? ''}
                          onValueChange={(val) => {
                            const found = eventsList.find((e) => e.id === val);
                            if (found) setCurrentEvent(found);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs max-w-[170px] md:max-w-[210px] bg-background">
                            <SelectValue placeholder="Selecione o Evento" />
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
                    <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </header>
    );
}
