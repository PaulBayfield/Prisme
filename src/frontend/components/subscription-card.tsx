import { getTranslations } from "next-intl/server";
import { Repeat } from "lucide-react";

import { DismissRecurringButton } from "@/components/dismiss-recurring-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency, formatDate } from "@/lib/format";
import type { RecurringSeries } from "@/lib/types";

export async function SubscriptionCard({ series }: { series: RecurringSeries }) {
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("subscriptions");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Repeat className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="blur-sensitive text-sm font-medium">{series.displayLabel}</p>
            <p className="text-xs text-muted-foreground">{series.accountLabel}</p>
          </div>
        </div>
        <DismissRecurringButton
          accountInternalId={series.accountInternalId}
          labelKey={series.labelKey}
          label={series.displayLabel}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="blur-sensitive text-lg font-semibold tabular-nums">
            {formatCurrency(series.amount * rate, code)}
          </span>
          <Badge variant="secondary">{t(`cadence.${series.cadence}`)}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {series.categoryName ? (
            <span className="flex items-center gap-1">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: series.categoryColor ?? undefined }}
              />
              {series.categoryName}
            </span>
          ) : null}
          <span>{t("nextExpected", { date: formatDate(series.nextExpectedDate) })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
