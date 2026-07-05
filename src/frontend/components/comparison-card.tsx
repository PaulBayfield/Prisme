import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function ComparisonCard({
  label,
  current,
  previous,
  previousLabel,
  polarity,
}: {
  label: string;
  current: number;
  previous: number;
  previousLabel: string;
  polarity: "good-up" | "good-down";
}) {
  const { code, rate } = await getDisplayCurrency();
  const diff = current - previous;
  const percent = previous !== 0 ? (diff / previous) * 100 : null;
  const isUp = diff > 0;
  const isFlat = diff === 0;
  const isGood = polarity === "good-up" ? isUp : !isUp;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="blur-sensitive text-2xl font-semibold tabular-nums">
          {formatCurrency(current * rate, code)}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              percent === null && "blur-sensitive",
              isFlat
                ? "text-muted-foreground"
                : isGood
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive",
            )}
          >
            {isFlat ? (
              <Minus className="size-3" />
            ) : isUp ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {percent !== null ? `${percent > 0 ? "+" : ""}${Math.round(percent)}%` : formatCurrency(diff * rate, code)}
          </span>
          <span className="blur-sensitive text-muted-foreground">
            {previousLabel} : {formatCurrency(previous * rate, code)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
