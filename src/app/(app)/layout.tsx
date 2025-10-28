'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import type { AuthenticatedUser } from "@/lib/auth";
import { FirebaseClientProvider, useAuth } from "@/firebase";
import { useUserData } from "@/hooks/use-user-data";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/loader";

function AppPagesLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const { user, loading } = useUserData();

  useEffect(() => {
    // If loading, don't do anything.
    if (loading) {
      return;
    }
    // If not logged in, redirect to login page.
    if (!auth?.currentUser) {
      router.push("/login");
    }
    // If logged in but no user data found (e.g. profile not in firestore), log out.
    if (auth?.currentUser && !user) {
        auth.signOut();
        router.push('/login');
    }
  }, [auth, user, loading, router]);

  if (loading || !user) {
    return <FullPageLoader />;
  }
  
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
