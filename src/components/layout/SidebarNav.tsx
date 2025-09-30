'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, WalletCards } from "lucide-react";
import { SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Image from "next/image";

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/cashier', icon: WalletCards, label: 'Caixa' },
    { href: '/pos', icon: ShoppingCart, label: 'PDV' },
]

export function SidebarNav() {
    const pathname = usePathname();

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
                    <SidebarMenuItem key={item.href}>
                         <Link href={item.href} legacyBehavior passHref>
                            <SidebarMenuButton
                                isActive={pathname === item.href}
                                tooltip={{children: item.label}}
                            >
                                <item.icon />
                                <span>{item.label}</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </>
    )
}
