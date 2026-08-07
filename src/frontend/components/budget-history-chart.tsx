"use client";

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, type TooltipContentProps } from "recharts";

import { formatCurrency, formatDate } from "@/lib/format";
import type { BudgetHistoryPoint } from "@/lib/types";

// Declared at module scope (not inline in BudgetHistoryChart's render) so
// passing it as <Tooltip content={<HistoryTooltip .../>} /> - the same
// element-as-content pattern ChartAmountTooltip uses - doesn't recreate a
// component identity on every render.
function HistoryTooltip({
  active,
  payload,
  code,
  rate,
}: Partial<TooltipContentProps<number, string>> & { code: string; rate: number }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as BudgetHistoryPoint;
  return (
    <div className="rounded-md border border-border/50 bg-background px-2 py-1 text-xs shadow-xl">
      <p className="font-medium">{formatDate(point.month)}</p>
      <p className="blur-sensitive tabular-nums text-muted-foreground">{formatCurrency(point.spent * rate, code)}</p>
    </div>
  );
}

// Deliberately not built on ChartContainer/ChartTooltip like the app's
// bigger charts - this is a tiny 6-bar sparkline embedded in a card, with
// no axes or legend, so that machinery would be pure overhead here.
export function BudgetHistoryChart({
  data,
  budgetAmount,
  color,
  code,
  rate,
}: {
  data: BudgetHistoryPoint[];
  budgetAmount: number;
  color: string;
  code: string;
  rate: number;
}) {
  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barCategoryGap="20%">
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<HistoryTooltip code={code} rate={rate} />} />
          {budgetAmount > 0 ? (
            <ReferenceLine y={budgetAmount} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
          ) : null}
          <Bar dataKey="spent" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((point, index) => (
              <Cell key={index} fill={point.spent > budgetAmount ? "var(--destructive)" : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
