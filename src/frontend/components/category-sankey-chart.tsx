"use client";

import { Layer, ResponsiveContainer, Sankey, type SankeyNodeProps, Tooltip } from "recharts";

import { ChartAmountTooltip } from "@/components/chart-amount-tooltip";
import type { SankeyLinkDatum, SankeyNodeDatum } from "@/lib/types";

function renderNode({ x, y, width, height, index, payload }: SankeyNodeProps) {
  // recharts types this payload as its generic SankeyNode, which doesn't
  // know about the color/kind fields we attach to our own node data.
  const { color, kind, name } = payload as unknown as SankeyNodeDatum;
  const anchorEnd = kind === "leaf";
  return (
    <Layer key={`node-${index}`}>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={2} />
      <text
        x={anchorEnd ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={anchorEnd ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={12}
        fill="currentColor"
        className="blur-sensitive text-foreground"
      >
        {name}
      </text>
    </Layer>
  );
}

interface CategorySankeyChartProps {
  data: {
    nodes: SankeyNodeDatum[];
    links: SankeyLinkDatum[];
  };
  emptyMessage: string;
}

export function CategorySankeyChart({ data, emptyMessage }: CategorySankeyChartProps) {
  if (data.links.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // Most nodes end up at the rightmost (leaf) depth - give the chart enough
  // height that they don't get squeezed into unreadable slivers.
  const height = Math.max(360, data.nodes.length * 34);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        node={renderNode}
        nodePadding={22}
        nodeWidth={14}
        link={{ strokeOpacity: 0.35 }}
        margin={{ top: 10, right: 150, bottom: 10, left: 110 }}
      >
        <Tooltip content={<ChartAmountTooltip />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
