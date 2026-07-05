"use client";

import { Cell, Pie, PieChart } from "recharts";

import { useDisplayCurrency } from "@/components/display-currency-provider";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import type { CategorySpendingSlice } from "@/lib/types";

export function CategoryPieChart({
  data,
  emptyMessage = "Pas encore de dépenses catégorisées",
}: {
  data: CategorySpendingSlice[];
  emptyMessage?: string;
}) {
  const { code, rate } = useDisplayCurrency();
  const total = data.reduce((sum, slice) => sum + slice.amount, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((slice) => [slice.name, { label: slice.name, color: slice.color }]),
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[220px] w-full max-w-[220px]">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value) => (
                  <span className="blur-sensitive font-mono tabular-nums">
                    {formatCurrency(Number(value) * rate, code)}
                  </span>
                )}
              />
            }
          />
          <Pie data={data} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={2}>
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="flex flex-1 flex-col gap-2">
        {data.map((slice) => (
          <div key={slice.name} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="blur-sensitive">{slice.name}</span>
            </div>
            <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
              <span className="blur-sensitive">{formatCurrency(slice.amount * rate, code)}</span>
              <span className="w-10 text-right">{Math.round((slice.amount / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
