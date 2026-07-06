import "server-only";

import { getTranslations } from "next-intl/server";

import type {
  Account,
  AccountBalancePoint,
  Asset,
  AssetValuePoint,
  AssignedCategory,
  Budget,
  CashValuePoint,
  Category,
  CategorySpendingSlice,
  CategoryUseCase,
  DateRange,
  Debt,
  DebtValuePoint,
  IncomePrediction,
  PendingTransaction,
  PeriodComparison,
  SankeyData,
  SankeyNodeDatum,
  SavingsGoal,
  SavingsGoalValuePoint,
  SyncStatus,
  Transaction,
  TransactionFilters,
} from "../types";
import {
  accounts,
  assetDefs,
  assetValues,
  balanceHistory,
  budgetDefs,
  cashValues,
  categoryDefs,
  categoryUseCases,
  childrenMap,
  debtDefs,
  debtValues,
  descendantsOf,
  effectiveColorOf,
  findCategory,
  hasLclCredentials as demoHasLclCredentials,
  onboardedAt as demoOnboardedAt,
  pendingTransactions,
  predictedMonthlyIncome,
  rootOf,
  savingsGoalDefs,
  savingsGoalValues,
  syncRequests,
  transactions,
  voucherValues,
} from "./fixtures";

export const DEMO_USER_ID = 1;

function inRange(iso: string, range?: DateRange): boolean {
  const date = new Date(iso);
  if (range?.from && date < range.from) return false;
  if (range?.to && date >= range.to) return false;
  return true;
}

// Insights (spending/income breakdown, sankey, comparisons, income
// prediction) only ever look at current accounts - a transfer into savings
// or interest earned there isn't spend/income noise. Budgets and
// category-tracked savings goals deliberately don't apply this filter,
// matching lib/data.real.ts.
const currentAccountIds = new Set(accounts.filter((a) => a.type === "current").map((a) => a.internalId));
function isCurrentAccountTxn(t: Transaction): boolean {
  return currentAccountIds.has(t.accountInternalId);
}

function matchesFilters(transaction: Transaction | PendingTransaction, filters?: TransactionFilters): boolean {
  if (!filters) return true;
  if (filters.type === "income" && transaction.amount <= 0) return false;
  if (filters.type === "expense" && transaction.amount >= 0) return false;
  if (filters.accountIds.length && !filters.accountIds.includes(transaction.accountInternalId)) return false;
  if (filters.amountMin !== null && Math.abs(transaction.amount) < filters.amountMin) return false;
  if (filters.amountMax !== null && Math.abs(transaction.amount) > filters.amountMax) return false;
  if (filters.search.trim() && !transaction.label.toLowerCase().includes(filters.search.trim().toLowerCase())) return false;
  if (filters.categoryIds.length) {
    if (!("categories" in transaction)) return false;
    const ids = transaction.categories.map((category) => category.id);
    if (!filters.categoryIds.some((id) => ids.includes(id))) return false;
  }
  return true;
}

export async function getCurrentUserId(): Promise<number> {
  return DEMO_USER_ID;
}

export async function getOnboardingStatus(): Promise<{ onboardedAt: string | null }> {
  return { onboardedAt: demoOnboardedAt };
}

export async function getHasLclCredentials(): Promise<boolean> {
  return demoHasLclCredentials;
}

export async function getLatestSyncStatus(): Promise<SyncStatus | null> {
  return syncRequests[syncRequests.length - 1] ?? null;
}

export async function getSyncRequests(_userId: number, limit = 50): Promise<SyncStatus[]> {
  return [...syncRequests].reverse().slice(0, limit);
}

export async function getAccounts(): Promise<Account[]> {
  return accounts;
}

export async function getAccountById(_userId: number, internalId: string): Promise<Account | undefined> {
  return accounts.find((account) => account.internalId === internalId);
}

// Keeps only the latest snapshot per calendar day, same convention as
// lib/data.real.ts's DISTINCT ON (date_trunc('day', captured_at)) - the
// fixtures replay a balance point per transaction, so a busy day can have
// several.
function latestPerDay(points: AccountBalancePoint[]): AccountBalancePoint[] {
  const byDay = new Map<string, AccountBalancePoint>();
  for (const point of [...points].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))) {
    byDay.set(point.capturedAt.slice(0, 10), point);
  }
  return Array.from(byDay.values()).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function getBalanceHistory(accountInternalId: string): Promise<AccountBalancePoint[]> {
  return latestPerDay(balanceHistory[accountInternalId] ?? []);
}

