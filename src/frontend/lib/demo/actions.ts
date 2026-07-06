"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ASSET_TYPES } from "../asset-types";
import { ALL_TIME_SENTINEL, RANGE_COOKIE_NAME } from "../date-range";
import { DEBT_TYPES } from "../debt-types";
import { DISPLAY_CURRENCY_COOKIE } from "../display-currency";
import { LOCALE_COOKIE } from "../../i18n/request";
import { serverError } from "../server-error";
import { FILTERS_COOKIE_NAME } from "../transaction-filters";
import type { CategoryUseCase, TransactionFilters } from "../types";
import {
  allocAssetId,
  allocBudgetId,
  allocCategoryId,
  allocDebtId,
  allocSavingsGoalId,
  assetDefs,
  assetValues,
  budgetDefs,
  cashValues,
  categoryDefs,
  categoryUseCases,
  debtDefs,
  debtValues,
  findCategory,
  savingsGoalDefs,
  savingsGoalValues,
  transactions,
  voucherValues,
} from "./fixtures";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ASSET_TYPE_VALUES = new Set(ASSET_TYPES.map((type) => type.value));
const DEBT_TYPE_VALUES = new Set(DEBT_TYPES.map((type) => type.value));
const CATEGORY_USE_CASE_VALUES = new Set<CategoryUseCase>(["income_forecast", "income_exclude", "savings"]);

export async function createCategory(input: { name: string; color: string | null; parentId: number | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw await serverError("categoryNameRequired");
  if (input.color && !HEX_COLOR_RE.test(input.color)) throw await serverError("invalidColor");
  if (input.parentId !== null && !findCategory(input.parentId)) throw await serverError("invalidParentCategory");

  const siblingName = categoryDefs.some((c) => c.parentId === input.parentId && c.name === name);
  if (siblingName) throw await serverError("duplicateCategoryName");

  categoryDefs.push({
    id: allocCategoryId(),
    parentId: input.parentId,
    name,
    color: input.parentId === null ? input.color : null,
  });
  revalidatePath("/", "layout");
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const index = categoryDefs.findIndex((c) => c.id === categoryId);
  if (index !== -1) categoryDefs.splice(index, 1);
  for (const t of transactions) {
    t.categories = t.categories.filter((c) => c.id !== categoryId);
    t.predictedCategories = t.predictedCategories.filter((c) => c.id !== categoryId);
  }
  revalidatePath("/", "layout");
}

export async function renameCategory(categoryId: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw await serverError("categoryNameRequired");
  const category = findCategory(categoryId);
  if (!category) throw await serverError("invalidCategory");
  if (categoryDefs.some((c) => c.id !== categoryId && c.parentId === category.parentId && c.name === trimmed)) {
    throw await serverError("duplicateCategoryName");
  }
  category.name = trimmed;
  revalidatePath("/", "layout");
}

export async function addTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  const transaction = transactions.find((t) => t.rowId === rowId);
  const category = findCategory(categoryId);
  if (!transaction || !category) throw await serverError("invalidTransactionOrCategory");
  if (!transaction.categories.some((c) => c.id === categoryId)) {
    transaction.categories.push({ id: category.id, name: category.name, color: category.color ?? "#94a3b8" });
  }
  transaction.predictedCategories = [];
  revalidatePath("/", "layout");
}

export async function removeTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  const transaction = transactions.find((t) => t.rowId === rowId);
  if (!transaction) throw await serverError("invalidTransactionOrCategory");
  transaction.categories = transaction.categories.filter((c) => c.id !== categoryId);
  revalidatePath("/", "layout");
}

export async function addCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  if (!CATEGORY_USE_CASE_VALUES.has(useCase)) throw await serverError("invalidUseCase");
  if (!findCategory(categoryId)) throw await serverError("invalidCategory");
  if (!categoryUseCases.some((uc) => uc.useCase === useCase && uc.categoryId === categoryId)) {
    categoryUseCases.push({ useCase, categoryId });
  }
  revalidatePath("/", "layout");
}

export async function removeCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  if (!CATEGORY_USE_CASE_VALUES.has(useCase)) throw await serverError("invalidUseCase");
  const index = categoryUseCases.findIndex((uc) => uc.useCase === useCase && uc.categoryId === categoryId);
  if (index !== -1) categoryUseCases.splice(index, 1);
  revalidatePath("/", "layout");
}

export async function acceptPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  const transaction = transactions.find((t) => t.rowId === rowId);
  const category = findCategory(categoryId);
  if (!transaction || !category) throw await serverError("invalidTransactionOrCategory");
  if (!transaction.categories.some((c) => c.id === categoryId)) {
    transaction.categories.push({ id: category.id, name: category.name, color: category.color ?? "#94a3b8" });
  }
  transaction.predictedCategories = transaction.predictedCategories.filter((c) => c.id !== categoryId);
  revalidatePath("/", "layout");
}

