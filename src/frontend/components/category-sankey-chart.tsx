"use client";

import { Layer, ResponsiveContainer, Sankey, type SankeyNodeProps, Tooltip } from "recharts";

import { ChartAmountTooltip } from "@/components/chart-amount-tooltip";
import type { SankeyLinkDatum, SankeyNodeDatum } from "@/lib/types";

// A node only there to hold its successor in the right column (see
// alignColumns) - drawn like any other, but without a label of its own.
type ChartNode = SankeyNodeDatum & { spacer?: boolean };

function renderNode({ x, y, width, height, index, payload }: SankeyNodeProps, sinks: Set<number>) {
  // recharts types this payload as its generic SankeyNode, which doesn't
  // know about the color/spacer fields we attach to our own node data.
  const { color, name, spacer } = payload as unknown as ChartNode;
  const anchorEnd = sinks.has(index);
  return (
    <Layer key={`node-${index}`}>
      <rect x={x} y={y} width={width} height={height} fill={color} rx={2} />
      {spacer ? null : (
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
      )}
    </Layer>
  );
}

// Which column each node lands in: the longest path from any start node,
// same definition recharts uses. The graph is a DAG at most 5 levels deep,
// so this settles in a few passes.
function columnOf(nodeCount: number, links: SankeyLinkDatum[]): number[] {
  const depth = Array.from({ length: nodeCount }, () => 0);
  for (let pass = 0; pass < nodeCount; pass++) {
    let changed = false;
    for (const link of links) {
      if (depth[link.target] < depth[link.source] + 1) {
        depth[link.target] = depth[link.source] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

// recharts puts a node in the column right after its deepest predecessor,
// so a node with no predecessor always lands in the first column. In
// detailed mode that mixes two levels there: sub-categories, and the root
// categories that have none - whose links then have to jump over the root
// column, straight through whatever sits in it. Prepending a same-colored
// spacer to those roots pushes them back into the root column, so every
// link only ever spans adjacent columns.
function alignColumns(data: { nodes: SankeyNodeDatum[]; links: SankeyLinkDatum[] }) {
  const nodes: ChartNode[] = [...data.nodes];
  const links = [...data.links];
  const depth = columnOf(data.nodes.length, data.links);

  const hasIncoming = new Set(data.links.map((link) => link.target));
  data.nodes.forEach((node, index) => {
    if (hasIncoming.has(index)) return;
    const outgoing = data.links.filter((link) => link.source === index);
    if (outgoing.length === 0) return;
    const gap = Math.min(...outgoing.map((link) => depth[link.target])) - 1;
    const value = outgoing.reduce((sum, link) => sum + link.value, 0);
    let next = index;
    for (let step = 0; step < gap; step++) {
      nodes.push({ ...node, spacer: true });
      links.push({ source: nodes.length - 1, target: next, value });
      next = nodes.length - 1;
    }
  });

  return { nodes, links };
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

  const chartData = alignColumns(data);

  // Nodes without an outgoing link are the ones that can sit in the last
  // column, where a label on the right would overflow - so theirs is drawn
  // to the left of the node instead. Every label then sits inside the plot
  // area, which is what lets the margins stay small enough for the chart
  // to fit a phone screen.
  const sources = new Set(chartData.links.map((link) => link.source));
  const sinks = new Set(chartData.nodes.map((_, index) => index).filter((index) => !sources.has(index)));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={chartData}
        node={(props: SankeyNodeProps) => renderNode(props, sinks)}
        nodePadding={22}
        nodeWidth={14}
        // Not the default "justify", which drags every end node to the last
        // column whatever its level - in detailed mode that sends the
        // categories without sub-categories (and savings) across the
        // sub-category column, over the other links.
        align="left"
        link={{ strokeOpacity: 0.35 }}
        margin={{ top: 10, right: 4, bottom: 10, left: 4 }}
      >
        <Tooltip content={<ChartAmountTooltip />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
