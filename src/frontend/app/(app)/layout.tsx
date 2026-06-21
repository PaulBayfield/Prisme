import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BlurProvider } from "@/components/blur-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDateRangeCookieValue } from "@/lib/date-range";
import { getCategories, getCurrentUserId, getHasLclCredentials, getOnboardingStatus } from "@/lib/data";

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

  const [categories, hasLclCredentials] = await Promise.all([
    getCategories(userId),
    getHasLclCredentials(userId),
  ]);
  const initialRange = await getDateRangeCookieValue();

  return (
    <BlurProvider>
      <TooltipProvider delay={200}>
        <SidebarProvider>
          <AppSidebar categories={categories} hasLclCredentials={hasLclCredentials} />
          <SidebarInset>
            <SiteHeader initialRange={initialRange} />
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
