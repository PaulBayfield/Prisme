import { CategoryPieChart } from "@/components/category-pie-chart";
import { CategorySankeyChart } from "@/components/category-sankey-chart";
import { CategoryTreemapChart } from "@/components/category-treemap-chart";
import { ComparisonCard } from "@/components/comparison-card";
import { DetailedModeToggle } from "@/components/detailed-mode-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { IncomeForecastCard } from "@/components/income-forecast-card";
import {
  getCategoryIncomeBreakdown,
  getCategorySpendingBreakdown,
  getCurrentUserId,
  getExpenseComparisons,
  getIncomeComparisons,
  getIncomeExpenseFlow,
  getSavingsComparison,
  getIncomePrediction,
} from "@/lib/data";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ detailed?: string }>;
}) {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const detailed = (await searchParams).detailed === "true";
  const filters = await getTransactionFiltersFromCookies();

  const [expenses, income, flow, expenseComparisons, incomeComparisons, savingsComparison, incomePrediction] = await Promise.all([
    getCategorySpendingBreakdown(userId, range, detailed, filters),
    getCategoryIncomeBreakdown(userId, range, detailed, filters),
    getIncomeExpenseFlow(userId, range, detailed, filters),
    getExpenseComparisons(userId),
    getIncomeComparisons(userId),
    getSavingsComparison(userId),
    getIncomePrediction(userId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ce mois-ci</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComparisonCard
            label="Dépenses"
            current={expenseComparisons.monthly.current}
            previous={expenseComparisons.monthly.previous}
            previousLabel="Mois dernier"
            polarity="good-down"
          />
          <ComparisonCard
            label="Revenus"
            current={incomeComparisons.monthly.current}
            previous={incomeComparisons.monthly.previous}
            previousLabel="Mois dernier"
            polarity="good-up"
          />
          <ComparisonCard
            label="Épargne"
            current={savingsComparison.current}
            previous={savingsComparison.previous}
            previousLabel="Mois dernier"
            polarity="good-up"
          />
        </div>
        {incomePrediction ? <IncomeForecastCard prediction={incomePrediction} /> : null}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cette année</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ComparisonCard
            label="Dépenses"
            current={expenseComparisons.yearly.current}
            previous={expenseComparisons.yearly.previous}
            previousLabel="Année dernière"
            polarity="good-down"
          />
          <ComparisonCard
            label="Revenus"
            current={incomeComparisons.yearly.current}
            previous={incomeComparisons.yearly.previous}
            previousLabel="Année dernière"
            polarity="good-up"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Catégories</h2>
        <DetailedModeToggle detailed={detailed} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={expenses} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTreemapChart data={expenses} emptyMessage="Pas encore de dépenses catégorisées" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenus par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={income} emptyMessage="Pas encore de revenus catégorisés" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des revenus</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryTreemapChart data={income} emptyMessage="Pas encore de revenus catégorisés" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flux revenus / dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <CategorySankeyChart data={flow} emptyMessage="Pas encore de transactions catégorisées" />
        </CardContent>
      </Card>
    </div>
  );
}
