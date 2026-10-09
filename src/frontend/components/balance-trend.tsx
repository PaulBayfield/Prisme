import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountBalanceChange } from "@/lib/types";

// Same icon/color convention as ComparisonCard (green = up, destructive =
// down, muted = flat) - here "up" is always "good" since there's no
// polarity concept for a raw account balance.
export async function BalanceTrend({
  first,
  last,
  display = "amount",
}: AccountBalanceChange & {
  // "percent" shows the relative change and swaps to the amount on hover.
  // Falls back to the amount when the starting balance is 0 (no percentage
  // to compute).
  display?: "amount" | "percent";
}) {
  const { code, rate } = await getDisplayCurrency();
  const diff = last - first;
  const isFlat = diff === 0;
  const isUp = diff > 0;
  const percent = display === "percent" && first !== 0 ? (diff / Math.abs(first)) * 100 : null;
  const amount = `${diff > 0 ? "+" : ""}${formatCurrency(diff * rate, code)}`;

  const className = cn(
    "flex w-fit items-center gap-0.5 text-xs font-medium",
    percent === null ? "blur-sensitive" : "cursor-default",
    isFlat ? "text-muted-foreground" : isUp ? "text-green-600 dark:text-green-400" : "text-destructive",
  );
  const icon = isFlat ? (
    <Minus className="size-3" aria-hidden="true" />
  ) : isUp ? (
    <TrendingUp className="size-3" aria-hidden="true" />
  ) : (
    <TrendingDown className="size-3" aria-hidden="true" />
  );

  if (percent === null) {
    return (
      <span className={className}>
        {icon}
        {amount}
      </span>
    );
  }

  // Both values share one grid cell so the badge keeps a stable width while
  // the percentage slides out and the amount slides in on hover.
  const swap = "col-start-1 row-start-1 whitespace-nowrap transition duration-200 ease-out motion-reduce:transition-none";

  return (
    <span className={cn(className, "group/trend")}>
      {icon}
      <span className="grid tabular-nums">
        <span className={cn(swap, "group-hover/trend:-translate-y-1 group-hover/trend:opacity-0")}>
          {diff > 0 ? "+" : ""}
          {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(percent)}%
        </span>
        <span
          className={cn(
            swap,
            "blur-sensitive translate-y-1 opacity-0 group-hover/trend:translate-y-0 group-hover/trend:opacity-100",
          )}
        >
          {amount}
        </span>
      </span>
    </span>
  );
}
