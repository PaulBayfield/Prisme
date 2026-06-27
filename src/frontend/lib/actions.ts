"use server";

import crypto from "node:crypto";

import CryptoJS from "crypto-js";
import LZString from "lz-string";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ASSET_TYPES } from "./asset-types";
import { getCurrentUserId, getHasLclCredentials } from "./data";
import { ALL_TIME_SENTINEL, RANGE_COOKIE_NAME } from "./date-range";
import { DEBT_TYPES } from "./debt-types";
import { pool } from "./db";
import { FILTERS_COOKIE_NAME } from "./transaction-filters";
import type { CategoryUseCase, TransactionFilters } from "./types";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ASSET_TYPE_VALUES = new Set(ASSET_TYPES.map((type) => type.value));
const DEBT_TYPE_VALUES = new Set(DEBT_TYPES.map((type) => type.value));
const CATEGORY_USE_CASE_VALUES = new Set<CategoryUseCase>(["income_forecast", "income_exclude", "savings"]);

export async function createCategory(input: {
  name: string;
  color: string | null;
  parentId: number | null;
}): Promise<void> {
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom de la catégorie est requis");
  }
  if (input.color && !HEX_COLOR_RE.test(input.color)) {
    throw new Error("Couleur invalide");
  }

  if (input.parentId !== null) {
    const { rows } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [
      input.parentId,
      userId,
    ]);
    if (rows.length === 0) {
      throw new Error("Catégorie parente invalide");
    }
  }

  // Sub-categories inherit their parent's color rather than setting their own.
  const color = input.parentId === null ? input.color : null;

  try {
    await pool.query("INSERT INTO categories (user_id, parent_id, name, color) VALUES ($1, $2, $3, $4)", [
      userId,
      input.parentId,
      name,
      color,
    ]);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("Une catégorie avec ce nom existe déjà à cet endroit");
    }
    throw error;
  }
  revalidatePath("/", "layout");
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [categoryId, userId]);
  revalidatePath("/", "layout");
}

export async function renameCategory(categoryId: number, name: string): Promise<void> {
  const userId = await getCurrentUserId();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom de la catégorie est requis");
  }

  try {
    const { rowCount } = await pool.query(
      "UPDATE categories SET name = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
      [trimmed, categoryId, userId],
    );
    if (rowCount === 0) {
      throw new Error("Catégorie invalide");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      throw new Error("Une catégorie avec ce nom existe déjà à cet endroit");
    }
    throw error;
  }
  revalidatePath("/", "layout");
}

