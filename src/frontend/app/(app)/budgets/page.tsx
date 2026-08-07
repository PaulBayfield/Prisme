import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, PiggyBank, Wallet } from "lucide-react";

import { BudgetCard } from "@/components/budget-card";
import { CreateBudgetDialog } from "@/components/create-budget-dialog";
import { KpiCard } from "@/components/kpi-card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { getBudgetAverageSpend, getBudgetHistory, getBudgets, getCategories, getCurrentUserId } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function BudgetsPage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("budgets");
  const [budgets, categories, history, averageSpend] = await Promise.all([
    getBudgets(userId, range),
    getCategories(userId),
    getBudgetHistory(userId),
    getBudgetAverageSpend(userId, range),
  ]);

  const budgetedCategoryIds = new Set(budgets.map((budget) => budget.categoryId));
  const availableCategories = categories.filter((category) => !budgetedCategoryIds.has(category.id));

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const spentLabel = range.from ? t("spentThisPeriod") : t("spentThisMonth");

  const overBudgets = budgets.filter((budget) => budget.spent > budget.amount);
  const respectedCount = budgets.length - overBudgets.length;
  const totalOverage = overBudgets.reduce((sum, budget) => sum + (budget.spent - budget.amount), 0);

  // Over-budget categories surface first so "am I on track" reads at a
  // glance without scanning the whole grid; ties keep the existing
  // alphabetical order from getBudgets.
  const sortedBudgets = [...budgets].sort((a, b) => {
    const aOver = a.spent > a.amount ? 1 : 0;
    const bOver = b.spent > b.amount ? 1 : 0;
    return bOver - aOver;
  });

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <CreateBudgetDialog categories={availableCategories} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("totalBudget")} value={formatCurrency(totalBudget * rate, code)} icon={Wallet} />
        <KpiCard label={spentLabel} value={formatCurrency(totalSpent * rate, code)} icon={PiggyBank} />
        <KpiCard
          label={t("respected")}
          value={t("respectedValue", { respected: respectedCount, total: budgets.length })}
          icon={CheckCircle2}
        />
        <KpiCard label={t("totalOverage")} value={formatCurrency(totalOverage * rate, code)} icon={AlertTriangle} />
      </div>

      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedBudgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              history={history[budget.categoryId]}
              averageSpend={averageSpend[budget.categoryId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
