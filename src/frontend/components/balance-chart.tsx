"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import { formatDate, getCurrencySymbol } from "@/lib/format";

function getChartConfig(label: string): ChartConfig {
  return {
    balance: {
      label,
      color: "var(--chart-1)",
    },
  };
}

export function BlurredYAxisTick({
  x,
  y,
  payload,
  currencySymbol = "€",
  // "end" draws the label leftward from x, into a left axis's reserved
  // margin - the right orientation needs the opposite ("start") so the
  // label draws rightward into its own margin instead of back over the
  // chart plot.
  textAnchor = "end",
}: {
  x: string | number;
  y: string | number;
  payload: { value: number };
  currencySymbol?: string;
  // Matches recharts' own TextAnchor union - the "tick" render prop receives
  // whatever anchor recharts computed for the axis, unless we override it.
  textAnchor?: "start" | "middle" | "end" | "inherit";
}) {
  return (
    <text x={x} y={y} dy={4} textAnchor={textAnchor} className="blur-sensitive fill-muted-foreground text-xs">
      {`${payload.value}${currencySymbol}`}
    </text>
  );
}

export function BalanceChart({
  data,
  label = "Solde",
}: {
  data: { date: string; balance: number }[];
  label?: string;
}) {
  const { code, rate } = useDisplayCurrency();
  const symbol = getCurrencySymbol(code);
  const convertedData = data.map((point) => ({ ...point, balance: point.balance * rate }));

  return (
    <ChartContainer config={getChartConfig(label)} className="h-[240px] w-full">
      <AreaChart data={convertedData} margin={{ left: 4, right: 12, top: 12 }}>
        <defs>
          <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0} />
          </linearGradient>
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
          width={72}
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
        <Area
          dataKey="balance"
          type="monotone"
          fill="url(#fillBalance)"
          stroke="var(--color-balance)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
