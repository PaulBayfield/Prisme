import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Skeleton className="h-8 w-28" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-lg" />
          <Skeleton className="h-4.5 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-8 w-36" />
      </div>

      <ChartCardSkeleton />
    </div>
  );
}
