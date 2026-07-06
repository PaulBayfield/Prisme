import { getTranslations } from "next-intl/server";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import type { IncomePrediction } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function IncomeForecastCard({ prediction }: { prediction: IncomePrediction }) {
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("insights");
  const diff = prediction.actualSoFar - prediction.expectedSoFar;
  const isAbove = diff >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("incomeForecastTitle")}</CardTitle>
        <Badge
          variant={isAbove ? "outline" : "destructive"}
          className={cn(isAbove && "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400")}
        >
          {isAbove ? <TrendingUp /> : <TrendingDown />}
          {isAbove ? t("above") : t("below")}
        </Badge>
      </CardHeader>
      <CardContent className="blur-sensitive flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(prediction.actualSoFar * rate, code)}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("expectedToDate", { amount: formatCurrency(prediction.expectedSoFar * rate, code) })}
          </span>
        </div>
        <p
          className={cn(
            "text-xs",
            isAbove ? "text-green-600 dark:text-green-400" : "text-destructive",
          )}
        >
          {t("vsExpectedToDate", {
            amount: `${isAbove ? "+" : ""}${formatCurrency(diff * rate, code)}`,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("monthForecast", { amount: formatCurrency(prediction.predictedAmount * rate, code) })}
        </p>
      </CardContent>
    </Card>
  );
}
