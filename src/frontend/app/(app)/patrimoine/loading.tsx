import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardSkeleton, EntityCardSkeleton, KpiCardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCardSkeleton />
      </div>

      <ChartCardSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EntityCardSkeleton />
        <EntityCardSkeleton />
        <EntityCardSkeleton />
      </div>
    </div>
  );
}
