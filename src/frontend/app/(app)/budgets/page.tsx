import { getTranslations } from "next-intl/server";
import { PiggyBank, Wallet } from "lucide-react";

import { BudgetCard } from "@/components/budget-card";
import { CreateBudgetDialog } from "@/components/create-budget-dialog";
import { KpiCard } from "@/components/kpi-card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { getBudgets, getCategories, getCurrentUserId } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function BudgetsPage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("budgets");
  const [budgets, categories] = await Promise.all([getBudgets(userId, range), getCategories(userId)]);

  const budgetedCategoryIds = new Set(budgets.map((budget) => budget.categoryId));
  const availableCategories = categories.filter((category) => !budgetedCategoryIds.has(category.id));

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const spentLabel = range.from ? t("spentThisPeriod") : t("spentThisMonth");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <CreateBudgetDialog categories={availableCategories} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label={t("totalBudget")} value={formatCurrency(totalBudget * rate, code)} icon={Wallet} />
        <KpiCard label={spentLabel} value={formatCurrency(totalSpent * rate, code)} icon={PiggyBank} />
      </div>

      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  );
}
