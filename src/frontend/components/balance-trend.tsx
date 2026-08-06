import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountBalanceChange } from "@/lib/types";

// Same icon/color convention as ComparisonCard (green = up, destructive =
// down, muted = flat) - here "up" is always "good" since there's no
// polarity concept for a raw account balance.
export async function BalanceTrend({ first, last }: AccountBalanceChange) {
  const { code, rate } = await getDisplayCurrency();
  const diff = last - first;
  const isFlat = diff === 0;
  const isUp = diff > 0;

  return (
    <span
      className={cn(
        "blur-sensitive flex w-fit items-center gap-0.5 text-xs font-medium",
        isFlat ? "text-muted-foreground" : isUp ? "text-green-600 dark:text-green-400" : "text-destructive",
      )}
    >
      {isFlat ? (
        <Minus className="size-3" aria-hidden="true" />
      ) : isUp ? (
        <TrendingUp className="size-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="size-3" aria-hidden="true" />
      )}
      {diff > 0 ? "+" : ""}
      {formatCurrency(diff * rate, code)}
    </span>
  );
}
