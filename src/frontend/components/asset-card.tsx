import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getAssetTypeDef } from "@/lib/asset-types";
import { formatCurrency } from "@/lib/format";
import type { Asset } from "@/lib/types";

export function AssetCard({ asset }: { asset: Asset }) {
  const typeDef = getAssetTypeDef(asset.type);
  const Icon = typeDef.icon;

  return (
    <Link href={`/patrimoine/${asset.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">{asset.name}</p>
          </div>
          <Badge variant="secondary">{typeDef.label}</Badge>
        </CardHeader>
        <CardContent>
          <div className="blur-sensitive text-2xl font-semibold tabular-nums">
            {formatCurrency(asset.value, asset.valueCurrency)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
