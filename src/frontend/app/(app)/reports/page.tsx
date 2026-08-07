import { getTranslations } from "next-intl/server";
import { Download, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { YearSelect } from "@/components/year-select";
import {
  getCategorySpendingBreakdown,
  getCategoryUseCases,
  getCombinedBalanceHistory,
  getCurrentUserId,
  getEarliestTransactionYear,
  getIncomeAndSavingsTotals,
} from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const userId = await getCurrentUserId();
  const t = await getTranslations("reports");
  const { code, rate } = await getDisplayCurrency();
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : currentYear;

  const [earliestYear, categoryUseCases] = await Promise.all([
    getEarliestTransactionYear(userId),
    getCategoryUseCases(userId),
  ]);
  const firstYear = earliestYear ?? currentYear;
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
  const savingsCategoryIds = categoryUseCases.savings.map((category) => category.id);

  const range = { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  const [expenseCategories, { income: totalIncome, savings: totalSavings }, balanceHistory] = await Promise.all([
    getCategorySpendingBreakdown(userId, range, false, undefined, savingsCategoryIds),
    getIncomeAndSavingsTotals(userId, range),
    getCombinedBalanceHistory(userId, range),
  ]);

  const totalExpenses = expenseCategories.reduce((sum, category) => sum + category.amount, 0);
  const startBalance = balanceHistory[0]?.balance ?? 0;
  const endBalance = balanceHistory[balanceHistory.length - 1]?.balance ?? 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2">
          <YearSelect year={year} years={years} />
          <Button nativeButton={false} render={<a href={`/api/reports/annual?year=${year}`} />}>
            <Download className="size-4" />
            {t("download")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label={t("income")} value={formatCurrency(totalIncome * rate, code)} icon={TrendingUp} />
        <KpiCard label={t("expenses")} value={formatCurrency(totalExpenses * rate, code)} icon={TrendingDown} />
        <KpiCard label={t("netSavings")} value={formatCurrency(totalSavings * rate, code)} icon={Wallet} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label={t("startBalance")} value={formatCurrency(startBalance * rate, code)} icon={Wallet} />
        <KpiCard label={t("endBalance")} value={formatCurrency(endBalance * rate, code)} icon={Wallet} />
      </div>
    </div>
  );
}
