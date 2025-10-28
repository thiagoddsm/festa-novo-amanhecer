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
    // If auth state is still being checked, do nothing.
    if (loading) {
      return;
    }

    // If not loading and there is no authenticated user, redirect to login.
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);


  // Show a loader while authentication state is being determined or user data is being fetched.
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
