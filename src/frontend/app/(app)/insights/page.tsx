import { getTranslations } from "next-intl/server";

import { CategoryEvolutionChart } from "@/components/category-evolution-chart";
import { CategoryPieChart } from "@/components/category-pie-chart";
import { CategorySankeyChart } from "@/components/category-sankey-chart";
import { CategoryTreemapChart } from "@/components/category-treemap-chart";
import { ComparisonCard } from "@/components/comparison-card";
import { DetailedModeToggle } from "@/components/detailed-mode-toggle";
import { EvolutionGranularityToggle } from "@/components/evolution-granularity-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { defaultGranularityForRange } from "@/lib/evolution-buckets";
import { IncomeForecastCard } from "@/components/income-forecast-card";
import {
  getCategoryIncomeBreakdown,
  getCategorySpendingBreakdown,
  getCategorySpendingEvolution,
  getCurrentUserId,
  getExpenseComparisons,
  getIncomeComparisons,
  getIncomeExpenseFlow,
  getSavingsComparison,
  getIncomePrediction,
} from "@/lib/data";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";
import type { EvolutionGranularity } from "@/lib/types";

const GRANULARITIES: EvolutionGranularity[] = ["day", "week", "month", "year"];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ detailed?: string; granularity?: string }>;
}) {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const params = await searchParams;
  const detailed = params.detailed === "true";
  // Auto-picked from the active date range's span (e.g. "Ce mois-ci" starts
  // on "week") unless the user has explicitly overridden it via the toggle.
  const granularity = GRANULARITIES.includes(params.granularity as EvolutionGranularity)
    ? (params.granularity as EvolutionGranularity)
    : defaultGranularityForRange(range.from, range.to);
  const filters = await getTransactionFiltersFromCookies();

  const [
    expenses,
    income,
    flow,
    expenseEvolution,
    expenseComparisons,
    incomeComparisons,
    savingsComparison,
    incomePrediction,
  ] = await Promise.all([
    getCategorySpendingBreakdown(userId, range, detailed, filters),
    getCategoryIncomeBreakdown(userId, range, detailed, filters),
    getIncomeExpenseFlow(userId, range, detailed, filters),
    getCategorySpendingEvolution(userId, range, granularity, detailed, filters),
    getExpenseComparisons(userId),
    getIncomeComparisons(userId),
    getSavingsComparison(userId),
    getIncomePrediction(userId),
  ]);

  const t = await getTranslations("insights");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("thisMonth")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComparisonCard
            label={t("expenses")}
            current={expenseComparisons.monthly.current}
            previous={expenseComparisons.monthly.previous}
            previousLabel={t("lastMonth")}
            polarity="good-down"
          />
          <ComparisonCard
            label={t("income")}
            current={incomeComparisons.monthly.current}
            previous={incomeComparisons.monthly.previous}
            previousLabel={t("lastMonth")}
            polarity="good-up"
          />
          <ComparisonCard
            label={t("savings")}
            current={savingsComparison.current}
            previous={savingsComparison.previous}
            previousLabel={t("lastMonth")}
            polarity="good-up"
          />
        </div>
        {incomePrediction ? <IncomeForecastCard prediction={incomePrediction} /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("thisYear")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ComparisonCard
            label={t("expenses")}
            current={expenseComparisons.yearly.current}
            previous={expenseComparisons.yearly.previous}
            previousLabel={t("lastYear")}
            polarity="good-down"
          />
          <ComparisonCard
            label={t("income")}
            current={incomeComparisons.yearly.current}
            previous={incomeComparisons.yearly.previous}
            previousLabel={t("lastYear")}
            polarity="good-up"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("categories")}</h2>
        <DetailedModeToggle detailed={detailed} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("expensesByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={expenses} emptyMessage={t("noExpenses")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("expensesBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTreemapChart data={expenses} emptyMessage={t("noExpenses")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{t("expensesEvolution")}</CardTitle>
          <EvolutionGranularityToggle granularity={granularity} />
        </CardHeader>
        <CardContent>
          <CategoryEvolutionChart
            data={expenseEvolution.points}
            series={expenseEvolution.series}
            granularity={granularity}
            emptyMessage={t("noExpenses")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("incomeByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={income} emptyMessage={t("noIncome")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("incomeBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTreemapChart data={income} emptyMessage={t("noIncome")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("flow")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategorySankeyChart data={flow} emptyMessage={t("noFlow")} />
        </CardContent>
      </Card>
    </div>
  );
}
