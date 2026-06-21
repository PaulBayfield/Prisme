import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardSkeleton, KpiCardSkeleton, TableRowsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Skeleton className="h-8 w-24" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4.5 w-40" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      <ChartCardSkeleton />

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <TableRowsSkeleton />
        </CardContent>
      </Card>
    </div>
  );
}
