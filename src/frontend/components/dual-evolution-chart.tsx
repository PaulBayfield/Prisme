"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { formatDate, getCurrencySymbol } from "@/lib/format";

interface Series {
  key: string;
  label: string;
  color: string;
}

export function DualEvolutionChart({
  data,
  series,
}: {
  data: Record<string, string | number | undefined>[];
  series: Series[];
}) {
  const { code, rate } = useDisplayCurrency();
  const symbol = getCurrencySymbol(code);
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );
  const convertedData = data.map((point) => {
    const converted: Record<string, string | number | undefined> = { ...point };
    for (const s of series) {
      const value = point[s.key];
      if (typeof value === "number") {
        converted[s.key] = value * rate;
      }
    }
    return converted;
  });

  return (
    <ChartContainer config={config} className="h-[240px] w-full">
      <AreaChart data={convertedData} margin={{ left: 0, right: 12, top: 12 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value: string) => formatDate(value)}
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
              labelFormatter={(value) => formatDate(String(value))}
              indicator="line"
              currency={code}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            connectNulls
            fill={`url(#fill-${s.key})`}
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
