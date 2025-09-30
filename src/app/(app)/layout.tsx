import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Header } from "@/components/layout/Header";
import { checkAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await checkAuth();

  if (!user) {
    redirect('/login');
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
