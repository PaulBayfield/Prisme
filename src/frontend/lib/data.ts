import "server-only";

import * as demo from "./demo/data";
import { isDemoMode } from "./env";
import * as real from "./data.real";
import type {
  Account,
  AccountBalanceChange,
  AccountBalancePoint,
  Asset,
  AssetValuePoint,
  AssignedCategory,
  Budget,
  BudgetAverageSpend,
  BudgetHistoryPoint,
  CashValuePoint,
  Category,
  CategoryEvolutionData,
  CategorySpendingSlice,
  CategoryUseCase,
  DateRange,
  Debt,
  DebtValuePoint,
  DismissedAlert,
  EvolutionGranularity,
  IgnoredRecurringSeries,
  IncomePrediction,
  MonthlyReportPoint,
  PendingTransaction,
  PeriodComparison,
  RecurringSeries,
  SankeyData,
  SavingsGoal,
  SavingsGoalValuePoint,
  SyncStatus,
  Transaction,
  TransactionFilters,
} from "./types";

// Selects between the real (Postgres-backed) and demo (in-memory fixture)
// implementations based on DEMO_MODE - every function here keeps the exact
// signature callers already use, so this is the only file that needs to know
// demo mode exists at all.

export async function getCurrentUserId(): Promise<number> {
  return isDemoMode ? demo.getCurrentUserId() : real.getCurrentUserId();
}

export async function getOnboardingStatus(userId: number): Promise<{ onboardedAt: string | null }> {
  return isDemoMode ? demo.getOnboardingStatus() : real.getOnboardingStatus(userId);
}

export async function getHasLclCredentials(userId: number): Promise<boolean> {
  return isDemoMode ? demo.getHasLclCredentials() : real.getHasLclCredentials(userId);
}

export async function getLatestSyncStatus(userId: number): Promise<SyncStatus | null> {
  return isDemoMode ? demo.getLatestSyncStatus() : real.getLatestSyncStatus(userId);
}

export async function getSyncRequests(userId: number, limit = 50): Promise<SyncStatus[]> {
  return isDemoMode ? demo.getSyncRequests(userId, limit) : real.getSyncRequests(userId, limit);
}

export async function getAccounts(userId: number): Promise<Account[]> {
  return isDemoMode ? demo.getAccounts() : real.getAccounts(userId);
}

export async function getAccountById(userId: number, internalId: string): Promise<Account | undefined> {
  return isDemoMode ? demo.getAccountById(userId, internalId) : real.getAccountById(userId, internalId);
}

export async function getBalanceHistory(accountInternalId: string): Promise<AccountBalancePoint[]> {
  return isDemoMode ? demo.getBalanceHistory(accountInternalId) : real.getBalanceHistory(accountInternalId);
}

export async function getAccountBalanceChanges(
  userId: number,
  range?: DateRange,
): Promise<Record<string, AccountBalanceChange>> {
  return isDemoMode
    ? demo.getAccountBalanceChanges(userId, range)
    : real.getAccountBalanceChanges(userId, range);
}

export async function getTransactions(
  userId: number,
  accountInternalId?: string,
  range?: DateRange,
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  return isDemoMode
    ? demo.getTransactions(userId, accountInternalId, range, filters)
    : real.getTransactions(userId, accountInternalId, range, filters);
}

export async function getIgnoredRecurringKeys(userId: number): Promise<Set<string>> {
  return isDemoMode ? demo.getIgnoredRecurringKeys(userId) : real.getIgnoredRecurringKeys(userId);
}

export async function getIgnoredRecurringSeries(userId: number): Promise<IgnoredRecurringSeries[]> {
  return isDemoMode ? demo.getIgnoredRecurringSeries(userId) : real.getIgnoredRecurringSeries(userId);
}

export async function getDismissedAlertKeys(userId: number): Promise<Set<string>> {
  return isDemoMode ? demo.getDismissedAlertKeys(userId) : real.getDismissedAlertKeys(userId);
}

export async function getDismissedAlerts(userId: number): Promise<DismissedAlert[]> {
  return isDemoMode ? demo.getDismissedAlerts(userId) : real.getDismissedAlerts(userId);
}

