import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors KpiCard's layout - label + icon row, then one big value.
export function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-28" />
      </CardContent>
    </Card>
  );
}

// Mirrors AccountCard/AssetCard - icon + two text lines, a badge, one big value.
export function EntityCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-32" />
      </CardContent>
    </Card>
  );
}

// Mirrors any Card wrapping a BalanceChart/category chart - title + fixed-height plot area.
export function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[240px] w-full" />
      </CardContent>
    </Card>
  );
}

// Mirrors ComparisonCard - title, big value, small trend line.
export function ComparisonCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// Mirrors BudgetCard - dot + label + actions, amounts, progress bar, footer line.
export function BudgetCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-6 w-12" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

// Mirrors GoalCard - icon + name, badge, value/target pair, progress bar, footer line.
export function GoalCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

// Mirrors CurrencyConverter's rate cards - code + label, big value, small rate line.
export function CurrencyRateCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

// Mirrors TransactionsTable's rows - one bar per column.
export function TableRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
