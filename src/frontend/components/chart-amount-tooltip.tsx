"use client";

import type { TooltipContentProps } from "recharts";

import { useDisplayCurrency } from "@/components/display-currency-provider";
import { formatCurrency } from "@/lib/format";

export function ChartAmountTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const { code, rate } = useDisplayCurrency();

  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (item?.value === undefined) return null;

  // Sankey links have resolved source/target node objects on payload.payload.
  // Pie and Treemap put the nameKey value directly on item.name.
  const raw = item.payload as Record<string, unknown> | undefined;
  const name: string | null =
    raw?.source && raw?.target
      ? `${(raw.source as { name: string }).name} → ${(raw.target as { name: string }).name}`
      : (item.name?.toString() ?? null);

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {name ? <p className="blur-sensitive mb-0.5 font-medium text-foreground">{name}</p> : null}
      <span className="blur-sensitive font-medium tabular-nums">{formatCurrency(Number(item.value) * rate, code)}</span>
    </div>
  );
}
