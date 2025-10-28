'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, WalletCards, Users, List, UserCog } from "lucide-react";
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth-context";

const allNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'CAIXA'] },
    { href: '/cards', icon: Users, label: 'Cartões', roles: ['ADMIN', 'CAIXA'] },
    { href: '/transactions', icon: List, label: 'Transações', roles: ['ADMIN', 'CAIXA'] },
    { href: '/cashier', icon: WalletCards, label: 'Caixa', roles: ['ADMIN', 'CAIXA'] },
    { href: '/pos', icon: ShoppingCart, label: 'PDV', roles: ['ADMIN', 'PDV'] },
    { href: '/admin/users', icon: UserCog, label: 'Usuários', roles: ['ADMIN'] },
]

export function SidebarNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    if (!user) {
        return null; // Don't render anything if user is not loaded yet
    }

    // Filter nav items based on user role
    const navItems = allNavItems.filter(item => user?.role && item.roles.includes(user.role));

    // If user is PDV, their layout is different and doesn't include the main sidebar
    if (user.role === 'PDV') {
        return null;
    }

    return (
        <>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                     <Image src="/icon.svg" alt="FestaPay Logo" width={32} height={32} />
                     <h2 className="text-lg font-semibold tracking-tight">FestaPay</h2>
                </div>
            </SidebarHeader>
            <SidebarMenu>
                {navItems.map(item => (
                    <SidebarMenuItem key={`${item.href}-${item.label}`}>
                        <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href}
                            tooltip={{children: item.label}}
                        >
                            <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </>
    )
}
