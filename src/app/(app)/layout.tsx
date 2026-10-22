'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import { FirebaseClientProvider } from "@/firebase";
import { AuthProvider, useAuth } from "@/hooks/use-auth-context";
import { TenantProvider } from "@/hooks/use-tenant-context";
import { usePathname, useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/loader";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";


// Per-role allowed paths (null = unrestricted)
const ROLE_ALLOWED_PATHS: Record<string, string[] | null> = {
    SUPERADMIN: null, // access everything
    ADMIN: null, // legacy support for Super Admin
    ADMIN_ORGANIZACAO: ['/dashboard', '/cards', '/transactions', '/cashier', '/admin/users', '/admin/tenants', '/admin/pdvs', '/pos', '/manual'],
    ADMIN_EVENTO: ['/dashboard', '/cards', '/transactions', '/cashier', '/admin/pdvs', '/pos', '/manual'],
    CAIXA: ['/dashboard', '/cashier', '/cards', '/transactions', '/manual'],
    PDV: ['/pos', '/manual'],
    VISITANTE: [], // blocked — shown a waiting card
};

const ROLE_DEFAULT_REDIRECT: Record<string, string> = {
    SUPERADMIN: '/dashboard',
    ADMIN_ORGANIZACAO: '/dashboard',
    ADMIN_EVENTO: '/dashboard',
    CAIXA: '/dashboard',
    PDV: '/pos',
    VISITANTE: '/',
};

function AppContent({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        const currentPath = pathname || '';
        const allowedPaths = ROLE_ALLOWED_PATHS[user.role];

        // null means unrestricted (SUPERADMIN)
        if (allowedPaths === null) return;

        // VISITANTE is handled by the render path — no redirect needed here
        if (user.role === 'VISITANTE') return;

        // Redirect if current path is not in the allowed list
        if (!allowedPaths.includes(currentPath)) {
            router.replace(ROLE_DEFAULT_REDIRECT[user.role] ?? '/dashboard');
        }
    }, [user, loading, router, pathname]);

    if (loading || !user) {
        return <FullPageLoader />;
    }

    const currentPath = pathname || '';
    const allowedPaths = ROLE_ALLOWED_PATHS[user.role];

    // Show loader while a redirect is pending
    if (
        user.role !== 'VISITANTE' &&
        allowedPaths !== null &&
        !allowedPaths.includes(currentPath)
    ) {
        return <FullPageLoader />;
    }

    // VISITANTE: show waiting card, wrapped in SidebarProvider to satisfy useSidebar
    if (user.role === 'VISITANTE') {
        return (
            <SidebarProvider>
                <div className="flex flex-col h-screen w-full bg-background">
                    <Header />
                    <div className="flex flex-grow items-center justify-center p-4">
                        <Card className="max-w-md text-center">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-center gap-2">
                                    <Lock />
                                    Acesso Restrito
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    Você está logado como visitante. Por favor, aguarde um administrador liberar seu acesso para visualizar o conteúdo.
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </SidebarProvider>
        );
    }

    // All other roles get the full sidebar layout
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarNav />
            </Sidebar>
            <SidebarInset>
                <Header />
                <main className="flex-grow p-2.5 sm:p-4 lg:p-6 bg-background max-w-full overflow-x-hidden">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <AuthProvider>
        <TenantProvider>
          <AppContent>
            {children}
          </AppContent>
        </TenantProvider>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
