"use client";

import { ResponsiveContainer, Tooltip, Treemap, type TreemapProps, type TreemapNode } from "recharts";

import { ChartAmountTooltip } from "@/components/chart-amount-tooltip";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import { getContrastTextColor } from "@/lib/color";
import { formatCurrency } from "@/lib/format";
import type { CategorySpendingSlice } from "@/lib/types";

function renderContent(props: TreemapNode, code: string, rate: number) {
  const { x, y, width, height, name } = props;
  // recharts types extra data fields via an index signature (unknown) -
  // cast to read the color/amount we attached to each slice.
  const { color, amount } = props as unknown as { color: string; amount: number };
  const textColor = getContrastTextColor(color);
  const showLabel = width > 64 && height > 32;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="var(--background)" strokeWidth={2} />
      {showLabel ? (
        <>
          <text className="blur-sensitive" x={x + 8} y={y + 18} fontSize={12} fontWeight={600} fill={textColor}>
            {name}
          </text>
          <text className="blur-sensitive" x={x + 8} y={y + 34} fontSize={11} fill={textColor} fillOpacity={0.85}>
            {formatCurrency(amount * rate, code)}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function CategoryTreemapChart({
  data,
  emptyMessage,
}: {
  data: CategorySpendingSlice[];
  emptyMessage: string;
}) {
  const { code, rate } = useDisplayCurrency();

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        data={data as unknown as TreemapProps["data"]}
        dataKey="amount"
        nameKey="name"
        content={(props: TreemapNode) => renderContent(props, code, rate)}
        isAnimationActive={false}
      >
        <Tooltip content={<ChartAmountTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
