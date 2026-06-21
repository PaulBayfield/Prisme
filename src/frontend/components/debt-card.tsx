import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDebtTypeDef } from "@/lib/debt-types";
import { formatCurrency } from "@/lib/format";
import type { Debt } from "@/lib/types";

export function DebtCard({ debt }: { debt: Debt }) {
  const typeDef = getDebtTypeDef(debt.type);
  const Icon = typeDef.icon;

  return (
    <Link href={`/cash-debts/${debt.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">{debt.name}</p>
          </div>
          <Badge variant="secondary">{typeDef.label}</Badge>
        </CardHeader>
        <CardContent>
          <div className="blur-sensitive text-2xl font-semibold tabular-nums">
            {formatCurrency(debt.value, debt.valueCurrency)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
