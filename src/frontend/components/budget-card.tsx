import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { getTranslations } from "next-intl/server";

import { BudgetHistoryChart } from "@/components/budget-history-chart";
import { DeleteBudgetButton } from "@/components/delete-budget-button";
import { EditBudgetDialog } from "@/components/edit-budget-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import type { Budget, BudgetAverageSpend, BudgetHistoryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function BudgetCard({
  budget,
  history,
  averageSpend,
}: {
  budget: Budget;
  history?: BudgetHistoryPoint[];
  averageSpend?: BudgetAverageSpend;
}) {
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("budgets");
  const percent = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
  const isOver = budget.spent > budget.amount;
  const remaining = budget.amount - budget.spent;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: budget.categoryColor }} />
          <p className="text-sm font-medium">{budget.categoryName}</p>
          {isOver ? (
            <Badge variant="destructive" className="capitalize">
              {t("overBadge")}
            </Badge>
          ) : null}
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
            ? t("overBy", { amount: formatCurrency(-remaining * rate, code) })
            : t("remaining", { amount: formatCurrency(remaining * rate, code) })}
        </p>
        {averageSpend ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {t("averageOverall")}{" "}
              <span
                className={cn(
                  "blur-sensitive font-medium tabular-nums",
                  averageSpend.overall > budget.amount ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCurrency(averageSpend.overall * rate, code)}
              </span>
            </span>
            <span>
              {t("averagePeriod")}{" "}
              <span
                className={cn(
                  "blur-sensitive font-medium tabular-nums",
                  averageSpend.period > budget.amount ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCurrency(averageSpend.period * rate, code)}
              </span>
            </span>
          </div>
        ) : null}
        {history && history.length > 1 ? (
          <div className="border-t pt-2">
            <p className="mb-1 text-xs text-muted-foreground">{t("history")}</p>
            <BudgetHistoryChart data={history} budgetAmount={budget.amount} color={budget.categoryColor} code={code} rate={rate} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