export async function getRecurringTransactions(userId: number): Promise<RecurringSeries[]> {
  return isDemoMode ? demo.getRecurringTransactions(userId) : real.getRecurringTransactions(userId);
}

export async function getCategories(userId: number): Promise<Category[]> {
  return isDemoMode ? demo.getCategories() : real.getCategories(userId);
}

export async function getCategoryUseCases(userId: number): Promise<Record<CategoryUseCase, AssignedCategory[]>> {
  return isDemoMode ? demo.getCategoryUseCases() : real.getCategoryUseCases(userId);
}

export async function getPendingTransactions(
  userId: number,
  accountInternalId?: string,
  filters?: TransactionFilters,
): Promise<PendingTransaction[]> {
  return isDemoMode
    ? demo.getPendingTransactions(userId, accountInternalId, filters)
    : real.getPendingTransactions(userId, accountInternalId, filters);
}

export async function getTotals(userId: number): Promise<{ current: number; savings: number; total: number }> {
  return isDemoMode ? demo.getTotals() : real.getTotals(userId);
}

export async function getCategorySpendingBreakdown(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
  excludeCategoryIds?: number[],
): Promise<CategorySpendingSlice[]> {
  return isDemoMode
    ? demo.getCategorySpendingBreakdown(userId, range, detailed, filters, excludeCategoryIds)
    : real.getCategorySpendingBreakdown(userId, range, detailed, filters, excludeCategoryIds);
}

export async function getCategoryIncomeBreakdown(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  return isDemoMode
    ? demo.getCategoryIncomeBreakdown(userId, range, detailed, filters)
    : real.getCategoryIncomeBreakdown(userId, range, detailed, filters);
}

export async function getCategorySpendingEvolution(
  userId: number,
  range?: DateRange,
  granularity?: EvolutionGranularity,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategoryEvolutionData> {
  return isDemoMode
    ? demo.getCategorySpendingEvolution(userId, range, granularity, detailed, filters)
    : real.getCategorySpendingEvolution(userId, range, granularity, detailed, filters);
}

export async function getIncomeExpenseFlow(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<SankeyData> {
  return isDemoMode
    ? demo.getIncomeExpenseFlow(userId, range, detailed, filters)
    : real.getIncomeExpenseFlow(userId, range, detailed, filters);
}

export async function getCombinedBalanceHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  return isDemoMode ? demo.getCombinedBalanceHistory(userId, range) : real.getCombinedBalanceHistory(userId, range);
}

export async function getAssets(userId: number): Promise<Asset[]> {
  return isDemoMode ? demo.getAssets() : real.getAssets(userId);
}

export async function getAssetById(userId: number, assetId: number): Promise<Asset | undefined> {
  return isDemoMode ? demo.getAssetById(userId, assetId) : real.getAssetById(userId, assetId);
}

export async function getAssetValueHistory(assetId: number): Promise<AssetValuePoint[]> {
  return isDemoMode ? demo.getAssetValueHistory(assetId) : real.getAssetValueHistory(assetId);
}

export async function getTotalAssetsValue(userId: number): Promise<number> {
  return isDemoMode ? demo.getTotalAssetsValue() : real.getTotalAssetsValue(userId);
}

export async function getCombinedAssetValueHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  return isDemoMode
    ? demo.getCombinedAssetValueHistory(userId, range)
    : real.getCombinedAssetValueHistory(userId, range);
}

export async function getSavingsGoals(userId: number): Promise<SavingsGoal[]> {
  return isDemoMode ? demo.getSavingsGoals() : real.getSavingsGoals(userId);
}

export async function getSavingsGoalById(userId: number, goalId: number): Promise<SavingsGoal | undefined> {
  return isDemoMode ? demo.getSavingsGoalById(userId, goalId) : real.getSavingsGoalById(userId, goalId);
}

export async function getSavingsGoalValueHistory(goalId: number): Promise<SavingsGoalValuePoint[]> {
  return isDemoMode ? demo.getSavingsGoalValueHistory(goalId) : real.getSavingsGoalValueHistory(goalId);
}

