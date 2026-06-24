"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Info,
  Landmark,
  LayoutDashboard,
  PieChart,
  PiggyBank,
  Scale,
  Wallet,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import { SettingsDialog } from "@/components/settings-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Category } from "@/lib/types";
import HelpDialog from "./help-dialog";

export const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/accounts", label: "Comptes", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/insights", label: "Insights", icon: PieChart },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/patrimoine", label: "Patrimoine", icon: Landmark },
  { href: "/cash-debts", label: "Trésorerie", icon: Scale },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppSidebar({
  categories,
  hasLclCredentials,
}: {
  categories: Category[];
  hasLclCredentials: boolean;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <Image src="/logo-icon.png" alt="" width={32} height={32} className="size-8 shrink-0" priority />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Prisme</span>
                <span className="truncate text-xs text-muted-foreground">Money Tracker</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto" >
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem key="settings">
                <SettingsDialog categories={categories} hasLclCredentials={hasLclCredentials} />
              </SidebarMenuItem>
              <SidebarMenuItem key="help" suppressHydrationWarning={true}>
                <HelpDialog />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
