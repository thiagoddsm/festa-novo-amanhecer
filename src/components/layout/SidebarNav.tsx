'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, WalletCards } from "lucide-react";
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Image from "next/image";
import type { AuthenticatedUser } from "@/lib/auth";

const allNavItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', role: 'CAIXA' },
    { href: '/cashier', icon: WalletCards, label: 'Caixa', role: 'CAIXA' },
    { href: '/pos', icon: ShoppingCart, label: 'PDV', role: 'CAIXA' },
    { href: '/pos', icon: ShoppingCart, label: 'PDV', role: 'PDV' },
]

export function SidebarNav({ user }: { user: AuthenticatedUser | null }) {
    const pathname = usePathname();

    const navItems = allNavItems.filter(item => item.role === user?.role);

    // If PDV user, don't show sidebar if it only has one item
    if (user?.role === 'PDV' && navItems.length <= 1) {
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
                    <SidebarMenuItem key={`${item.href}-${item.role}`}>
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
