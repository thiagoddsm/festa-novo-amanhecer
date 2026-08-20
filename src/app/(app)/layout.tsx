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


function AppContent({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return; // Do nothing while loading
        
        if (!user) {
            router.replace('/login');
            return;
        }

        // If user is PDV and not on an allowed page, redirect them.
        const allowedPdvPaths = ['/pos', '/manual'];
        const currentPath = pathname || '';
        if (user.role === 'PDV' && !allowedPdvPaths.includes(currentPath)) {
            router.replace('/pos');
        } else if (user.role !== 'PDV' && currentPath === '/pos' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            // If user is NOT PDV (and not ADMIN/SUPERADMIN) and tries to access POS, redirect them away.
            router.replace('/dashboard');
        }
    }, [user, loading, router, pathname]);

    // While checking auth state or if there's no user (and we're about to redirect), show a full-page loader.
    if (loading || !user) {
        return <FullPageLoader />;
    }
    
    const allowedPdvPaths = ['/pos', '/manual'];
    const currentPath = pathname || '';
    // If user role requires a redirect, show loader while redirecting
    if ((user.role === 'PDV' && !allowedPdvPaths.includes(currentPath)) || (user.role !== 'PDV' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN' && currentPath === '/pos')) {
        return <FullPageLoader />;
    }
    
    const MainContent = ({children}: {children: React.ReactNode}) => (
      <main className="flex-grow p-4 lg:p-6 bg-background">
          {children}
      </main>
    );

    // Block visitor access and show a message.
    if (user.role === 'VISITANTE') {
       return (
            <div className="flex flex-col h-screen bg-background">
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
       )
    }
    
    // Once the user object is available, render the app layout for ADMIN/CAIXA/PDV.
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarNav />
            </Sidebar>
            <SidebarInset>
                <Header />
                <MainContent>{children}</MainContent>
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
