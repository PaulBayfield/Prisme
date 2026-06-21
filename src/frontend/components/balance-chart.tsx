"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDate } from "@/lib/format";

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
}: {
  x: string | number;
  y: string | number;
  payload: { value: number };
}) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="blur-sensitive">
      {`${payload.value}€`}
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
  return (
    <ChartContainer config={getChartConfig(label)} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 12 }}>
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
          width={56}
          domain={["auto", "auto"]}
          tick={BlurredYAxisTick}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(value) => formatDate(String(value))} indicator="line" />
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
