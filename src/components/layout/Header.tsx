'use client';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { AuthenticatedUser } from "@/lib/auth";


const getTitleFromPathname = (pathname: string): string => {
    switch (pathname) {
        case '/dashboard':
            return 'Painel Administrativo';
        case '/cashier':
            return 'Caixa';
        case '/pos':
            return 'Ponto de Venda (PDV)';
        default:
            return 'FestaPay';
    }
}

export function Header({ user }: { user: AuthenticatedUser | null }) {
    const pathname = usePathname();
    const { signOut } = useAuth();
    const title = getTitleFromPathname(pathname);
    
    const handleLogout = async () => {
        await signOut();
    }

    return (
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="w-full flex-1">
                <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            {user && (
                 <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground hidden md:inline">
                        Olá, {user.name}
                    </span>
                    <Button variant="outline" size="icon" aria-label="Sair" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </header>
    );
}
