"use server";

import * as demo from "./demo/actions";
import { isDemoMode } from "./env";
import * as real from "./actions.real";
import type { CategoryUseCase, TransactionFilters } from "./types";

// Selects between the real (Postgres-backed) and demo (in-memory fixture)
// implementations based on DEMO_MODE - mirrors lib/data.ts.

export async function createCategory(input: { name: string; color: string | null; parentId: number | null }): Promise<void> {
  return isDemoMode ? demo.createCategory(input) : real.createCategory(input);
}

export async function deleteCategory(categoryId: number): Promise<void> {
  return isDemoMode ? demo.deleteCategory(categoryId) : real.deleteCategory(categoryId);
}

export async function renameCategory(categoryId: number, name: string): Promise<void> {
  return isDemoMode ? demo.renameCategory(categoryId, name) : real.renameCategory(categoryId, name);
}

export async function addTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  return isDemoMode ? demo.addTransactionCategory(rowId, categoryId) : real.addTransactionCategory(rowId, categoryId);
}

export async function removeTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  return isDemoMode
    ? demo.removeTransactionCategory(rowId, categoryId)
    : real.removeTransactionCategory(rowId, categoryId);
}

export async function addCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  return isDemoMode ? demo.addCategoryUseCase(useCase, categoryId) : real.addCategoryUseCase(useCase, categoryId);
}

export async function removeCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  return isDemoMode
    ? demo.removeCategoryUseCase(useCase, categoryId)
    : real.removeCategoryUseCase(useCase, categoryId);
}

export async function acceptPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  return isDemoMode
    ? demo.acceptPredictedCategory(rowId, categoryId)
    : real.acceptPredictedCategory(rowId, categoryId);
}

export async function rejectPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  return isDemoMode
    ? demo.rejectPredictedCategory(rowId, categoryId)
    : real.rejectPredictedCategory(rowId, categoryId);
}

export async function createAsset(input: {
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
}): Promise<number> {
  return isDemoMode ? demo.createAsset(input) : real.createAsset(input);
}

export async function updateAssetDetails(
  assetId: number,
  input: { name: string; type: string; notes: string | null },
): Promise<void> {
  return isDemoMode ? demo.updateAssetDetails(assetId, input) : real.updateAssetDetails(assetId, input);
}

export async function addAssetValue(assetId: number, value: number, valueCurrency: string): Promise<void> {
  return isDemoMode ? demo.addAssetValue(assetId, value, valueCurrency) : real.addAssetValue(assetId, value, valueCurrency);
}

export async function deleteAsset(assetId: number): Promise<void> {
  return isDemoMode ? demo.deleteAsset(assetId) : real.deleteAsset(assetId);
}

export async function createSavingsGoal(input: {
  name: string;
  targetAmount: number;
  targetDate: string | null;
  notes: string | null;
  source: string;
  period: string;
  categoryId: number | null;
  accountInternalId: string | null;
  value: number;
  valueCurrency: string;
}): Promise<number> {
  return isDemoMode ? demo.createSavingsGoal(input) : real.createSavingsGoal(input);
}

export async function updateSavingsGoalDetails(
  goalId: number,
  input: {
    name: string;
    targetAmount: number;
    targetDate: string | null;
    notes: string | null;
    source: string;
    period: string;
    categoryId: number | null;
    accountInternalId: string | null;
  },
): Promise<void> {
  return isDemoMode ? demo.updateSavingsGoalDetails(goalId, input) : real.updateSavingsGoalDetails(goalId, input);
}

export async function addSavingsGoalValue(goalId: number, value: number, valueCurrency: string): Promise<void> {
  return isDemoMode
    ? demo.addSavingsGoalValue(goalId, value, valueCurrency)
    : real.addSavingsGoalValue(goalId, value, valueCurrency);
}

export async function deleteSavingsGoal(goalId: number): Promise<void> {
  return isDemoMode ? demo.deleteSavingsGoal(goalId) : real.deleteSavingsGoal(goalId);
}

export async function createDebt(input: {
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
}): Promise<number> {
  return isDemoMode ? demo.createDebt(input) : real.createDebt(input);
}

export async function updateDebtDetails(
  debtId: number,
  input: { name: string; type: string; notes: string | null },
): Promise<void> {
  return isDemoMode ? demo.updateDebtDetails(debtId, input) : real.updateDebtDetails(debtId, input);
}

export async function addDebtValue(debtId: number, value: number, valueCurrency: string): Promise<void> {
  return isDemoMode ? demo.addDebtValue(debtId, value, valueCurrency) : real.addDebtValue(debtId, value, valueCurrency);
}

export async function deleteDebt(debtId: number): Promise<void> {
  return isDemoMode ? demo.deleteDebt(debtId) : real.deleteDebt(debtId);
}

export async function setCashOnHand(value: number, valueCurrency: string): Promise<void> {
  return isDemoMode ? demo.setCashOnHand(value, valueCurrency) : real.setCashOnHand(value, valueCurrency);
}

export async function setVoucherOnHand(value: number, valueCurrency: string): Promise<void> {
  return isDemoMode ? demo.setVoucherOnHand(value, valueCurrency) : real.setVoucherOnHand(value, valueCurrency);
}

export async function setBudget(categoryId: number, amount: number): Promise<void> {
  return isDemoMode ? demo.setBudget(categoryId, amount) : real.setBudget(categoryId, amount);
}

export async function deleteBudget(budgetId: number): Promise<void> {
  return isDemoMode ? demo.deleteBudget(budgetId) : real.deleteBudget(budgetId);
}

export async function setDateRangeCookie(from: string | null, to: string | null): Promise<void> {
  return isDemoMode ? demo.setDateRangeCookie(from, to) : real.setDateRangeCookie(from, to);
}

export async function setTransactionFiltersCookie(filters: TransactionFilters): Promise<void> {
  return isDemoMode ? demo.setTransactionFiltersCookie(filters) : real.setTransactionFiltersCookie(filters);
}

export async function setDisplayCurrencyCookie(code: string): Promise<void> {
  return isDemoMode ? demo.setDisplayCurrencyCookie(code) : real.setDisplayCurrencyCookie(code);
}

export async function setLocaleCookie(locale: string): Promise<void> {
  return isDemoMode ? demo.setLocaleCookie(locale) : real.setLocaleCookie(locale);
}

export async function createCredentialExchangeRequest(): Promise<{ passphrase: string; expiresAt: string }> {
  return isDemoMode ? demo.createCredentialExchangeRequest() : real.createCredentialExchangeRequest();
}

export async function submitCredentialPayload(payload: string): Promise<void> {
  return isDemoMode ? demo.submitCredentialPayload(payload) : real.submitCredentialPayload(payload);
}

export async function completeOnboarding(): Promise<void> {
  return isDemoMode ? demo.completeOnboarding() : real.completeOnboarding();
}

export async function deleteAccount(): Promise<void> {
  return isDemoMode ? demo.deleteAccount() : real.deleteAccount();
}

export async function requestSync(): Promise<void> {
  return isDemoMode ? demo.requestSync() : real.requestSync();
}
