"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { BlurredYAxisTick } from "@/components/balance-chart";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatEvolutionDate, getCurrencySymbol } from "@/lib/format";
import type { CategoryEvolutionSeries, EvolutionGranularity } from "@/lib/types";

export function CategoryEvolutionChart({
  data,
  series,
  granularity,
  emptyMessage,
}: {
  data: Record<string, string | number>[];
  series: CategoryEvolutionSeries[];
  granularity: EvolutionGranularity;
  emptyMessage: string;
}) {
  const { code, rate } = useDisplayCurrency();
  const symbol = getCurrencySymbol(code);

  if (data.length === 0 || series.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>
    );
  }

  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const convertedData = data.map((point) => {
    const converted: Record<string, string | number> = { ...point };
    for (const s of series) {
      const value = point[s.key];
      if (typeof value === "number") {
        converted[s.key] = value * rate;
      }
    }
    return converted;
  });

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart data={convertedData} margin={{ left: 0, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value: string) => formatEvolutionDate(value, granularity)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={56}
          domain={["auto", "auto"]}
          tick={(props: React.ComponentProps<typeof BlurredYAxisTick>) => (
            <BlurredYAxisTick {...props} currencySymbol={symbol} />
          )}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatEvolutionDate(String(value), granularity)}
              currency={code}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} stackId="categories" fill={`var(--color-${s.key})`} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
