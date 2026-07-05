import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyRateCardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <CurrencyRateCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
