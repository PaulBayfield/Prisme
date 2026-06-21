import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRowsSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      <Card>
        <CardContent>
          <div className="flex justify-end pb-3">
            <Skeleton className="h-8 w-40" />
          </div>
          <TableRowsSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}
