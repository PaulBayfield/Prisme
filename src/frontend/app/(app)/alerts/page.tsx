import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

import { DismissAlertButton } from "@/components/dismiss-alert-button";
import { LowBalanceThresholdForm } from "@/components/low-balance-threshold-form";
import { UndismissAlertButton } from "@/components/undismiss-alert-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveAlerts } from "@/lib/alerts";
import { getCurrentUserId, getDismissedAlerts } from "@/lib/data";
import { getLowBalanceThreshold } from "@/lib/low-balance-threshold";
import type { AlertType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALERT_ICON: Record<AlertType, LucideIcon> = {
  budgetExceeded: Wallet,
  lowBalance: AlertTriangle,
  unusualSpending: TrendingUp,
};

export default async function AlertsPage() {
  const userId = await getCurrentUserId();
  const t = await getTranslations("alerts");
  const [alerts, lowBalanceThreshold, dismissedAlerts] = await Promise.all([
    getActiveAlerts(userId),
    getLowBalanceThreshold(),
    getDismissedAlerts(userId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">{t("settingsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LowBalanceThresholdForm initialValue={lowBalanceThreshold} />
        </CardContent>
      </Card>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {alerts.map((alert) => {
              const Icon = ALERT_ICON[alert.type];
              return (
                <div key={alert.key} className="flex items-start gap-2 p-3">
                  <Link href={alert.href} className="flex flex-1 items-start gap-3 rounded-md p-1 hover:bg-muted/50">
                    <Icon
                      className={cn(
                        "mt-0.5 size-5 shrink-0",
                        alert.severity === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                      )}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="blur-sensitive text-sm font-medium">{alert.title}</p>
                      <p className="blur-sensitive text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                  </Link>
                  <DismissAlertButton alertKey={alert.key} label={alert.title} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {dismissedAlerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dismissedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {dismissedAlerts.map((dismissed) => (
              <div key={dismissed.key} className="flex items-center justify-between gap-2 p-3">
                <p className="blur-sensitive text-sm text-muted-foreground">{dismissed.label}</p>
                <UndismissAlertButton alertKey={dismissed.key} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
