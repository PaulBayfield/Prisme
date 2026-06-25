import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Target } from "lucide-react";

import { AddGoalValueDialog } from "@/components/add-goal-value-dialog";
import { BalanceChart } from "@/components/balance-chart";
import { DeleteGoalButton } from "@/components/delete-goal-button";
import { EditGoalDialog } from "@/components/edit-goal-dialog";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAccounts,
  getBalanceHistory,
  getCategories,
  getCurrentUserId,
  getSavingsGoalById,
  getSavingsGoalValueHistory,
} from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const goalId = Number(id);

  const goal = Number.isInteger(goalId) ? await getSavingsGoalById(userId, goalId) : undefined;
  if (!goal) {
    notFound();
  }

  const isManual = goal.source === "manual";
  const isAccountLinked = goal.source === "account";
  const [manualHistory, accountHistory, categories, accounts] = await Promise.all([
    isManual ? getSavingsGoalValueHistory(goal.id) : Promise.resolve([]),
    isAccountLinked && goal.accountInternalId ? getBalanceHistory(goal.accountInternalId) : Promise.resolve([]),
    getCategories(userId),
    getAccounts(userId),
  ]);
  const chartData = isManual
    ? manualHistory.map((point) => ({ date: point.valuedAt, balance: point.value }))
    : accountHistory.map((point) => ({ date: point.capturedAt, balance: point.amount }));

  const remaining = Math.max(0, goal.targetAmount - goal.value);
  const isComplete = goal.value >= goal.targetAmount;
  const periodLabel = goal.source === "category" ? (goal.period === "yearly" ? "cette année" : "ce mois-ci") : null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/goals" />}
      >
        <ArrowLeft className="size-4" />
        Objectifs
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{goal.name}</h2>
            {goal.notes ? <p className="text-sm text-muted-foreground">{goal.notes}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isComplete ? <Badge className="border-transparent bg-positive/10 text-positive">Atteint</Badge> : null}
          <EditGoalDialog goal={goal} categories={categories} accounts={accounts} />
          <DeleteGoalButton goalId={goal.id} name={goal.name} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={periodLabel ? `Épargné ${periodLabel}` : "Épargné"}
          value={formatCurrency(goal.value, goal.valueCurrency)}
          icon={Target}
          hint={goal.accountLabel ?? undefined}
        />
        <KpiCard label="Objectif" value={formatCurrency(goal.targetAmount, goal.valueCurrency)} icon={Target} />
        <KpiCard
          label={isComplete ? "Restant" : "Restant à épargner"}
          value={formatCurrency(remaining, goal.valueCurrency)}
          icon={Calendar}
          hint={(isManual || isAccountLinked) && goal.targetDate ? `Avant le ${formatDate(goal.targetDate)}` : undefined}
        />
      </div>

      {isManual ? (
        <div className="flex justify-end">
          <AddGoalValueDialog goalId={goal.id} currentValue={goal.value} currency={goal.valueCurrency} />
        </div>
      ) : null}

      {isManual || isAccountLinked ? (
        <Card>
          <CardHeader>
            <CardTitle>Évolution de l&apos;épargne</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceChart data={chartData} label="Épargné" />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Calculé automatiquement à partir des transactions catégorisées «&nbsp;{goal.categoryName}&nbsp;»
          {goal.accountLabel ? ` sur ${goal.accountLabel}` : ""}, {periodLabel}.
        </p>
      )}
    </div>
  );
}