export async function getTransactions(
  _userId: number,
  accountInternalId?: string,
  range?: DateRange,
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  return transactions
    .filter((t) => (!accountInternalId || t.accountInternalId === accountInternalId))
    .filter((t) => inRange(t.bookingDateTime, range))
    .filter((t) => matchesFilters(t, filters))
    .sort((a, b) => b.bookingDateTime.localeCompare(a.bookingDateTime) || b.rowId - a.rowId);
}

export async function getCategories(): Promise<Category[]> {
  const withRoot = categoryDefs.map((category) => ({ category, root: rootOf(category.id) }));
  withRoot.sort((a, b) => {
    const rootCompare = a.root.name.localeCompare(b.root.name);
    if (rootCompare !== 0) return rootCompare;
    const depthA = a.category.parentId === null ? 0 : 1;
    const depthB = b.category.parentId === null ? 0 : 1;
    if (depthA !== depthB) return depthA - depthB;
    return a.category.name.localeCompare(b.category.name);
  });
  return withRoot.map(({ category }) => ({
    id: category.id,
    parentId: category.parentId,
    name: category.name,
    color: category.color,
    effectiveColor: effectiveColorOf(category.id),
  }));
}

export async function getCategoryUseCases(): Promise<Record<CategoryUseCase, AssignedCategory[]>> {
  const result: Record<CategoryUseCase, AssignedCategory[]> = {
    income_forecast: [],
    income_exclude: [],
    savings: [],
  };
  for (const { useCase, categoryId } of categoryUseCases) {
    const category = findCategory(categoryId);
    if (!category) continue;
    result[useCase].push({ id: category.id, name: category.name, color: effectiveColorOf(category.id) });
  }
  for (const useCase of Object.keys(result) as CategoryUseCase[]) {
    result[useCase].sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

export async function getPendingTransactions(
  _userId: number,
  accountInternalId?: string,
  filters?: TransactionFilters,
): Promise<PendingTransaction[]> {
  if (filters?.categoryIds.length) return [];
  return pendingTransactions
    .filter((t) => !accountInternalId || t.accountInternalId === accountInternalId)
    .filter((t) => matchesFilters(t, filters))
    .sort((a, b) => b.bookingDateTime.localeCompare(a.bookingDateTime));
}

export async function getTotals(): Promise<{ current: number; savings: number; total: number }> {
  const current = accounts.filter((a) => a.type === "current").reduce((sum, a) => sum + a.amount, 0);
  const savings = accounts.filter((a) => a.type === "saving").reduce((sum, a) => sum + a.amount, 0);
  return { current, savings, total: current + savings };
}

const UNCATEGORIZED_COLOR = "#94a3b8";
const MAX_PIE_SLICES = 6;

async function getCategoryAmountBreakdown(
  direction: "expense" | "income",
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  const t = await getTranslations("insights");
  const filtered = transactions
    .filter(isCurrentAccountTxn)
    .filter((txn) => (direction === "expense" ? txn.amount < 0 : txn.amount > 0))
    .filter((txn) => inRange(txn.bookingDateTime, range))
    .filter((txn) => matchesFilters(txn, filters));

  const sliceNames = new Map<string, string>([["uncategorized", t("uncategorized")]]);
  const sliceColors = new Map<string, string>([["uncategorized", UNCATEGORIZED_COLOR]]);
  const pieTotals = new Map<string, number>();

  for (const txn of filtered) {
    const value = Math.abs(txn.amount);
    if (txn.categories.length === 0) {
      pieTotals.set("uncategorized", (pieTotals.get("uncategorized") ?? 0) + value);
      continue;
    }
    const share = value / txn.categories.length;
    for (const assigned of txn.categories) {
      const target = detailed ? assigned : { id: rootOf(assigned.id).id, name: rootOf(assigned.id).name };
      const key = `cat:${target.id}`;
      sliceNames.set(key, target.name);
      sliceColors.set(key, effectiveColorOf(target.id));
      pieTotals.set(key, (pieTotals.get(key) ?? 0) + share);
    }
  }

  const pieAll = Array.from(pieTotals.entries())
    .map(([key, amount]) => ({
      name: sliceNames.get(key) ?? key,
      color: sliceColors.get(key) ?? UNCATEGORIZED_COLOR,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (pieAll.length <= MAX_PIE_SLICES) return pieAll;
  return [
    ...pieAll.slice(0, MAX_PIE_SLICES - 1),
    {
      name: t("others"),
      color: "#cbd5e1",
      amount: Math.round(pieAll.slice(MAX_PIE_SLICES - 1).reduce((sum, s) => sum + s.amount, 0) * 100) / 100,
    },
  ];
}

export async function getCategorySpendingBreakdown(
  _userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  return getCategoryAmountBreakdown("expense", range, detailed, filters);
}

export async function getCategoryIncomeBreakdown(
  _userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  return getCategoryAmountBreakdown("income", range, detailed, filters);
}

const FLOW_TOTAL_KEY = "total";
const FLOW_SAVINGS_KEY = "savings";
const FLOW_INCOME_UNCATEGORIZED_KEY = "income:uncategorized";
const FLOW_EXPENSE_UNCATEGORIZED_KEY = "expense:uncategorized";

export async function getIncomeExpenseFlow(
  _userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<SankeyData> {
  const t = await getTranslations("insights");
  const filtered = transactions
    .filter(isCurrentAccountTxn)
    .filter((txn) => inRange(txn.bookingDateTime, range))
    .filter((txn) => matchesFilters(txn, filters));

  const nodeNames = new Map<string, string>([
    [FLOW_TOTAL_KEY, t("total")],
    [FLOW_SAVINGS_KEY, t("savings")],
    [FLOW_INCOME_UNCATEGORIZED_KEY, t("uncategorizedIncome")],
    [FLOW_EXPENSE_UNCATEGORIZED_KEY, t("uncategorized")],
  ]);
  const nodeColors = new Map<string, string>([
    [FLOW_TOTAL_KEY, "#64748b"],
    [FLOW_SAVINGS_KEY, "#22c55e"],
    [FLOW_INCOME_UNCATEGORIZED_KEY, UNCATEGORIZED_COLOR],
    [FLOW_EXPENSE_UNCATEGORIZED_KEY, UNCATEGORIZED_COLOR],
  ]);
  const incomeTotals = new Map<string, number>();
  const expenseTotals = new Map<string, number>();
  const childTotals = new Map<string, number>();
  const childParent = new Map<string, string>();

  for (const txn of filtered) {
    if (txn.amount === 0) continue;
    const isIncome = txn.amount > 0;
    const value = Math.abs(txn.amount);
    const side = isIncome ? "income" : "expense";
    const totals = isIncome ? incomeTotals : expenseTotals;
    const uncategorizedKey = isIncome ? FLOW_INCOME_UNCATEGORIZED_KEY : FLOW_EXPENSE_UNCATEGORIZED_KEY;

    if (txn.categories.length === 0) {
      totals.set(uncategorizedKey, (totals.get(uncategorizedKey) ?? 0) + value);
      continue;
    }

    const share = value / txn.categories.length;
    for (const assigned of txn.categories) {
      const root = rootOf(assigned.id);
      const rootKey = `${side}:${root.id}`;
      nodeNames.set(rootKey, root.name);
      nodeColors.set(rootKey, effectiveColorOf(root.id));
      totals.set(rootKey, (totals.get(rootKey) ?? 0) + share);

      if (detailed && assigned.id !== root.id) {
        const childKey = `${side}:child:${assigned.id}`;
        nodeNames.set(childKey, assigned.name);
        nodeColors.set(childKey, effectiveColorOf(assigned.id));
        childTotals.set(childKey, (childTotals.get(childKey) ?? 0) + share);
        childParent.set(childKey, rootKey);
      }
    }
  }

  const links: { source: string; target: string; value: number }[] = [];
  const nodeKeys = new Set<string>();

  for (const [key, value] of incomeTotals) {
    if (value <= 0) continue;
    nodeKeys.add(key);
    links.push({ source: key, target: FLOW_TOTAL_KEY, value: Math.round(value * 100) / 100 });
  }
  for (const [key, value] of expenseTotals) {
    if (value <= 0) continue;
    nodeKeys.add(key);
    links.push({ source: FLOW_TOTAL_KEY, target: key, value: Math.round(value * 100) / 100 });
  }
  for (const [childKey, value] of childTotals) {
    if (value <= 0) continue;
    const rootKey = childParent.get(childKey);
    if (!rootKey) continue;
    nodeKeys.add(childKey);
    const roundedValue = Math.round(value * 100) / 100;
    links.push(
      childKey.startsWith("income:")
        ? { source: childKey, target: rootKey, value: roundedValue }
        : { source: rootKey, target: childKey, value: roundedValue },
    );
  }

  const totalIncome = Array.from(incomeTotals.values()).reduce((sum, v) => sum + v, 0);
  const totalExpense = Array.from(expenseTotals.values()).reduce((sum, v) => sum + v, 0);
  const savings = totalIncome - totalExpense;
  if (savings > 0) {
    nodeKeys.add(FLOW_SAVINGS_KEY);
    links.push({ source: FLOW_TOTAL_KEY, target: FLOW_SAVINGS_KEY, value: Math.round(savings * 100) / 100 });
  }

  if (links.length === 0) return { nodes: [], links: [] };

  nodeKeys.add(FLOW_TOTAL_KEY);
  const nodeKeyList = Array.from(nodeKeys);
  const nodeIndex = new Map(nodeKeyList.map((key, index) => [key, index]));

  return {
    nodes: nodeKeyList.map((key) => {
      const isChild = key.includes(":child:");
      let kind: SankeyNodeDatum["kind"];
      if (key === FLOW_TOTAL_KEY) kind = "root";
      else if (key === FLOW_SAVINGS_KEY || key === FLOW_EXPENSE_UNCATEGORIZED_KEY) kind = "leaf";
      else if (key.startsWith("income:")) kind = "source";
      else if (isChild) kind = "leaf";
      else kind = detailed ? "root" : "leaf";
      return { name: nodeNames.get(key) ?? key, color: nodeColors.get(key) ?? UNCATEGORIZED_COLOR, kind };
    }),
    links: links.map((link) => ({
      source: nodeIndex.get(link.source) ?? 0,
      target: nodeIndex.get(link.target) ?? 0,
      value: link.value,
    })),
  };
}

function combinedHistory(series: AccountBalancePoint[][], range?: DateRange): { date: string; balance: number }[] {
  const byDay = new Map<string, number>();
  for (const points of series) {
    for (const point of points) {
      if (!inRange(point.capturedAt, range)) continue;
      const day = point.capturedAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + point.amount);
    }
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date: new Date(date).toISOString(), balance: Math.round(balance * 100) / 100 }));
}

export async function getCombinedBalanceHistory(_userId: number, range?: DateRange): Promise<{ date: string; balance: number }[]> {
  return combinedHistory(Object.values(balanceHistory), range);
}

function mapAsset(def: (typeof assetDefs)[number]): Asset {
  const values = assetValues.filter((v) => v.assetId === def.id).sort((a, b) => b.valuedAt.localeCompare(a.valuedAt));
  const latest = values[0];
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    notes: def.notes,
    value: latest?.value ?? 0,
    valueCurrency: latest?.valueCurrency ?? "EUR",
    valuedAt: latest?.valuedAt ?? new Date(0).toISOString(),
  };
}

export async function getAssets(): Promise<Asset[]> {
  return [...assetDefs].sort((a, b) => a.name.localeCompare(b.name)).map(mapAsset);
}

export async function getAssetById(_userId: number, assetId: number): Promise<Asset | undefined> {
  const def = assetDefs.find((a) => a.id === assetId);
  return def ? mapAsset(def) : undefined;
}

function valueHistory<T extends { value: number; valueCurrency: string; valuedAt: string }>(
  values: T[],
  range?: DateRange,
): AssetValuePoint[] {
  return values
    .filter((v) => inRange(v.valuedAt, range))
    .sort((a, b) => a.valuedAt.localeCompare(b.valuedAt))
    .map((v) => ({ assetId: 0, value: v.value, valueCurrency: v.valueCurrency, valuedAt: v.valuedAt }));
}

export async function getAssetValueHistory(assetId: number): Promise<AssetValuePoint[]> {
  return valueHistory(assetValues.filter((v) => v.assetId === assetId)).map((v) => ({ ...v, assetId }));
}

export async function getTotalAssetsValue(): Promise<number> {
  const assets = await getAssets();
  return assets.reduce((sum, asset) => sum + asset.value, 0);
}

export async function getCombinedAssetValueHistory(_userId: number, range?: DateRange): Promise<{ date: string; balance: number }[]> {
  return combinedLatestPerDay(
    assetDefs.map((d) => d.id),
    assetValues,
    (v) => v.assetId,
    range,
  );
}

function combinedLatestPerDay<T extends { value: number; valuedAt: string }>(
  ids: number[],
  values: T[],
  idOf: (v: T) => number,
  range?: DateRange,
): { date: string; balance: number }[] {
  const changeDays = new Set(
    values.filter((v) => inRange(v.valuedAt, range)).map((v) => v.valuedAt.slice(0, 10)),
  );
  const byId = new Map<number, T[]>();
  for (const id of ids) {
    byId.set(
      id,
      values.filter((v) => idOf(v) === id).sort((a, b) => a.valuedAt.localeCompare(b.valuedAt)),
    );
  }

  return Array.from(changeDays)
    .sort()
    .map((day) => {
      const dayEnd = new Date(`${day}T23:59:59.999`);
      let total = 0;
      let any = false;
      for (const id of ids) {
        const history = byId.get(id) ?? [];
        const asOf = [...history].reverse().find((v) => new Date(v.valuedAt) <= dayEnd);
        if (asOf) {
          total += asOf.value;
          any = true;
        }
      }
      return any ? { date: new Date(day).toISOString(), balance: Math.round(total * 100) / 100 } : null;
    })
    .filter((point): point is { date: string; balance: number } => point !== null);
}

function mapDebt(def: (typeof debtDefs)[number]): Debt {
  const values = debtValues.filter((v) => v.debtId === def.id).sort((a, b) => b.valuedAt.localeCompare(a.valuedAt));
  const latest = values[0];
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    notes: def.notes,
    value: latest?.value ?? 0,
    valueCurrency: latest?.valueCurrency ?? "EUR",
    valuedAt: latest?.valuedAt ?? new Date(0).toISOString(),
  };
}

export async function getDebts(): Promise<Debt[]> {
  return [...debtDefs].sort((a, b) => a.name.localeCompare(b.name)).map(mapDebt);
}

export async function getDebtById(_userId: number, debtId: number): Promise<Debt | undefined> {
  const def = debtDefs.find((d) => d.id === debtId);
  return def ? mapDebt(def) : undefined;
}

export async function getDebtValueHistory(debtId: number): Promise<DebtValuePoint[]> {
  return valueHistory(debtValues.filter((v) => v.debtId === debtId)).map((v) => ({ debtId, value: v.value, valueCurrency: v.valueCurrency, valuedAt: v.valuedAt }));
}

export async function getTotalDebtsValue(): Promise<number> {
  const debts = await getDebts();
  return debts.reduce((sum, debt) => sum + debt.value, 0);
}

export async function getCombinedDebtValueHistory(_userId: number, range?: DateRange): Promise<{ date: string; balance: number }[]> {
  return combinedLatestPerDay(
    debtDefs.map((d) => d.id),
    debtValues,
    (v) => v.debtId,
    range,
  );
}

export async function getCashOnHand(): Promise<CashValuePoint | null> {
  const sorted = [...cashValues].sort((a, b) => b.valuedAt.localeCompare(a.valuedAt));
  return sorted[0] ?? null;
}

export async function getCashHistory(_userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  return [...cashValues].filter((v) => inRange(v.valuedAt, range)).sort((a, b) => a.valuedAt.localeCompare(b.valuedAt));
}

export async function getVoucherOnHand(): Promise<CashValuePoint | null> {
  const sorted = [...voucherValues].sort((a, b) => b.valuedAt.localeCompare(a.valuedAt));
  return sorted[0] ?? null;
}

export async function getVoucherHistory(_userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  return [...voucherValues].filter((v) => inRange(v.valuedAt, range)).sort((a, b) => a.valuedAt.localeCompare(b.valuedAt));
}

export async function getBudgets(_userId: number, range?: DateRange): Promise<Budget[]> {
  if (budgetDefs.length === 0) return [];
  const now = new Date();
  const from = range?.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to = range?.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const childrenOf = childrenMap();

  const spendByCategory = new Map<number, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    if (!inRange(t.bookingDateTime, { from, to })) continue;
    for (const assigned of t.categories) {
      spendByCategory.set(assigned.id, (spendByCategory.get(assigned.id) ?? 0) + Math.abs(t.amount));
    }
  }

  return budgetDefs
    .map((def) => {
      const category = findCategory(def.categoryId);
      if (!category) return null;
      const spent = descendantsOf(category.id, childrenOf).reduce((sum, id) => sum + (spendByCategory.get(id) ?? 0), 0);
      return {
        id: def.id,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: effectiveColorOf(category.id),
        amount: def.amount,
        spent: Math.round(spent * 100) / 100,
      };
    })
    .filter((budget): budget is Budget => budget !== null)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

export async function getIncomePrediction(): Promise<IncomePrediction | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const forecastCategoryIds = new Set(
    categoryUseCases.filter((uc) => uc.useCase === "income_forecast").map((uc) => uc.categoryId),
  );

  const actualSoFar = transactions
    .filter(isCurrentAccountTxn)
    .filter((t) => t.amount > 0 && new Date(t.bookingDateTime) >= monthStart)
    .filter((t) => t.categories.some((c) => forecastCategoryIds.has(c.id)))
    .reduce((sum, t) => sum + t.amount, 0);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedSoFar = Math.round(((predictedMonthlyIncome * now.getDate()) / daysInMonth) * 100) / 100;

  return {
    periodMonth: monthStart.toISOString(),
    predictedAmount: predictedMonthlyIncome,
    actualSoFar: Math.round(actualSoFar * 100) / 100,
    expectedSoFar,
  };
}

