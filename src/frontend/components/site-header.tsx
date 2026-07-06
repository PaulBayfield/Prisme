"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, NAV_ITEMS_SYSTEM, NAV_ITEMS_TOOLS } from "@/components/app-sidebar";
import { BlurToggle } from "@/components/blur-toggle";
import { MobileAccountSheet } from "@/components/mobile-account-sheet";
import { MobileNavSheet } from "@/components/mobile-nav-sheet";
import { SyncStatusButton } from "@/components/sync-status-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimeRangePicker } from "@/components/time-range-picker";
import { TransactionFiltersSheet } from "@/components/transaction-filters-sheet";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type {
  Account,
  AssignedCategory,
  Category,
  CategoryUseCase,
  SyncStatus,
  TransactionFilters,
} from "@/lib/types";

const ALL_NAV_ITEMS = [...NAV_ITEMS, ...NAV_ITEMS_TOOLS, ...NAV_ITEMS_SYSTEM];

function labelKeyForPathname(pathname: string): string | null {
  const match = ALL_NAV_ITEMS.find((entry) =>
    entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href),
  );
  return match?.labelKey ?? null;
}

export function SiteHeader({
  initialRange,
  initialSyncStatus,
  initialFilters,
  accounts,
  categories,
  categoryUseCases,
  hasLclCredentials,
  isDemoMode,
}: {
  initialRange: { from: string; to: string } | null;
  initialSyncStatus: SyncStatus | null;
  initialFilters: TransactionFilters;
  accounts: Account[];
  categories: Category[];
  categoryUseCases: Record<CategoryUseCase, AssignedCategory[]>;
  hasLclCredentials: boolean;
  isDemoMode: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const labelKey = labelKeyForPathname(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <MobileNavSheet />
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-6 md:flex mt-auto mb-auto" />
      <h1 className="text-base font-medium hidden md:block">{labelKey ? t(`items.${labelKey}`) : t("brand")}</h1>
      <div className="ml-auto flex items-center gap-1">
        <TimeRangePicker initialRange={initialRange} />
        <TransactionFiltersSheet accounts={accounts} categories={categories} initialFilters={initialFilters} />
        <SyncStatusButton initialStatus={initialSyncStatus} isDemoMode={isDemoMode} />
        <BlurToggle />
        <ThemeToggle />
        <MobileAccountSheet
          categories={categories}
          categoryUseCases={categoryUseCases}
          hasLclCredentials={hasLclCredentials}
          isDemoMode={isDemoMode}
        />
      </div>
    </header>
  );
}
