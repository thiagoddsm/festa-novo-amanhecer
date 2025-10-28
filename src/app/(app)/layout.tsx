'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import { FirebaseClientProvider } from "@/firebase";
import { AuthProvider, useAuth } from "@/hooks/use-auth-context";
import { usePathname, useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/loader";
import { useEffect } from "react";


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

        // If user is PDV and not on POS page, redirect them.
        if (user.role === 'PDV' && pathname !== '/pos') {
            router.replace('/pos');
        } else if (user.role !== 'PDV' && pathname === '/pos') {
            // If user is NOT PDV and tries to access POS, redirect them away.
            router.replace('/dashboard');
        }
    }, [user, loading, router, pathname]);

    // While checking auth state or if there's no user (and we're about to redirect), show a full-page loader.
    if (loading || !user) {
        return <FullPageLoader />;
    }
    
    // If user role requires a redirect, show loader while redirecting
    if ((user.role === 'PDV' && pathname !== '/pos') || (user.role !== 'PDV' && pathname === '/pos')) {
        return <FullPageLoader />;
    }

    // Don't render sidebar for PDV users as they only have one page
    if (user.role === 'PDV') {
        return (
             <div className="flex flex-col h-screen">
                <Header />
                <main className="flex-grow p-4 lg:p-6 bg-background">
                    {children}
                </main>
            </div>
        )
    }

    // Once the user object is available, render the app layout for ADMIN/CAIXA.
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarNav />
            </Sidebar>
            <SidebarInset>
                <Header />
                <main className="p-4 lg:p-6 bg-background">
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
        <AppContent>
          {children}
        </AppContent>
      </AuthProvider>
    </FirebaseClientProvider>
  );
}