function amountTotal(direction: "expense" | "income", start: Date, end: Date, excludeReimbursements: boolean): number {
  const excludeIds = new Set(
    categoryUseCases.filter((uc) => uc.useCase === "income_exclude").map((uc) => uc.categoryId),
  );
  return transactions
    .filter(isCurrentAccountTxn)
    .filter((t) => (direction === "expense" ? t.amount < 0 : t.amount > 0))
    .filter((t) => {
      const date = new Date(t.bookingDateTime);
      return date >= start && date < end;
    })
    .filter((t) => !excludeReimbursements || !t.categories.some((c) => excludeIds.has(c.id)))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

function periodWindows() {
  const now = new Date();
  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    nextMonthStart: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    prevMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    yearStart: new Date(now.getFullYear(), 0, 1),
    nextYearStart: new Date(now.getFullYear() + 1, 0, 1),
    prevYearStart: new Date(now.getFullYear() - 1, 0, 1),
  };
}

export async function getExpenseComparisons(): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  const { monthStart, nextMonthStart, prevMonthStart, yearStart, nextYearStart, prevYearStart } = periodWindows();
  return {
    monthly: {
      current: amountTotal("expense", monthStart, nextMonthStart, false),
      previous: amountTotal("expense", prevMonthStart, monthStart, false),
    },
    yearly: {
      current: amountTotal("expense", yearStart, nextYearStart, false),
      previous: amountTotal("expense", prevYearStart, yearStart, false),
    },
  };
}

