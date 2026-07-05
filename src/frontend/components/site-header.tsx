"use client";

import { usePathname } from "next/navigation";

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

const TITLES: { href: string; title: string }[] = [
  { href: "/accounts", title: "Comptes" },
  { href: "/transactions", title: "Transactions" },
  { href: "/insights", title: "Insights" },
  { href: "/budgets", title: "Budgets" },
  { href: "/goals", title: "Objectifs" },
  { href: "/patrimoine", title: "Patrimoine" },
  { href: "/cash-debts", title: "Trésorerie" },
  { href: "/monitoring", title: "Monitoring" },
  { href: "/", title: "Tableau de bord" },
];

function titleForPathname(pathname: string): string {
  const match = TITLES.find((entry) =>
    entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href),
  );
  return match?.title ?? "Prisme";
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

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <MobileNavSheet />
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-6 md:flex mt-auto mb-auto" />
      <h1 className="text-base font-medium hidden md:block">{titleForPathname(pathname)}</h1>
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
