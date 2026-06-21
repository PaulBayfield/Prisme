import { Skeleton } from "@/components/ui/skeleton";
import { ChartCardSkeleton, ComparisonCardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComparisonCardSkeleton />
          <ComparisonCardSkeleton />
          <ComparisonCardSkeleton />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ComparisonCardSkeleton />
          <ComparisonCardSkeleton />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <ChartCardSkeleton />
    </div>
  );
}
