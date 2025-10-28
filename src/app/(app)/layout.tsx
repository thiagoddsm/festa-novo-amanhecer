'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import { FirebaseClientProvider } from "@/firebase";
import { useUserData } from "@/hooks/use-user-data";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/loader";
import type { AuthenticatedUser } from "@/lib/auth";

function AppPagesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useUserData();

  useEffect(() => {
    // If loading is finished and there's no user, redirect to login.
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // While checking auth state, show a full-page loader.
  if (loading) {
    return <FullPageLoader />;
  }

  // If loading is done, but there's no user, the effect above has already
  // started the redirect. Rendering null prevents a flash of app content.
  if (!user) {
    return null;
  }
  
  // If user is PDV and not on POS page, redirect them.
  if (user.role === 'PDV' && pathname !== '/pos') {
    router.replace('/pos');
    return <FullPageLoader />;
  }

  // Once the user object is available, render the app layout.
  return (
      <SidebarProvider>
          <Sidebar>
              <SidebarNav user={user} />
          </Sidebar>
          <SidebarInset>
              <Header user={user} />
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
      <AppPagesLayout>
        {children}
      </AppPagesLayout>
    </FirebaseClientProvider>
  );
}