export async function rejectPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  const transaction = transactions.find((t) => t.rowId === rowId);
  if (!transaction) throw await serverError("invalidTransactionOrCategory");
  transaction.predictedCategories = transaction.predictedCategories.filter((c) => c.id !== categoryId);
  revalidatePath("/", "layout");
}

export async function createAsset(input: { name: string; type: string; notes: string | null; value: number; valueCurrency: string }): Promise<number> {
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!ASSET_TYPE_VALUES.has(input.type)) throw await serverError("invalidType");
  if (!Number.isFinite(input.value) || input.value < 0) throw await serverError("invalidValue");

  const id = allocAssetId();
  assetDefs.push({ id, name, type: input.type, notes: input.notes?.trim() || null });
  assetValues.push({ assetId: id, value: input.value, valueCurrency: input.valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
  return id;
}

export async function updateAssetDetails(assetId: number, input: { name: string; type: string; notes: string | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!ASSET_TYPE_VALUES.has(input.type)) throw await serverError("invalidType");
  const asset = assetDefs.find((a) => a.id === assetId);
  if (!asset) throw await serverError("invalidAsset");
  asset.name = name;
  asset.type = input.type;
  asset.notes = input.notes?.trim() || null;
  revalidatePath("/", "layout");
}

export async function addAssetValue(assetId: number, value: number, valueCurrency: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw await serverError("invalidValue");
  if (!assetDefs.some((a) => a.id === assetId)) throw await serverError("invalidAsset");
  assetValues.push({ assetId, value, valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function deleteAsset(assetId: number): Promise<void> {
  const index = assetDefs.findIndex((a) => a.id === assetId);
  if (index !== -1) assetDefs.splice(index, 1);
  for (let i = assetValues.length - 1; i >= 0; i--) {
    if (assetValues[i].assetId === assetId) assetValues.splice(i, 1);
  }
  revalidatePath("/", "layout");
}

const SAVINGS_GOAL_SOURCES = new Set(["manual", "category", "account"]);

async function resolveSavingsGoalSource(
  source: string,
  period: string,
  categoryId: number | null,
  accountInternalId: string | null,
): Promise<{ period: "once" | "monthly" | "yearly"; categoryId: number | null; accountInternalId: string | null }> {
  if (!SAVINGS_GOAL_SOURCES.has(source)) throw await serverError("invalidTrackingType");
  if (source === "manual") return { period: "once", categoryId: null, accountInternalId: null };
  if (source === "category") {
    if (period !== "monthly" && period !== "yearly") throw await serverError("invalidPeriod");
    if (categoryId === null) throw await serverError("categoryRequiredForRecurring");
    if (!findCategory(categoryId)) throw await serverError("invalidCategory");
    return { period, categoryId, accountInternalId };
  }
  if (accountInternalId === null) throw await serverError("accountRequiredForGoal");
  return { period: "once", categoryId: null, accountInternalId };
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
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) throw await serverError("invalidTargetAmount");
  const resolved = await resolveSavingsGoalSource(input.source, input.period, input.categoryId, input.accountInternalId);
  const isManual = input.source === "manual";
  if (isManual && (!Number.isFinite(input.value) || input.value < 0)) throw await serverError("invalidValue");

  const id = allocSavingsGoalId();
  savingsGoalDefs.push({
    id,
    name,
    targetAmount: input.targetAmount,
    targetDate: isManual ? input.targetDate : null,
    notes: input.notes?.trim() || null,
    period: resolved.period,
    categoryId: resolved.categoryId,
    accountInternalId: resolved.accountInternalId,
  });
  if (isManual) {
    savingsGoalValues.push({ savingsGoalId: id, value: input.value, valueCurrency: input.valueCurrency, valuedAt: new Date().toISOString() });
  }
  revalidatePath("/", "layout");
  return id;
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
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) throw await serverError("invalidTargetAmount");
  const resolved = await resolveSavingsGoalSource(input.source, input.period, input.categoryId, input.accountInternalId);
  const isManual = input.source === "manual";

  const goal = savingsGoalDefs.find((g) => g.id === goalId);
  if (!goal) throw await serverError("invalidGoal");
  goal.name = name;
  goal.targetAmount = input.targetAmount;
  goal.targetDate = isManual ? input.targetDate : null;
  goal.notes = input.notes?.trim() || null;
  goal.period = resolved.period;
  goal.categoryId = resolved.categoryId;
  goal.accountInternalId = resolved.accountInternalId;
  revalidatePath("/", "layout");
}

export async function addSavingsGoalValue(goalId: number, value: number, valueCurrency: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw await serverError("invalidValue");
  if (!savingsGoalDefs.some((g) => g.id === goalId)) throw await serverError("invalidGoal");
  savingsGoalValues.push({ savingsGoalId: goalId, value, valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function deleteSavingsGoal(goalId: number): Promise<void> {
  const index = savingsGoalDefs.findIndex((g) => g.id === goalId);
  if (index !== -1) savingsGoalDefs.splice(index, 1);
  for (let i = savingsGoalValues.length - 1; i >= 0; i--) {
    if (savingsGoalValues[i].savingsGoalId === goalId) savingsGoalValues.splice(i, 1);
  }
  revalidatePath("/", "layout");
}

export async function createDebt(input: { name: string; type: string; notes: string | null; value: number; valueCurrency: string }): Promise<number> {
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!DEBT_TYPE_VALUES.has(input.type)) throw await serverError("invalidType");
  if (!Number.isFinite(input.value) || input.value < 0) throw await serverError("invalidValue");

  const id = allocDebtId();
  debtDefs.push({ id, name, type: input.type, notes: input.notes?.trim() || null });
  debtValues.push({ debtId: id, value: input.value, valueCurrency: input.valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
  return id;
}

export async function updateDebtDetails(debtId: number, input: { name: string; type: string; notes: string | null }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw await serverError("nameRequired");
  if (!DEBT_TYPE_VALUES.has(input.type)) throw await serverError("invalidType");
  const debt = debtDefs.find((d) => d.id === debtId);
  if (!debt) throw await serverError("invalidDebt");
  debt.name = name;
  debt.type = input.type;
  debt.notes = input.notes?.trim() || null;
  revalidatePath("/", "layout");
}

export async function addDebtValue(debtId: number, value: number, valueCurrency: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw await serverError("invalidValue");
  if (!debtDefs.some((d) => d.id === debtId)) throw await serverError("invalidDebt");
  debtValues.push({ debtId, value, valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function deleteDebt(debtId: number): Promise<void> {
  const index = debtDefs.findIndex((d) => d.id === debtId);
  if (index !== -1) debtDefs.splice(index, 1);
  for (let i = debtValues.length - 1; i >= 0; i--) {
    if (debtValues[i].debtId === debtId) debtValues.splice(i, 1);
  }
  revalidatePath("/", "layout");
}

export async function setCashOnHand(value: number, valueCurrency: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw await serverError("invalidValue");
  cashValues.push({ value, valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function setVoucherOnHand(value: number, valueCurrency: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) throw await serverError("invalidValue");
  voucherValues.push({ value, valueCurrency, valuedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function setBudget(categoryId: number, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw await serverError("invalidAmount");
  if (!findCategory(categoryId)) throw await serverError("invalidCategory");

  const existing = budgetDefs.find((b) => b.categoryId === categoryId);
  if (existing) {
    existing.amount = amount;
  } else {
    budgetDefs.push({ id: allocBudgetId(), categoryId, amount });
  }
  revalidatePath("/", "layout");
}

export async function deleteBudget(budgetId: number): Promise<void> {
  const index = budgetDefs.findIndex((b) => b.id === budgetId);
  if (index !== -1) budgetDefs.splice(index, 1);
  revalidatePath("/", "layout");
}

export async function setDateRangeCookie(from: string | null, to: string | null): Promise<void> {
  const store = await cookies();
  store.set(RANGE_COOKIE_NAME, from && to ? `${from}|${to}` : ALL_TIME_SENTINEL, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function setTransactionFiltersCookie(filters: TransactionFilters): Promise<void> {
  const store = await cookies();
  store.set(FILTERS_COOKIE_NAME, JSON.stringify(filters), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function setDisplayCurrencyCookie(code: string): Promise<void> {
  const store = await cookies();
  store.set(DISPLAY_CURRENCY_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function setLocaleCookie(locale: string): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function createCredentialExchangeRequest(): Promise<{ passphrase: string; expiresAt: string }> {
  throw await serverError("demoDisabled");
}

export async function submitCredentialPayload(_payload: string): Promise<void> {
  throw await serverError("demoDisabled");
}

export async function completeOnboarding(): Promise<void> {
  // The demo user is always pre-onboarded (see fixtures.onboardedAt).
}

export async function deleteAccount(): Promise<void> {
  throw await serverError("demoDisabled");
}

export async function requestSync(): Promise<void> {
  throw await serverError("demoDisabled");
}
