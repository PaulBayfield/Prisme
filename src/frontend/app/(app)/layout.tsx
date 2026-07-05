import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BlurProvider } from "@/components/blur-provider";
import { DisplayCurrencyProvider } from "@/components/display-currency-provider";
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
import { getDisplayCurrency } from "@/lib/display-currency";
import { isDemoMode } from "@/lib/env";
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
  const displayCurrency = await getDisplayCurrency();

  return (
    <DisplayCurrencyProvider code={displayCurrency.code} rate={displayCurrency.rate}>
      <BlurProvider>
        <TooltipProvider delay={200}>
          <SidebarProvider>
            <AppSidebar
              categories={categories}
              categoryUseCases={categoryUseCases}
              hasLclCredentials={hasLclCredentials}
              isDemoMode={isDemoMode}
            />
            <SidebarInset>
              <SiteHeader
                initialRange={initialRange}
                initialSyncStatus={initialSyncStatus}
                initialFilters={initialFilters}
                accounts={accounts}
                categories={categories}
                categoryUseCases={categoryUseCases}
                hasLclCredentials={hasLclCredentials}
                isDemoMode={isDemoMode}
              />
              <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </BlurProvider>
    </DisplayCurrencyProvider>
  );
}