async function assertOwnsTransactionAndCategory(
  userId: number,
  rowId: number,
  categoryId: number,
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT
       EXISTS(
         SELECT 1 FROM transactions t
         JOIN account_users au ON au.account_internal_id = t.account_internal_id
         WHERE t.row_id = $1 AND au.user_id = $2
       ) AS owns_transaction,
       EXISTS(SELECT 1 FROM categories WHERE id = $3 AND user_id = $2) AS owns_category`,
    [rowId, userId, categoryId],
  );
  if (!rows[0].owns_transaction || !rows[0].owns_category) {
    throw new Error("Transaction ou catégorie invalide");
  }
}

export async function addTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await assertOwnsTransactionAndCategory(userId, rowId, categoryId);

  await pool.query(
    "INSERT INTO transaction_categories (transaction_row_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [rowId, categoryId],
  );
  // The transaction now has a real category, so any AI suggestions still
  // pending for it (whether this one or others) are moot - the worker would
  // never re-predict for it again anyway now that it's no longer blank, so
  // clear them now rather than leave them stale until rejected by hand.
  await pool.query("DELETE FROM transaction_category_predictions WHERE transaction_row_id = $1", [rowId]);
  revalidatePath("/", "layout");
}

export async function removeTransactionCategory(rowId: number, categoryId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await assertOwnsTransactionAndCategory(userId, rowId, categoryId);

  await pool.query("DELETE FROM transaction_categories WHERE transaction_row_id = $1 AND category_id = $2", [
    rowId,
    categoryId,
  ]);
  revalidatePath("/", "layout");
}

async function assertOwnsCategory(userId: number, categoryId: number): Promise<void> {
  const { rows } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [
    categoryId,
    userId,
  ]);
  if (rows.length === 0) {
    throw new Error("Catégorie invalide");
  }
}

export async function addCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  if (!CATEGORY_USE_CASE_VALUES.has(useCase)) {
    throw new Error("Use case invalide");
  }
  const userId = await getCurrentUserId();
  await assertOwnsCategory(userId, categoryId);

  await pool.query(
    "INSERT INTO category_use_cases (user_id, use_case, category_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [userId, useCase, categoryId],
  );
  revalidatePath("/", "layout");
}

export async function removeCategoryUseCase(useCase: CategoryUseCase, categoryId: number): Promise<void> {
  if (!CATEGORY_USE_CASE_VALUES.has(useCase)) {
    throw new Error("Use case invalide");
  }
  const userId = await getCurrentUserId();

  await pool.query("DELETE FROM category_use_cases WHERE user_id = $1 AND use_case = $2 AND category_id = $3", [
    userId,
    useCase,
    categoryId,
  ]);
  revalidatePath("/", "layout");
}

// Accepting just assigns the suggested category like any other (see
// addTransactionCategory) and consumes the suggestion - transaction_category_
// predictions only ever holds *pending* suggestions, not a permanent record
// of what the AI once said (see schema.sql).
export async function acceptPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await assertOwnsTransactionAndCategory(userId, rowId, categoryId);

  await pool.query(
    "INSERT INTO transaction_categories (transaction_row_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [rowId, categoryId],
  );
  await pool.query(
    "DELETE FROM transaction_category_predictions WHERE transaction_row_id = $1 AND category_id = $2",
    [rowId, categoryId],
  );
  revalidatePath("/", "layout");
}

export async function rejectPredictedCategory(rowId: number, categoryId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await assertOwnsTransactionAndCategory(userId, rowId, categoryId);

  await pool.query(
    "DELETE FROM transaction_category_predictions WHERE transaction_row_id = $1 AND category_id = $2",
    [rowId, categoryId],
  );
  revalidatePath("/", "layout");
}

export async function createAsset(input: {
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
}): Promise<number> {
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!ASSET_TYPE_VALUES.has(input.type)) {
    throw new Error("Type invalide");
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("Valeur invalide");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO assets (user_id, name, type, notes) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, name, input.type, input.notes?.trim() || null],
    );
    const assetId = rows[0].id;
    await client.query(
      "INSERT INTO asset_values (asset_id, value, value_currency) VALUES ($1, $2, $3)",
      [assetId, input.value, input.valueCurrency],
    );
    await client.query("COMMIT");
    revalidatePath("/", "layout");
    return Number(assetId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAssetDetails(
  assetId: number,
  input: { name: string; type: string; notes: string | null },
): Promise<void> {
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!ASSET_TYPE_VALUES.has(input.type)) {
    throw new Error("Type invalide");
  }

  const { rowCount } = await pool.query(
    "UPDATE assets SET name = $1, type = $2, notes = $3, updated_at = now() WHERE id = $4 AND user_id = $5",
    [name, input.type, input.notes?.trim() || null, assetId, userId],
  );
  if (rowCount === 0) {
    throw new Error("Actif invalide");
  }
  revalidatePath("/", "layout");
}

export async function addAssetValue(assetId: number, value: number, valueCurrency: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valeur invalide");
  }

  const { rows } = await pool.query("SELECT 1 FROM assets WHERE id = $1 AND user_id = $2", [
    assetId,
    userId,
  ]);
  if (rows.length === 0) {
    throw new Error("Actif invalide");
  }

  await pool.query("INSERT INTO asset_values (asset_id, value, value_currency) VALUES ($1, $2, $3)", [
    assetId,
    value,
    valueCurrency,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteAsset(assetId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM assets WHERE id = $1 AND user_id = $2", [assetId, userId]);
  revalidatePath("/", "layout");
}

const SAVINGS_GOAL_SOURCES = new Set(["manual", "category", "account"]);

interface ResolvedSavingsGoalSource {
  period: "once" | "monthly" | "yearly";
  categoryId: number | null;
  accountInternalId: string | null;
}

async function assertOwnsAccount(userId: number, accountInternalId: string): Promise<void> {
  const { rows } = await pool.query(
    "SELECT 1 FROM account_users WHERE account_internal_id = $1 AND user_id = $2",
    [accountInternalId, userId],
  );
  if (rows.length === 0) {
    throw new Error("Compte invalide");
  }
}

// Each source implies (and overrides) its own period. "category" and
// "account" aren't mutually exclusive the way they used to be - a category
// goal can optionally also be scoped to one account (e.g. "Restaurants
// spend, monthly, on account A"), accountInternalId just narrows which
// account's transactions count. Only "account" *on its own* (no category)
// means something different: tracking that account's balance directly
// (a level, not a flow), which is why it forces period back to "once".
async function resolveSavingsGoalSource(
  userId: number,
  source: string,
  period: string,
  categoryId: number | null,
  accountInternalId: string | null,
): Promise<ResolvedSavingsGoalSource> {
  if (!SAVINGS_GOAL_SOURCES.has(source)) {
    throw new Error("Type de suivi invalide");
  }

  if (source === "manual") {
    return { period: "once", categoryId: null, accountInternalId: null };
  }

  if (source === "category") {
    if (period !== "monthly" && period !== "yearly") {
      throw new Error("Période invalide");
    }
    if (categoryId === null) {
      throw new Error("Catégorie requise pour un objectif récurrent");
    }
    const { rows } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [
      categoryId,
      userId,
    ]);
    if (rows.length === 0) {
      throw new Error("Catégorie invalide");
    }
    if (accountInternalId !== null) {
      await assertOwnsAccount(userId, accountInternalId);
    }
    return { period, categoryId, accountInternalId };
  }

  // source === "account"
  if (accountInternalId === null) {
    throw new Error("Compte requis pour un objectif lié à un compte");
  }
  await assertOwnsAccount(userId, accountInternalId);
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
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("Montant cible invalide");
  }
  const resolved = await resolveSavingsGoalSource(
    userId,
    input.source,
    input.period,
    input.categoryId,
    input.accountInternalId,
  );
  const isManual = input.source === "manual";
  if (isManual && (!Number.isFinite(input.value) || input.value < 0)) {
    throw new Error("Valeur invalide");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO savings_goals (user_id, name, target_amount, target_date, notes, period, category_id, account_internal_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        userId,
        name,
        input.targetAmount,
        isManual ? input.targetDate : null,
        input.notes?.trim() || null,
        resolved.period,
        resolved.categoryId,
        resolved.accountInternalId,
      ],
    );
    const goalId = rows[0].id;
    // Only manually-tracked goals ever get a snapshot - category/account
    // goals' progress is always computed live (see lib/data.ts
    // resolveSavingsGoals).
    if (isManual) {
      await client.query(
        "INSERT INTO savings_goal_values (savings_goal_id, value, value_currency) VALUES ($1, $2, $3)",
        [goalId, input.value, input.valueCurrency],
      );
    }
    await client.query("COMMIT");
    revalidatePath("/", "layout");
    return Number(goalId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("Montant cible invalide");
  }
  const resolved = await resolveSavingsGoalSource(
    userId,
    input.source,
    input.period,
    input.categoryId,
    input.accountInternalId,
  );
  const isManual = input.source === "manual";

  const { rowCount } = await pool.query(
    `UPDATE savings_goals
     SET name = $1, target_amount = $2, target_date = $3, notes = $4, period = $5, category_id = $6,
         account_internal_id = $7, updated_at = now()
     WHERE id = $8 AND user_id = $9`,
    [
      name,
      input.targetAmount,
      isManual ? input.targetDate : null,
      input.notes?.trim() || null,
      resolved.period,
      resolved.categoryId,
      resolved.accountInternalId,
      goalId,
      userId,
    ],
  );
  if (rowCount === 0) {
    throw new Error("Objectif invalide");
  }
  revalidatePath("/", "layout");
}

export async function addSavingsGoalValue(goalId: number, value: number, valueCurrency: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valeur invalide");
  }

  const { rows } = await pool.query("SELECT 1 FROM savings_goals WHERE id = $1 AND user_id = $2", [
    goalId,
    userId,
  ]);
  if (rows.length === 0) {
    throw new Error("Objectif invalide");
  }

  await pool.query("INSERT INTO savings_goal_values (savings_goal_id, value, value_currency) VALUES ($1, $2, $3)", [
    goalId,
    value,
    valueCurrency,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteSavingsGoal(goalId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM savings_goals WHERE id = $1 AND user_id = $2", [goalId, userId]);
  revalidatePath("/", "layout");
}

export async function createDebt(input: {
  name: string;
  type: string;
  notes: string | null;
  value: number;
  valueCurrency: string;
}): Promise<number> {
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!DEBT_TYPE_VALUES.has(input.type)) {
    throw new Error("Type invalide");
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("Valeur invalide");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO debts (user_id, name, type, notes) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, name, input.type, input.notes?.trim() || null],
    );
    const debtId = rows[0].id;
    await client.query(
      "INSERT INTO debt_values (debt_id, value, value_currency) VALUES ($1, $2, $3)",
      [debtId, input.value, input.valueCurrency],
    );
    await client.query("COMMIT");
    revalidatePath("/", "layout");
    return Number(debtId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateDebtDetails(
  debtId: number,
  input: { name: string; type: string; notes: string | null },
): Promise<void> {
  const userId = await getCurrentUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom est requis");
  }
  if (!DEBT_TYPE_VALUES.has(input.type)) {
    throw new Error("Type invalide");
  }

  const { rowCount } = await pool.query(
    "UPDATE debts SET name = $1, type = $2, notes = $3, updated_at = now() WHERE id = $4 AND user_id = $5",
    [name, input.type, input.notes?.trim() || null, debtId, userId],
  );
  if (rowCount === 0) {
    throw new Error("Dette invalide");
  }
  revalidatePath("/", "layout");
}

export async function addDebtValue(debtId: number, value: number, valueCurrency: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valeur invalide");
  }

  const { rows } = await pool.query("SELECT 1 FROM debts WHERE id = $1 AND user_id = $2", [
    debtId,
    userId,
  ]);
  if (rows.length === 0) {
    throw new Error("Dette invalide");
  }

  await pool.query("INSERT INTO debt_values (debt_id, value, value_currency) VALUES ($1, $2, $3)", [
    debtId,
    value,
    valueCurrency,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteDebt(debtId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM debts WHERE id = $1 AND user_id = $2", [debtId, userId]);
  revalidatePath("/", "layout");
}

export async function setCashOnHand(value: number, valueCurrency: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valeur invalide");
  }

  await pool.query("INSERT INTO cash_values (user_id, value, value_currency) VALUES ($1, $2, $3)", [
    userId,
    value,
    valueCurrency,
  ]);
  revalidatePath("/", "layout");
}

export async function setVoucherOnHand(value: number, valueCurrency: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Valeur invalide");
  }

  await pool.query("INSERT INTO vacation_voucher_values (user_id, value, value_currency) VALUES ($1, $2, $3)", [
    userId,
    value,
    valueCurrency,
  ]);
  revalidatePath("/", "layout");
}

export async function setBudget(categoryId: number, amount: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }

  const { rows } = await pool.query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [
    categoryId,
    userId,
  ]);
  if (rows.length === 0) {
    throw new Error("Catégorie invalide");
  }

  await pool.query(
    `INSERT INTO budgets (user_id, category_id, amount) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category_id) DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()`,
    [userId, categoryId, amount],
  );
  revalidatePath("/", "layout");
}

export async function deleteBudget(budgetId: number): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM budgets WHERE id = $1 AND user_id = $2", [budgetId, userId]);
  revalidatePath("/", "layout");
}

export async function setDateRangeCookie(from: string | null, to: string | null): Promise<void> {
  const store = await cookies();
  // "Tout" gets its own sentinel value rather than deleting the cookie -
  // an absent cookie means "never chosen" (defaults to the current month),
  // which would otherwise be indistinguishable from an explicit "Tout".
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

export async function createCredentialExchangeRequest(): Promise<{ passphrase: string; expiresAt: string }> {
  const userId = await getCurrentUserId();
  // Copy-pasted into the extension popup, not typed, so length doesn't
  // matter - base64url keeps it free of characters that could get mangled
  // by a paste target (no quotes, slashes, plus signs).
  const passphrase = crypto.randomBytes(18).toString("base64url");

  const { rows } = await pool.query<{ expires_at: Date }>(
    "INSERT INTO credential_exchange_requests (user_id, passphrase) VALUES ($1, $2) RETURNING expires_at",
    [userId, passphrase],
  );
  return { passphrase, expiresAt: rows[0].expires_at.toISOString() };
}

interface ExtensionPayload {
  login?: { identifier?: string; keypad?: string; sessionId?: string };
  account?: { contract_id?: string };
}

export async function submitCredentialPayload(payload: string): Promise<void> {
  const userId = await getCurrentUserId();
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("Collez les informations copiées depuis l'extension");
  }

  const { rows } = await pool.query<{ id: string; passphrase: string }>(
    `SELECT id, passphrase FROM credential_exchange_requests
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const request = rows[0];
  if (!request) {
    throw new Error("La phrase secrète a expiré ou est invalide - générez-en une nouvelle");
  }

  // Mirrors src/worker/script/decrypt.py: the extension compresses the JSON
  // payload with LZString then encrypts it with CryptoJS's passphrase-based
  // AES (OpenSSL-salted format) - using the same two JS libraries here
  // (rather than reimplementing the KDF/cipher) guarantees compatibility.
  let data: ExtensionPayload;
  try {
    const compressed = CryptoJS.AES.decrypt(trimmed, request.passphrase).toString(CryptoJS.enc.Utf8);
    const json = LZString.decompressFromBase64(compressed);
    if (!json) {
      throw new Error("empty");
    }
    data = JSON.parse(json);
  } catch {
    throw new Error("Impossible de déchiffrer ces informations - re-copiez-les depuis l'extension");
  }

  const identifier = data.login?.identifier;
  const keypad = data.login?.keypad;
  const sessionId = data.login?.sessionId;
  const contractId = data.account?.contract_id;
  if (!identifier || !keypad || !sessionId || !contractId) {
    throw new Error("Informations incomplètes - reconnectez-vous à LCL puis recopiez les informations");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Re-encrypted with pgcrypto for storage - same pattern and the same
    // CREDENTIALS_ENCRYPTION_KEY as src/worker/script/seed_credentials.py,
    // which is unrelated to the transport passphrase above. Upserted on
    // user_id (UNIQUE) since this is "their current LCL session", not a
    // history - reconnecting replaces it rather than leaving the worker
    // with multiple, possibly-stale rows to try for the same user.
    await client.query(
      `INSERT INTO lcl_credentials (user_id, identifier, keypad, session_id, contract_id)
       VALUES ($1, pgp_sym_encrypt($2, $6), pgp_sym_encrypt($3, $6), pgp_sym_encrypt($4, $6), pgp_sym_encrypt($5, $6))
       ON CONFLICT (user_id) DO UPDATE SET
         identifier = EXCLUDED.identifier,
         keypad = EXCLUDED.keypad,
         session_id = EXCLUDED.session_id,
         contract_id = EXCLUDED.contract_id,
         updated_at = now()`,
      [userId, identifier, keypad, sessionId, contractId, process.env.CREDENTIALS_ENCRYPTION_KEY],
    );
    await client.query("UPDATE credential_exchange_requests SET used_at = now() WHERE id = $1", [request.id]);
    // Requests an immediate sync rather than waiting for the worker's next
    // 30-minute tick - covers both a brand new connection and a refreshed
    // one (e.g. after the old session expired).
    await client.query("INSERT INTO sync_requests (user_id) VALUES ($1)", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  revalidatePath("/", "layout");
}

export async function completeOnboarding(): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("UPDATE users SET onboarded_at = now() WHERE id = $1", [userId]);
  revalidatePath("/", "layout");
}

