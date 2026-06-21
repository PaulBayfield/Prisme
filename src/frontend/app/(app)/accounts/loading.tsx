import { EntityCardSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EntityCardSkeleton />
          <EntityCardSkeleton />
          <EntityCardSkeleton />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <Skeleton className="h-5 w-20" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EntityCardSkeleton />
          <EntityCardSkeleton />
        </div>
      </section>
    </div>
  );
}