export async function getIncomeComparisons(): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  const { monthStart, nextMonthStart, prevMonthStart, yearStart, nextYearStart, prevYearStart } = periodWindows();
  return {
    monthly: {
      current: amountTotal("income", monthStart, nextMonthStart, true),
      previous: amountTotal("income", prevMonthStart, monthStart, true),
    },
    yearly: {
      current: amountTotal("income", yearStart, nextYearStart, true),
      previous: amountTotal("income", prevYearStart, yearStart, true),
    },
  };
}

export async function getSavingsComparison(): Promise<PeriodComparison> {
  const savingsCategoryIds = new Set(
    categoryUseCases.filter((uc) => uc.useCase === "savings").map((uc) => uc.categoryId),
  );
  if (savingsCategoryIds.size === 0) return { current: 0, previous: 0 };

  const { monthStart, nextMonthStart, prevMonthStart } = periodWindows();

  function totalFor(start: Date, end: Date): number {
    let total = 0;
    for (const t of transactions) {
      if (!isCurrentAccountTxn(t)) continue;
      const date = new Date(t.bookingDateTime);
      if (date < start || date >= end) continue;
      if (t.categories.length === 0) continue;
      const savingsCount = t.categories.filter((c) => savingsCategoryIds.has(c.id)).length;
      if (savingsCount === 0) continue;
      total += (Math.abs(t.amount) / t.categories.length) * savingsCount;
    }
    return Math.round(total * 100) / 100;
  }

  return { current: totalFor(monthStart, nextMonthStart), previous: totalFor(prevMonthStart, monthStart) };
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

function currentPeriodRange(period: "monthly" | "yearly"): DateRange {
  const now = new Date();
  if (period === "yearly") {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

function currentPeriodTotal(categoryIds: number[], period: "monthly" | "yearly", accountInternalId: string | null): number {
  const range = currentPeriodRange(period);
  const idSet = new Set(categoryIds);
  return transactions
    .filter((t) => !accountInternalId || t.accountInternalId === accountInternalId)
    .filter((t) => inRange(t.bookingDateTime, range))
    .filter((t) => t.categories.some((c) => idSet.has(c.id)))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

function resolveSavingsGoal(def: (typeof savingsGoalDefs)[number]): SavingsGoal {
  const source: SavingsGoal["source"] = def.categoryId !== null ? "category" : def.accountInternalId !== null ? "account" : "manual";
  const category = def.categoryId !== null ? findCategory(def.categoryId) : undefined;
  const linkedAccount = def.accountInternalId ? accounts.find((a) => a.internalId === def.accountInternalId) : undefined;

  let value = 0;
  let valueCurrency = "EUR";
  let valuedAt = new Date(0).toISOString();

  if (source === "manual") {
    const latest = savingsGoalValues
      .filter((v) => v.savingsGoalId === def.id)
      .sort((a, b) => b.valuedAt.localeCompare(a.valuedAt))[0];
    value = latest?.value ?? 0;
    valueCurrency = latest?.valueCurrency ?? "EUR";
    valuedAt = latest?.valuedAt ?? valuedAt;
  } else if (source === "category") {
    const childrenOf = childrenMap();
    value = currentPeriodTotal(descendantsOf(def.categoryId!, childrenOf), def.period as "monthly" | "yearly", def.accountInternalId);
    valuedAt = new Date().toISOString();
  } else {
    value = linkedAccount?.amount ?? 0;
    valueCurrency = linkedAccount?.amountCurrency ?? "EUR";
    valuedAt = new Date().toISOString();
  }

  return {
    id: def.id,
    name: def.name,
    targetAmount: def.targetAmount,
    targetDate: def.targetDate,
    notes: def.notes,
    period: def.period,
    source,
    categoryId: def.categoryId,
    categoryName: category?.name ?? null,
    accountInternalId: def.accountInternalId,
    accountLabel: linkedAccount?.label ?? null,
    value,
    valueCurrency,
    valuedAt,
  };
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  return [...savingsGoalDefs].sort((a, b) => a.name.localeCompare(b.name)).map(resolveSavingsGoal);
}

export async function getSavingsGoalById(_userId: number, goalId: number): Promise<SavingsGoal | undefined> {
  const def = savingsGoalDefs.find((g) => g.id === goalId);
  return def ? resolveSavingsGoal(def) : undefined;
}

export async function getSavingsGoalValueHistory(goalId: number): Promise<SavingsGoalValuePoint[]> {
  return savingsGoalValues
    .filter((v) => v.savingsGoalId === goalId)
    .sort((a, b) => a.valuedAt.localeCompare(b.valuedAt))
    .map((v) => ({ savingsGoalId: goalId, value: v.value, valueCurrency: v.valueCurrency, valuedAt: v.valuedAt }));
}

export async function getTotalSavingsGoalsValue(): Promise<number> {
  const goals = await getSavingsGoals();
  return goals.reduce((sum, goal) => sum + goal.value, 0);
}
