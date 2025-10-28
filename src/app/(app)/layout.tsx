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
        // If not loading and no user, redirect to login
        if (!loading && !user) {
            router.replace('/login');
            return;
        }

        // If user is PDV and not on POS page, redirect them.
        if (!loading && user && user.role === 'PDV' && pathname !== '/pos') {
            router.replace('/pos');
        }
    }, [user, loading, router, pathname]);

    // While checking auth state or if there's no user (and we're about to redirect), show a full-page loader.
    if (loading || !user) {
        return <FullPageLoader />;
    }
    
    // If user is PDV and we are redirecting, show loader
    if (user.role === 'PDV' && pathname !== '/pos') {
        return <FullPageLoader />;
    }

    // Don't render sidebar for PDV users as they only have one page
    if (user.role === 'PDV') {
        return (
             <main className="p-4 lg:p-6 bg-background h-screen">
                <Header />
                {children}
            </main>
        )
    }

    // Once the user object is available, render the app layout.
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
