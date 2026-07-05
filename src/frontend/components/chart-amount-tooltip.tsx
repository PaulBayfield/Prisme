"use client";

import type { TooltipContentProps } from "recharts";

import { useDisplayCurrency } from "@/components/display-currency-provider";
import { formatCurrency } from "@/lib/format";

// recharts injects active/payload itself via cloneElement at render time -
// declared optional here so <ChartAmountTooltip /> type-checks bare, the
// way it's actually used as a Tooltip `content`.
export function ChartAmountTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const { code, rate } = useDisplayCurrency();

  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === undefined) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="blur-sensitive font-medium tabular-nums">{formatCurrency(Number(value) * rate, code)}</span>
    </div>
  );
}
