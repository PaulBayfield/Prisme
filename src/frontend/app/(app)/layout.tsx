import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BlurProvider } from "@/components/blur-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDateRangeCookieValue } from "@/lib/date-range";
import {
  getAccounts,
  getCategories,
  getCategoryUseCases,
  getCurrentUserId,
  getHasLclCredentials,
  getLatestSyncStatus,
  getOnboardingStatus,
} from "@/lib/data";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getCurrentUserId();
  const { onboardedAt } = await getOnboardingStatus(userId);
  if (!onboardedAt) {
    redirect("/onboarding");
  }

  const [categories, categoryUseCases, accounts, hasLclCredentials, initialSyncStatus] = await Promise.all([
    getCategories(userId),
    getCategoryUseCases(userId),
    getAccounts(userId),
    getHasLclCredentials(userId),
    getLatestSyncStatus(userId),
  ]);
  const initialRange = await getDateRangeCookieValue();
  const initialFilters = await getTransactionFiltersFromCookies();

  return (
    <BlurProvider>
      <TooltipProvider delay={200}>
        <SidebarProvider>
          <AppSidebar categories={categories} categoryUseCases={categoryUseCases} hasLclCredentials={hasLclCredentials} />
          <SidebarInset>
            <SiteHeader
              initialRange={initialRange}
              initialSyncStatus={initialSyncStatus}
              initialFilters={initialFilters}
              accounts={accounts}
              categories={categories}
            />
            <div className="flex flex-1 flex-col gap-4 p-4 pb-20 md:gap-6 md:p-6 md:pb-6">
              {children}
            </div>
            <MobileBottomNav />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </BlurProvider>
  );
}
