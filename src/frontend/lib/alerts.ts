import "server-only";

import { addMonths, subMonths } from "date-fns";
import { getTranslations } from "next-intl/server";

import { getAccounts, getBudgets, getCategorySpendingEvolution, getDismissedAlertKeys } from "./data";
import { getDisplayCurrency } from "./display-currency";
import { bucketStart } from "./evolution-buckets";
import { formatCurrency } from "./format";
import { getLowBalanceThreshold } from "./low-balance-threshold";
import type { Alert } from "./types";

// A category's current month has to beat its trailing average by this
// ratio *and* by this absolute amount to alert - the ratio alone would
// flag e.g. a 8EUR->20EUR blip on a barely-used category every month.
const UNUSUAL_SPENDING_RATIO = 1.5;
const UNUSUAL_SPENDING_MIN_DELTA = 30;

// Recomputed live on every page load (see layout.tsx) from data that's
// already fetched elsewhere in the app - never persisted, so there's
// nothing to keep in sync when the underlying budgets/accounts/spending
// change between loads.
export async function getActiveAlerts(userId: number): Promise<Alert[]> {
  const t = await getTranslations("alerts");
  const { code, rate } = await getDisplayCurrency();
  const money = (amount: number) => formatCurrency(amount * rate, code);

  const now = new Date();
  const currentMonthStart = bucketStart(now, "month");

  const [budgets, accounts, lowBalanceThreshold, spendingEvolution, dismissedKeys] = await Promise.all([
    getBudgets(userId),
    getAccounts(userId),
    getLowBalanceThreshold(),
    getCategorySpendingEvolution(
      userId,
      { from: subMonths(currentMonthStart, 3), to: addMonths(currentMonthStart, 1) },
      "month",
      false,
    ),
    getDismissedAlertKeys(userId),
  ]);

  const alerts: Alert[] = [];

  for (const budget of budgets) {
    if (budget.spent <= budget.amount) continue;
    const key = `budget:${budget.categoryId}`;
    if (dismissedKeys.has(key)) continue;
    alerts.push({
      type: "budgetExceeded",
      key,
      severity: "warning",
      title: t("budgetExceeded.title", { category: budget.categoryName }),
      description: t("budgetExceeded.description", { amount: money(budget.spent - budget.amount) }),
      href: "/budgets",
    });
  }

  for (const account of accounts) {
    if (account.type !== "current") continue;
    if (account.amount >= lowBalanceThreshold) continue;
    const key = `balance:${account.internalId}`;
    if (dismissedKeys.has(key)) continue;
    alerts.push({
      type: "lowBalance",
      key,
      severity: account.amount < 0 ? "critical" : "warning",
      title: t("lowBalance.title", { account: account.label }),
      description: t("lowBalance.description", { amount: money(account.amount) }),
      href: `/accounts/${account.internalId}`,
    });
  }

  // Last of the 4 monthly points is the current (in-progress) month; the
  // first 3 are its trailing baseline. "others"/"uncategorized" are folded
  // rollups, not a single actionable category, so they're skipped here.
  const points = spendingEvolution.points;
  if (points.length === 4) {
    const current = points[3];
    const previous = points.slice(0, 3);
    for (const series of spendingEvolution.series) {
      if (series.key === "others" || series.key === "uncategorized") continue;
      const key = `spending:${series.key}`;
      if (dismissedKeys.has(key)) continue;
      const currentValue = Number(current[series.key] ?? 0);
      const previousValues = previous.map((point) => Number(point[series.key] ?? 0));
      const previousAvg = previousValues.reduce((sum, v) => sum + v, 0) / previousValues.length;
      if (previousAvg <= 0) continue;
      const delta = currentValue - previousAvg;
      if (currentValue < previousAvg * UNUSUAL_SPENDING_RATIO || delta < UNUSUAL_SPENDING_MIN_DELTA) continue;
      alerts.push({
        type: "unusualSpending",
        key,
        severity: "warning",
        title: t("unusualSpending.title", { category: series.label }),
        description: t("unusualSpending.description", { current: money(currentValue), average: money(previousAvg) }),
        href: "/insights",
      });
    }
  }

  return alerts;
}
