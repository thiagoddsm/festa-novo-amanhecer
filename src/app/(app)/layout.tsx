'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AuthenticatedUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  if (loading || !user) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          Carregando...
        </div>
      );
  }

  // TODO: Add role-based logic here later
  // For now, we'll give everyone CAIXA role for demonstration
  const mockUser: AuthenticatedUser = {
      isAuthenticated: !!user,
      role: 'CAIXA',
      name: user.displayName || 'Usuário',
  }

  return (
    <SidebarProvider>
        <Sidebar>
            <SidebarNav user={mockUser} />
        </Sidebar>
        <SidebarInset>
            <Header user={mockUser} />
            <main className="p-4 lg:p-6 bg-background">
                {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
