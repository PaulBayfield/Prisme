import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";

import { AnnualReportDocument } from "@/components/reports/annual-report-document";
import {
  getAccounts,
  getCategoryIncomeBreakdown,
  getCategorySpendingBreakdown,
  getCategoryUseCases,
  getCombinedBalanceHistory,
  getCurrentUserId,
  getIncomeAndSavingsTotals,
  getMonthlyIncomeExpense,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getFullYear();
  const range = { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };

  const userId = await getCurrentUserId();
  const categoryUseCases = await getCategoryUseCases(userId);
  const savingsCategoryIds = categoryUseCases.savings.map((category) => category.id);

  const [
    expenseCategories,
    incomeCategories,
    balanceHistory,
    { income: totalIncome, savings: totalSavings },
    monthlyData,
    accounts,
  ] = await Promise.all([
    getCategorySpendingBreakdown(userId, range, true, undefined, savingsCategoryIds),
    getCategoryIncomeBreakdown(userId, range, true),
    getCombinedBalanceHistory(userId, range),
    getIncomeAndSavingsTotals(userId, range),
    getMonthlyIncomeExpense(userId, range),
    getAccounts(userId),
  ]);

  const totalExpenses = expenseCategories.reduce((sum, category) => sum + category.amount, 0);
  const startBalance = balanceHistory[0]?.balance ?? 0;
  const endBalance = balanceHistory[balanceHistory.length - 1]?.balance ?? 0;

  const buffer = await renderToBuffer(
    <AnnualReportDocument
      year={year}
      totalIncome={totalIncome}
      totalExpenses={totalExpenses}
      totalSavings={totalSavings}
      startBalance={startBalance}
      endBalance={endBalance}
      expenseCategories={expenseCategories}
      incomeCategories={incomeCategories}
      monthlyData={monthlyData}
      accounts={accounts}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bilan-annuel-${year}.pdf"`,
    },
  });
}