// Every table that references users.id (lcl_credentials, categories,
// credential_exchange_requests, accounts -> account_balances/transactions/
// pending_transactions, assets -> asset_values, debts -> debt_values,
// cash_values, budgets, income_predictions) is ON DELETE CASCADE in
// schema.sql, so deleting the row here wipes everything tied to the
// account in one go. Deliberately skips revalidatePath: getCurrentUserId
// auto-provisions a fresh row for the session's email if one doesn't
// exist, so re-rendering the current (app) route before sign-out
// completes would silently recreate the account we just deleted.
export async function deleteAccount(): Promise<void> {
  const userId = await getCurrentUserId();
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function requestSync(): Promise<void> {
  const userId = await getCurrentUserId();

  const hasCredentials = await getHasLclCredentials(userId);
  if (!hasCredentials) {
    throw new Error("Connectez d'abord votre compte LCL depuis Réglages → Compte");
  }

  const { rows } = await pool.query(
    "SELECT 1 FROM sync_requests WHERE user_id = $1 AND status IN ('pending', 'running') LIMIT 1",
    [userId],
  );
  if (rows.length > 0) {
    throw new Error("Une synchronisation est déjà en cours");
  }

  await pool.query("INSERT INTO sync_requests (user_id) VALUES ($1)", [userId]);
  revalidatePath("/", "layout");
}