export async function getTotalSavingsGoalsValue(userId: number): Promise<number> {
  return isDemoMode ? demo.getTotalSavingsGoalsValue() : real.getTotalSavingsGoalsValue(userId);
}

export async function getDebts(userId: number): Promise<Debt[]> {
  return isDemoMode ? demo.getDebts() : real.getDebts(userId);
}

export async function getDebtById(userId: number, debtId: number): Promise<Debt | undefined> {
  return isDemoMode ? demo.getDebtById(userId, debtId) : real.getDebtById(userId, debtId);
}

export async function getDebtValueHistory(debtId: number): Promise<DebtValuePoint[]> {
  return isDemoMode ? demo.getDebtValueHistory(debtId) : real.getDebtValueHistory(debtId);
}

export async function getTotalDebtsValue(userId: number): Promise<number> {
  return isDemoMode ? demo.getTotalDebtsValue() : real.getTotalDebtsValue(userId);
}

export async function getCombinedDebtValueHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  return isDemoMode ? demo.getCombinedDebtValueHistory(userId, range) : real.getCombinedDebtValueHistory(userId, range);
}

export async function getCashOnHand(userId: number): Promise<CashValuePoint | null> {
  return isDemoMode ? demo.getCashOnHand() : real.getCashOnHand(userId);
}

export async function getCashHistory(userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  return isDemoMode ? demo.getCashHistory(userId, range) : real.getCashHistory(userId, range);
}

export async function getVoucherOnHand(userId: number): Promise<CashValuePoint | null> {
  return isDemoMode ? demo.getVoucherOnHand() : real.getVoucherOnHand(userId);
}

export async function getVoucherHistory(userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  return isDemoMode ? demo.getVoucherHistory(userId, range) : real.getVoucherHistory(userId, range);
}

export async function getBudgets(userId: number, range?: DateRange): Promise<Budget[]> {
  return isDemoMode ? demo.getBudgets(userId, range) : real.getBudgets(userId, range);
}

export async function getBudgetHistory(
  userId: number,
  monthsBack?: number,
): Promise<Record<number, BudgetHistoryPoint[]>> {
  return isDemoMode ? demo.getBudgetHistory(userId, monthsBack) : real.getBudgetHistory(userId, monthsBack);
}

export async function getBudgetAverageSpend(
  userId: number,
  range?: DateRange,
): Promise<Record<number, BudgetAverageSpend>> {
  return isDemoMode
    ? demo.getBudgetAverageSpend(userId, range)
    : real.getBudgetAverageSpend(userId, range);
}

export async function getIncomePrediction(userId: number): Promise<IncomePrediction | null> {
  return isDemoMode ? demo.getIncomePrediction() : real.getIncomePrediction(userId);
}

export async function getExpenseComparisons(
  userId: number,
): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  return isDemoMode ? demo.getExpenseComparisons() : real.getExpenseComparisons(userId);
}

export async function getIncomeComparisons(
  userId: number,
): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  return isDemoMode ? demo.getIncomeComparisons() : real.getIncomeComparisons(userId);
}

export async function getSavingsComparison(userId: number): Promise<PeriodComparison> {
  return isDemoMode ? demo.getSavingsComparison() : real.getSavingsComparison(userId);
}

export async function getIncomeAndSavingsTotals(
  userId: number,
  range: { from: Date; to: Date },
): Promise<{ income: number; savings: number }> {
  return isDemoMode
    ? demo.getIncomeAndSavingsTotals(userId, range)
    : real.getIncomeAndSavingsTotals(userId, range);
}

export async function getEarliestTransactionYear(userId: number): Promise<number | null> {
  return isDemoMode ? demo.getEarliestTransactionYear(userId) : real.getEarliestTransactionYear(userId);
}

export async function getMonthlyIncomeExpense(
  userId: number,
  range: { from: Date; to: Date },
): Promise<MonthlyReportPoint[]> {
  return isDemoMode
    ? demo.getMonthlyIncomeExpense(userId, range)
    : real.getMonthlyIncomeExpense(userId, range);
}
