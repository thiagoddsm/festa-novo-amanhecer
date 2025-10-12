'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import type { AuthenticatedUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Mock user com acesso total para navegação
  const mockUser: AuthenticatedUser = {
      isAuthenticated: true,
      role: 'CAIXA',
      name: 'Usuário',
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
