"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { BlurredYAxisTick } from "@/components/balance-chart";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDate, getCurrencySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Series {
  key: string;
  label: string;
  color: string;
  // Which y-axis this series plots against - defaults to "left". Set a
  // series to "right" when its scale differs too much from the others to
  // share one axis (e.g. net worth vs. bank-account-only balance).
  axis?: "left" | "right";
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
  const hasRightAxis = series.some((s) => s.axis === "right");

  // Which series the user has toggled off by clicking its legend entry -
  // hidden Areas are kept mounted (via the `hide` prop) rather than removed,
  // so toggling doesn't reset the chart's animation/tooltip state.
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(new Set());
  function toggleSeries(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <ChartContainer config={config} className="h-[240px] w-full">
        <AreaChart data={convertedData} margin={{ left: 4, right: hasRightAxis ? 0 : 12, top: 12 }}>
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
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={72}
            domain={["auto", "auto"]}
            tick={(props: React.ComponentProps<typeof BlurredYAxisTick>) => (
              <BlurredYAxisTick {...props} currencySymbol={symbol} />
            )}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={72}
              domain={["auto", "auto"]}
              tick={(props: React.ComponentProps<typeof BlurredYAxisTick>) => (
                <BlurredYAxisTick {...props} currencySymbol={symbol} textAnchor="start" />
              )}
            />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatDate(String(value))}
                indicator="line"
                currency={code}
              />
            }
          />
          {series.map((s) => (
            <Area
              key={s.key}
              yAxisId={s.axis === "right" ? "right" : "left"}
              dataKey={s.key}
              type="monotone"
              connectNulls
              hide={hiddenKeys.has(s.key)}
              fill={`url(#fill-${s.key})`}
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
        {series.map((s) => {
          const isHidden = hiddenKeys.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={!isHidden}
              onClick={() => toggleSeries(s.key)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-opacity hover:opacity-80",
                isHidden && "opacity-40",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
