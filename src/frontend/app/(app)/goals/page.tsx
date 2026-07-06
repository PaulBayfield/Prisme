import { getTranslations } from "next-intl/server";
import { Target } from "lucide-react";

import { CreateGoalDialog } from "@/components/create-goal-dialog";
import { GoalCard } from "@/components/goal-card";
import { KpiCard } from "@/components/kpi-card";
import { getAccounts, getCategories, getCurrentUserId, getSavingsGoals, getTotalSavingsGoalsValue } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function GoalsPage() {
  const userId = await getCurrentUserId();
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("goals");
  const [goals, total, categories, accounts] = await Promise.all([
    getSavingsGoals(userId),
    getTotalSavingsGoalsValue(userId),
    getCategories(userId),
    getAccounts(userId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <CreateGoalDialog categories={categories} accounts={accounts} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={t("totalSaved")}
          value={formatCurrency(total * rate, code)}
          icon={Target}
          hint={t("goalsHint", { count: goals.length })}
        />
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}
