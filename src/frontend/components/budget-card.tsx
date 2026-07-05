import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { DeleteBudgetButton } from "@/components/delete-budget-button";
import { EditBudgetDialog } from "@/components/edit-budget-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import type { Budget } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function BudgetCard({ budget }: { budget: Budget }) {
  const { code, rate } = await getDisplayCurrency();
  const percent = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
  const isOver = budget.spent > budget.amount;
  const remaining = budget.amount - budget.spent;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: budget.categoryColor }} />
          <p className="text-sm font-medium">{budget.categoryName}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <EditBudgetDialog budget={budget} />
          <DeleteBudgetButton budgetId={budget.id} categoryName={budget.categoryName} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="blur-sensitive flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">{formatCurrency(budget.spent * rate, code)}</span>
          <span className="text-sm text-muted-foreground">/ {formatCurrency(budget.amount * rate, code)}</span>
        </div>
        <ProgressPrimitive.Root value={Math.min(percent, 100)}>
          <ProgressPrimitive.Track className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <ProgressPrimitive.Indicator
              className="h-full transition-all"
              style={{ backgroundColor: isOver ? "var(--destructive)" : budget.categoryColor }}
            />
          </ProgressPrimitive.Track>
        </ProgressPrimitive.Root>
        <p className={cn("blur-sensitive text-xs", isOver ? "text-destructive" : "text-muted-foreground")}>
          {isOver
            ? `Dépassement de ${formatCurrency(-remaining * rate, code)}`
            : `${formatCurrency(remaining * rate, code)} restants`}
        </p>
      </CardContent>
    </Card>
  );
}
