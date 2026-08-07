import { getTranslations } from "next-intl/server";
import { Repeat } from "lucide-react";

import { KpiCard } from "@/components/kpi-card";
import { SubscriptionCard } from "@/components/subscription-card";
import { UnignoreRecurringButton } from "@/components/unignore-recurring-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserId, getIgnoredRecurringSeries, getRecurringTransactions } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function SubscriptionsPage() {
  const userId = await getCurrentUserId();
  const t = await getTranslations("subscriptions");
  const { code, rate } = await getDisplayCurrency();
  const [series, ignoredSeries] = await Promise.all([
    getRecurringTransactions(userId),
    getIgnoredRecurringSeries(userId),
  ]);

  const totalMonthly = series.reduce((sum, item) => sum + item.monthlyEquivalent, 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label={t("monthlyCost")}
          value={formatCurrency(totalMonthly * rate, code)}
          icon={Repeat}
          hint={t("detectedCount", { count: series.length })}
        />
      </div>

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((item) => (
            <SubscriptionCard key={`${item.accountInternalId}:${item.labelKey}`} series={item} />
          ))}
        </div>
      )}

      {ignoredSeries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("hiddenTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y p-0">
            {ignoredSeries.map((ignored) => (
              <div key={`${ignored.accountInternalId}:${ignored.labelKey}`} className="flex items-center justify-between gap-2 p-3">
                <p className="blur-sensitive text-sm text-muted-foreground">{ignored.label}</p>
                <UnignoreRecurringButton accountInternalId={ignored.accountInternalId} labelKey={ignored.labelKey} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
