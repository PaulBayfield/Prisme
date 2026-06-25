import Link from "next/link";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SavingsGoal } from "@/lib/types";

function sourceBadgeLabel(goal: SavingsGoal): string {
  if (goal.source === "category") return goal.period === "yearly" ? "Cette année" : "Ce mois-ci";
  if (goal.source === "account") return "Par compte";
  return "Manuel";
}

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const percent = goal.targetAmount > 0 ? (goal.value / goal.targetAmount) * 100 : 0;
  const isComplete = goal.value >= goal.targetAmount;

  return (
    <Link href={`/goals/${goal.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="size-4" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">{goal.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary">{sourceBadgeLabel(goal)}</Badge>
            {(goal.source === "account" || goal.source === "category") && goal.accountLabel ? (
              <p className="text-xs text-muted-foreground">{goal.accountLabel}</p>
            ) : null}
            {goal.source === "manual" && goal.targetDate ? (
              <p className="text-xs text-muted-foreground">Avant le {formatDate(goal.targetDate)}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="blur-sensitive flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatCurrency(goal.value, goal.valueCurrency)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatCurrency(goal.targetAmount, goal.valueCurrency)}
            </span>
          </div>
          <ProgressPrimitive.Root value={Math.min(percent, 100)}>
            <ProgressPrimitive.Track className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <ProgressPrimitive.Indicator
                className="h-full transition-all"
                style={{ backgroundColor: isComplete ? "var(--positive)" : "var(--primary)" }}
              />
            </ProgressPrimitive.Track>
          </ProgressPrimitive.Root>
          <p className="text-xs text-muted-foreground">
            {isComplete ? "Objectif atteint !" : `${Math.round(percent)}% atteint`}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
