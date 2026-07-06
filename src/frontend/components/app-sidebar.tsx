"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  ArrowRightLeft,
  Landmark,
  LayoutDashboard,
  PieChart,
  PiggyBank,
  Scale,
  Target,
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
import type { AssignedCategory, Category, CategoryUseCase } from "@/lib/types";
import HelpDialog from "./help-dialog";

export const NAV_ITEMS = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/accounts", labelKey: "accounts", icon: Wallet },
  { href: "/transactions", labelKey: "transactions", icon: ArrowLeftRight },
  { href: "/insights", labelKey: "insights", icon: PieChart },
  { href: "/budgets", labelKey: "budgets", icon: PiggyBank },
  { href: "/goals", labelKey: "goals", icon: Target },
  { href: "/patrimoine", labelKey: "patrimoine", icon: Landmark },
  { href: "/cash-debts", labelKey: "cashDebts", icon: Scale },
] as const;

export const NAV_ITEMS_TOOLS = [
  { href: "/currency-exchange", labelKey: "currencyExchange", icon: ArrowRightLeft },
] as const;

export const NAV_ITEMS_SYSTEM = [
  { href: "/monitoring", labelKey: "monitoring", icon: Activity },
] as const;

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppSidebar({
  categories,
  categoryUseCases,
  hasLclCredentials,
  isDemoMode,
}: {
  categories: Category[];
  categoryUseCases: Record<CategoryUseCase, AssignedCategory[]>;
  hasLclCredentials: boolean;
  isDemoMode: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <Image src="/logo-icon.png" alt="" width={32} height={32} className="size-8 shrink-0" priority />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{t("brand")}</span>
                <span className="truncate text-xs text-muted-foreground">{t("tagline")}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("groups.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={t(`items.${item.labelKey}`)}
                  >
                    <item.icon />
                    <span>{t(`items.${item.labelKey}`)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("groups.tools")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS_TOOLS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={t(`items.${item.labelKey}`)}
                  >
                    <item.icon />
                    <span>{t(`items.${item.labelKey}`)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("groups.system")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV_ITEMS_SYSTEM.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isNavItemActive(pathname, item.href)}
                    tooltip={t(`items.${item.labelKey}`)}
                  >
                    <item.icon />
                    <span>{t(`items.${item.labelKey}`)}</span>
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
                <SettingsDialog
                  categories={categories}
                  categoryUseCases={categoryUseCases}
                  hasLclCredentials={hasLclCredentials}
                  isDemoMode={isDemoMode}
                />
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
