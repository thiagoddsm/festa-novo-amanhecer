'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, WalletCards, Users, List, UserCog, BookUser, Building2, Store } from "lucide-react";
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth-context";
import { Logo } from "./Logo";

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO', 'CAIXA'];

const allNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ADMIN_ROLES },
    { href: '/cards', icon: Users, label: 'Cartões', roles: ADMIN_ROLES },
    { href: '/transactions', icon: List, label: 'Transações', roles: ADMIN_ROLES },
    { href: '/cashier', icon: WalletCards, label: 'Caixa', roles: ADMIN_ROLES },
    { href: '/pos', icon: ShoppingCart, label: 'PDV', roles: ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'PDV'] },
    { href: '/admin/pdvs', icon: Store, label: 'Gerenciar PDVs', roles: ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO'] },
    { href: '/manual', icon: BookUser, label: 'Manual', roles: ['SUPERADMIN', 'ADMIN_ORGANIZACAO', 'ADMIN_EVENTO', 'CAIXA', 'PDV'] },
    { href: '/admin/tenants', icon: Building2, label: 'Organizações', roles: ['SUPERADMIN', 'ADMIN_ORGANIZACAO'] },
    { href: '/admin/users', icon: UserCog, label: 'Usuários', roles: ['SUPERADMIN', 'ADMIN_ORGANIZACAO'] },
]

export function SidebarNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    if (!user) {
        return null; // Don't render anything if user is not loaded yet
    }

    // Filter nav items based on user role
    const navItems = allNavItems.filter(item => user?.role && item.roles.includes(user.role));

    return (
        <>
            <SidebarHeader>
                <Logo />
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
