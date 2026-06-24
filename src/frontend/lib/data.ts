import "server-only";

import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "./auth";
import { pool } from "./db";
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
  DateRange,
  Debt,
  DebtValuePoint,
  IncomePrediction,
  PendingTransaction,
  PeriodComparison,
  SankeyData,
  SankeyNodeDatum,
  SyncStatus,
  Transaction,
  TransactionFilters,
} from "./types";

interface AccountRow {
  internal_id: string;
  label: string;
  short_label: string;
  type: Account["type"];
  iban: string;
  amount: string | null;
  amount_currency: string | null;
  user_role: string;
  holder_label: string;
  bank_code: string;
  agency_code: string;
  product_type: string;
  account_creation_date: Date;
  bank_label: string | null;
  status: string | null;
}

function mapAccount(row: AccountRow): Account {
  return {
    internalId: row.internal_id,
    label: row.label,
    shortLabel: row.short_label,
    type: row.type,
    iban: row.iban,
    amount: row.amount !== null ? Number(row.amount) : 0,
    amountCurrency: row.amount_currency ?? "EUR",
    userRole: row.user_role,
    holderLabel: row.holder_label,
    bankCode: row.bank_code,
    agencyCode: row.agency_code,
    productType: row.product_type,
    accountCreationDate: row.account_creation_date.toISOString(),
    bankLabel: row.bank_label,
    status: row.status,
  };
}

interface BalanceRow {
  account_internal_id: string;
  amount: string;
  amount_currency: string;
  captured_at: Date;
}

function mapBalance(row: BalanceRow): AccountBalancePoint {
  return {
    accountInternalId: row.account_internal_id,
    amount: Number(row.amount),
    amountCurrency: row.amount_currency,
    capturedAt: row.captured_at.toISOString(),
  };
}

interface TransactionRow {
  row_id: string;
  id: string;
  account_internal_id: string;
  label: string;
  booking_date_time: Date;
  value_date_time: Date | null;
  amount: string;
  amount_currency: string;
  is_accounted: boolean;
  movement_code_type: string;
  nature: string;
  categories: AssignedCategory[];
}

function mapTransaction(row: TransactionRow): Transaction {
  return {
    rowId: Number(row.row_id),
    id: row.id,
    accountInternalId: row.account_internal_id,
    label: row.label,
    bookingDateTime: row.booking_date_time.toISOString(),
    valueDateTime: row.value_date_time ? row.value_date_time.toISOString() : null,
    amount: Number(row.amount),
    amountCurrency: row.amount_currency,
    isAccounted: row.is_accounted,
    movementCodeType: row.movement_code_type,
    nature: row.nature,
    categories: row.categories,
  };
}

interface PendingTransactionRow {
  id: number;
  account_internal_id: string;
  label: string;
  booking_date_time: Date;
  amount: string;
  amount_currency: string;
  nature: string;
}

function mapPendingTransaction(row: PendingTransactionRow): PendingTransaction {
  return {
    id: String(row.id),
    accountInternalId: row.account_internal_id,
    label: row.label,
    bookingDateTime: row.booking_date_time.toISOString(),
    amount: Number(row.amount),
    amountCurrency: row.amount_currency,
    nature: row.nature,
  };
}

// Resolves to the `users` row matching the Authentik session's email -
// middleware already keeps unauthenticated requests out, so a missing
// session here means the email genuinely isn't provisioned (or the JWT
// expired mid-request); seed one with src/worker/script/seed_credentials.py.
export const getCurrentUserId = cache(async (): Promise<number> => {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    throw new Error("Not signed in");
  }

  // Authentik is the actual access gate here - anyone who can sign in is
  // allowed an account, so this provisions a `users` row on first login
  // instead of requiring src/worker/script/seed_credentials.py to run
  // first. New accounts land in onboarding (onboarded_at IS NULL) until
  // they finish or skip it. Upsert avoids a race if this fires twice
  // concurrently for a brand new user.
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [email],
  );
  return Number(rows[0].id);
});

export const getOnboardingStatus = cache(async (userId: number): Promise<{ onboardedAt: string | null }> => {
  const { rows } = await pool.query<{ onboarded_at: Date | null }>(
    "SELECT onboarded_at FROM users WHERE id = $1",
    [userId],
  );
  return { onboardedAt: rows[0]?.onboarded_at ? rows[0].onboarded_at.toISOString() : null };
});

export async function getHasLclCredentials(userId: number): Promise<boolean> {
  const { rows } = await pool.query("SELECT 1 FROM lcl_credentials WHERE user_id = $1 LIMIT 1", [userId]);
  return rows.length > 0;
}

export async function getLatestSyncStatus(userId: number): Promise<SyncStatus | null> {
  const { rows } = await pool.query<{
    status: string;
    error: string | null;
    requested_at: Date;
    started_at: Date | null;
    finished_at: Date | null;
  }>(
    `SELECT status, error, requested_at, started_at, finished_at
     FROM sync_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    status: row.status as SyncStatus["status"],
    error: row.error,
    requestedAt: row.requested_at.toISOString(),
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
  };
}

// accounts has no balance column - the current balance is the latest row
// in account_balances for that account, joined in via LATERAL. The iban is
// masked here so the full number never leaves Postgres, and any "(...)"
// account_users (not a user_id column on accounts) is what scopes this to
// one user - the same account row is shared by every Prisme user who can
// see it (e.g. a joint account), and holder_label/user_role can legitimately
// differ per viewer, so both come from the join rather than from accounts.
const ACCOUNT_SELECT = `
  SELECT a.internal_id, REGEXP_REPLACE(a.label, '\\s*\\([^)]*\\)', '', 'g') AS label, a.short_label, a.type,
         CONCAT(LEFT(REPLACE(a.iban, ' ', ''), 4), ' •••• •••• ', RIGHT(REPLACE(a.iban, ' ', ''), 4)) AS iban,
         au.user_role, au.holder_label, a.bank_code, a.agency_code, a.product_type, a.account_creation_date,
         lb.amount, lb.amount_currency, a.aggregation ->> 'bank_label' AS bank_label, a.aggregation ->> 'status' AS status
  FROM accounts a
  JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
  LEFT JOIN LATERAL (
    SELECT amount, amount_currency
    FROM account_balances b
    WHERE b.account_internal_id = a.internal_id
    ORDER BY b.captured_at DESC
    LIMIT 1
  ) lb ON true
`;

// Holder accounts before others, alphabetical within each group.
const ACCOUNT_ORDER = `ORDER BY a.type, (au.user_role = 'holder') DESC, a.label`;

export async function getAccounts(userId: number): Promise<Account[]> {
  const { rows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} ${ACCOUNT_ORDER}`, [userId]);
  return rows.map(mapAccount);
}

export async function getAccountById(userId: number, internalId: string): Promise<Account | undefined> {
  const { rows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} WHERE a.internal_id = $2`, [
    userId,
    internalId,
  ]);
  return rows[0] ? mapAccount(rows[0]) : undefined;
}

export async function getBalanceHistory(accountInternalId: string): Promise<AccountBalancePoint[]> {
  // The worker can run more than once a day, inserting a new snapshot each
  // time - DISTINCT ON keeps only the latest one per day, same idea as
  // getCombinedBalanceHistory's per-day dedup, just for a single account.
  // Grouped by captured_at (when the worker fetched it) rather than
  // amount_date (the bank's own as-of date): externally aggregated accounts
  // only get refreshed by LCL once a day, so amount_date can lag behind the
  // day we actually captured a fresh snapshot.
  const { rows } = await pool.query<BalanceRow>(
    `SELECT account_internal_id, amount, amount_currency, captured_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', captured_at))
         account_internal_id, amount, amount_currency, captured_at
       FROM account_balances
       WHERE account_internal_id = $1
       ORDER BY date_trunc('day', captured_at), captured_at DESC
     ) latest_per_day
     ORDER BY captured_at ASC`,
    [accountInternalId],
  );
  return rows.map(mapBalance);
}

// A category's own color, or - if unset - the nearest ancestor's, walking
// up from root categories (parent_id IS NULL). root_name/depth exist purely
// to sort children directly under their parent instead of flat-alphabetical.
const CATEGORY_TREE_CTE = `
  WITH RECURSIVE category_tree AS (
    SELECT id, parent_id, name, color, color AS effective_color, name AS root_name, 0 AS depth
    FROM categories
    WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.parent_id, c.name, c.color, COALESCE(c.color, ct.effective_color), ct.root_name, ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
`;

export async function getTransactions(
  userId: number,
  accountInternalId?: string,
  range?: DateRange,
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  const typeFilter = filters?.type === "income" ? "AND t.amount > 0" : filters?.type === "expense" ? "AND t.amount < 0" : "";
  const { rows } = await pool.query<TransactionRow>(
    `${CATEGORY_TREE_CTE}
     SELECT t.row_id, t.id, REGEXP_REPLACE(a.label, '\\s*\\([^)]*\\)', '', 'g') AS account_internal_id, t.label, t.booking_date_time, t.value_date_time,
            t.amount, t.amount_currency, t.is_accounted, t.movement_code_type, t.nature,
            COALESCE(
              jsonb_agg(
                jsonb_build_object('id', ct.id, 'name', ct.name, 'color', ct.effective_color)
                ORDER BY ct.root_name, ct.depth, ct.name
              ) FILTER (WHERE ct.id IS NOT NULL),
              '[]'
            ) AS categories
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     LEFT JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
     LEFT JOIN category_tree ct ON ct.id = tc.category_id
     WHERE ($2::text IS NULL OR t.account_internal_id = $2)
       AND ($3::timestamptz IS NULL OR t.booking_date_time >= $3)
       AND ($4::timestamptz IS NULL OR t.booking_date_time < $4)
       AND ($5::text[] IS NULL OR a.internal_id = ANY($5))
       AND ($6::numeric IS NULL OR ABS(t.amount) >= $6)
       AND ($7::numeric IS NULL OR ABS(t.amount) <= $7)
       AND ($8::text IS NULL OR t.label ILIKE '%' || $8 || '%')
       AND ($9::bigint[] IS NULL OR EXISTS (
         SELECT 1 FROM transaction_categories tc2
         WHERE tc2.transaction_row_id = t.row_id AND tc2.category_id = ANY($9)
       ))
       ${typeFilter}
     GROUP BY t.row_id, t.id, a.label, t.label, t.booking_date_time, t.value_date_time,
              t.amount, t.amount_currency, t.is_accounted, t.movement_code_type, t.nature
     ORDER BY t.booking_date_time DESC, t.row_id DESC`,
    [
      userId,
      accountInternalId ?? null,
      range?.from ?? null,
      range?.to ?? null,
      filters?.accountIds.length ? filters.accountIds : null,
      filters?.amountMin ?? null,
      filters?.amountMax ?? null,
      filters?.search.trim() ? filters.search.trim() : null,
      filters?.categoryIds.length ? filters.categoryIds : null,
    ],
  );
  return rows.map(mapTransaction);
}

export const getCategories = cache(async (userId: number): Promise<Category[]> => {
  // id/parent_id are bigint - pg returns those as strings, so convert explicitly
  // (a raw string here previously broke equality checks against AssignedCategory.id,
  // which goes through jsonb_agg and comes back as a real number).
  const { rows } = await pool.query<{
    id: string;
    parent_id: string | null;
    name: string;
    color: string | null;
    effective_color: string;
  }>(
    `WITH RECURSIVE category_tree AS (
       SELECT id, parent_id, name, color, color AS effective_color, name AS root_name, 0 AS depth
       FROM categories
       WHERE user_id = $1 AND parent_id IS NULL
       UNION ALL
       SELECT c.id, c.parent_id, c.name, c.color, COALESCE(c.color, ct.effective_color), ct.root_name, ct.depth + 1
       FROM categories c
       JOIN category_tree ct ON c.parent_id = ct.id
       WHERE c.user_id = $1
     )
     SELECT id, parent_id, name, color, effective_color
     FROM category_tree
     ORDER BY root_name, depth, name`,
    [userId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    parentId: row.parent_id !== null ? Number(row.parent_id) : null,
    name: row.name,
    color: row.color,
    effectiveColor: row.effective_color,
  }));
});

export async function getPendingTransactions(
  userId: number,
  accountInternalId?: string,
  filters?: TransactionFilters,
): Promise<PendingTransaction[]> {
  // Pending transactions can't carry categories yet (see Transaction vs.
  // PendingTransaction in lib/types.ts) - if the user filtered by category,
  // none of them could ever match, so skip the query entirely.
  if (filters?.categoryIds.length) return [];

  const typeFilter = filters?.type === "income" ? "AND p.amount > 0" : filters?.type === "expense" ? "AND p.amount < 0" : "";
  const { rows } = await pool.query<PendingTransactionRow>(
    `SELECT p.id, REGEXP_REPLACE(a.label, '\\s*\\([^)]*\\)', '', 'g') AS account_internal_id, p.label, p.booking_date_time, p.amount, p.amount_currency, p.nature
     FROM pending_transactions p
     JOIN accounts a ON a.internal_id = p.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     WHERE ($2::text IS NULL OR p.account_internal_id = $2)
       AND ($3::text[] IS NULL OR a.internal_id = ANY($3))
       AND ($4::numeric IS NULL OR ABS(p.amount) >= $4)
       AND ($5::numeric IS NULL OR ABS(p.amount) <= $5)
       AND ($6::text IS NULL OR p.label ILIKE '%' || $6 || '%')
       ${typeFilter}
     ORDER BY p.booking_date_time DESC, p.id DESC`,
    [
      userId,
      accountInternalId ?? null,
      filters?.accountIds.length ? filters.accountIds : null,
      filters?.amountMin ?? null,
      filters?.amountMax ?? null,
      filters?.search.trim() ? filters.search.trim() : null,
    ],
  );
  return rows.map(mapPendingTransaction);
}

export async function getTotals(userId: number): Promise<{ current: number; savings: number; total: number }> {
  const { rows } = await pool.query<{ type: Account["type"]; total: string }>(
    `WITH latest_balance AS (
       SELECT DISTINCT ON (account_internal_id) account_internal_id, amount
       FROM account_balances
       ORDER BY account_internal_id, captured_at DESC
     )
     SELECT a.type, COALESCE(SUM(lb.amount), 0) AS total
     FROM accounts a
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     LEFT JOIN latest_balance lb ON lb.account_internal_id = a.internal_id
     GROUP BY a.type`,
    [userId],
  );
  const current = Number(rows.find((row) => row.type === "current")?.total ?? 0);
  const savings = Number(rows.find((row) => row.type === "saving")?.total ?? 0);
  return { current, savings, total: current + savings };
}

const UNCATEGORIZED_NAME = "Non catégorisé";
const UNCATEGORIZED_COLOR = "#94a3b8";
const MAX_PIE_SLICES = 6;

function rootOfCategory(category: Category, byId: Map<number, Category>): Category {
  let current = category;
  while (current.parentId !== null) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

async function getCategoryAmountBreakdown(
  userId: number,
  direction: "expense" | "income",
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  const categories = await getCategories(userId);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const amountFilter = direction === "expense" ? "t.amount < 0" : "t.amount > 0";
  // filters.type narrows further on top of direction - e.g. direction
  // "income" with filters.type "expense" is a deliberate contradiction that
  // should yield an empty breakdown, not be silently ignored.
  const typeFilter = filters?.type === "income" ? "AND t.amount > 0" : filters?.type === "expense" ? "AND t.amount < 0" : "";

  // One row per (transaction, assigned category); a transaction with no
  // category at all still appears once, with category_id NULL, thanks to
  // the LEFT JOIN - that's how "uncategorized" amounts get counted.
  // category_id is bigint - pg returns it as a string, same trap as
  // getCategories(); left un-converted here it'd never match byId's number keys.
  // Main (current) accounts only - savings transfers would otherwise show
  // up as spend/income noise alongside everyday categorized activity.
  // range.to is exclusive, matching the rest of this file's date-window
  // queries (e.g. nextMonthStart in getExpenseComparisons).
  const { rows } = await pool.query<{ row_id: string; amount: string; category_id: string | null }>(
    `SELECT t.row_id, t.amount, tc.category_id
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     LEFT JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
     WHERE a.type = 'current' AND ${amountFilter}
       AND ($2::timestamptz IS NULL OR t.booking_date_time >= $2)
       AND ($3::timestamptz IS NULL OR t.booking_date_time < $3)
       AND ($4::text[] IS NULL OR a.internal_id = ANY($4))
       AND ($5::numeric IS NULL OR ABS(t.amount) >= $5)
       AND ($6::numeric IS NULL OR ABS(t.amount) <= $6)
       AND ($7::text IS NULL OR t.label ILIKE '%' || $7 || '%')
       AND ($8::bigint[] IS NULL OR EXISTS (
         SELECT 1 FROM transaction_categories tc2
         WHERE tc2.transaction_row_id = t.row_id AND tc2.category_id = ANY($8)
       ))
       ${typeFilter}`,
    [
      userId,
      range?.from ?? null,
      range?.to ?? null,
      filters?.accountIds.length ? filters.accountIds : null,
      filters?.amountMin ?? null,
      filters?.amountMax ?? null,
      filters?.search.trim() ? filters.search.trim() : null,
      filters?.categoryIds.length ? filters.categoryIds : null,
    ],
  );

  const byTransaction = new Map<string, { amount: number; categoryIds: number[] }>();
  for (const row of rows) {
    const entry = byTransaction.get(row.row_id) ?? { amount: Number(row.amount), categoryIds: [] };
    if (row.category_id !== null) entry.categoryIds.push(Number(row.category_id));
    byTransaction.set(row.row_id, entry);
  }

  const sliceNames = new Map<string, string>([["uncategorized", UNCATEGORIZED_NAME]]);
  const sliceColors = new Map<string, string>([["uncategorized", UNCATEGORIZED_COLOR]]);
  const pieTotals = new Map<string, number>();

  // A transaction tagged with several categories counts toward each of
  // them - sums across slices can exceed the total when tags overlap, same
  // as the per-transaction badges already allow.
  for (const { amount, categoryIds } of byTransaction.values()) {
    const value = Math.abs(amount);

    if (categoryIds.length === 0) {
      pieTotals.set("uncategorized", (pieTotals.get("uncategorized") ?? 0) + value);
      continue;
    }

    for (const categoryId of categoryIds) {
      const category = byId.get(categoryId);
      if (!category) continue;
      // Detailed mode breaks out each tagged category on its own (mostly
      // second-level/child categories in practice), instead of always
      // rolling up to its root.
      const target = detailed ? category : rootOfCategory(category, byId);
      const key = `cat:${target.id}`;

      sliceNames.set(key, target.name);
      sliceColors.set(key, target.effectiveColor);
      pieTotals.set(key, (pieTotals.get(key) ?? 0) + value);
    }
  }

  const pieAll = Array.from(pieTotals.entries())
    .map(([key, amount]) => ({
      name: sliceNames.get(key) ?? key,
      color: sliceColors.get(key) ?? UNCATEGORIZED_COLOR,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (pieAll.length <= MAX_PIE_SLICES) {
    return pieAll;
  }
  return [
    ...pieAll.slice(0, MAX_PIE_SLICES - 1),
    {
      name: "Autres",
      color: "#cbd5e1",
      amount:
        Math.round(pieAll.slice(MAX_PIE_SLICES - 1).reduce((sum, slice) => sum + slice.amount, 0) * 100) / 100,
    },
  ];
}

export async function getCategorySpendingBreakdown(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  return getCategoryAmountBreakdown(userId, "expense", range, detailed, filters);
}

export async function getCategoryIncomeBreakdown(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<CategorySpendingSlice[]> {
  return getCategoryAmountBreakdown(userId, "income", range, detailed, filters);
}

const FLOW_TOTAL_KEY = "total";
const FLOW_TOTAL_NAME = "Total";
const FLOW_TOTAL_COLOR = "#64748b";
const FLOW_SAVINGS_KEY = "savings";
const FLOW_SAVINGS_NAME = "Épargne";
const FLOW_SAVINGS_COLOR = "#22c55e";
const FLOW_INCOME_UNCATEGORIZED_KEY = "income:uncategorized";
const FLOW_EXPENSE_UNCATEGORIZED_KEY = "expense:uncategorized";

export async function getIncomeExpenseFlow(
  userId: number,
  range?: DateRange,
  detailed?: boolean,
  filters?: TransactionFilters,
): Promise<SankeyData> {
  const categories = await getCategories(userId);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const typeFilter = filters?.type === "income" ? "AND t.amount > 0" : filters?.type === "expense" ? "AND t.amount < 0" : "";

  // Main (current) accounts only - same reasoning as getCategoryAmountBreakdown.
  const { rows } = await pool.query<{ row_id: string; amount: string; category_id: string | null }>(
    `SELECT t.row_id, t.amount, tc.category_id
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     LEFT JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
     WHERE a.type = 'current'
       AND ($2::timestamptz IS NULL OR t.booking_date_time >= $2)
       AND ($3::timestamptz IS NULL OR t.booking_date_time < $3)
       AND ($4::text[] IS NULL OR a.internal_id = ANY($4))
       AND ($5::numeric IS NULL OR ABS(t.amount) >= $5)
       AND ($6::numeric IS NULL OR ABS(t.amount) <= $6)
       AND ($7::text IS NULL OR t.label ILIKE '%' || $7 || '%')
       AND ($8::bigint[] IS NULL OR EXISTS (
         SELECT 1 FROM transaction_categories tc2
         WHERE tc2.transaction_row_id = t.row_id AND tc2.category_id = ANY($8)
       ))
       ${typeFilter}`,
    [
      userId,
      range?.from ?? null,
      range?.to ?? null,
      filters?.accountIds.length ? filters.accountIds : null,
      filters?.amountMin ?? null,
      filters?.amountMax ?? null,
      filters?.search.trim() ? filters.search.trim() : null,
      filters?.categoryIds.length ? filters.categoryIds : null,
    ],
  );

  const byTransaction = new Map<string, { amount: number; categoryIds: number[] }>();
  for (const row of rows) {
    const entry = byTransaction.get(row.row_id) ?? { amount: Number(row.amount), categoryIds: [] };
    if (row.category_id !== null) entry.categoryIds.push(Number(row.category_id));
    byTransaction.set(row.row_id, entry);
  }

  const nodeNames = new Map<string, string>([
    [FLOW_TOTAL_KEY, FLOW_TOTAL_NAME],
    [FLOW_SAVINGS_KEY, FLOW_SAVINGS_NAME],
    [FLOW_INCOME_UNCATEGORIZED_KEY, "Revenus non catégorisés"],
    [FLOW_EXPENSE_UNCATEGORIZED_KEY, UNCATEGORIZED_NAME],
  ]);
  const nodeColors = new Map<string, string>([
    [FLOW_TOTAL_KEY, FLOW_TOTAL_COLOR],
    [FLOW_SAVINGS_KEY, FLOW_SAVINGS_COLOR],
    [FLOW_INCOME_UNCATEGORIZED_KEY, UNCATEGORIZED_COLOR],
    [FLOW_EXPENSE_UNCATEGORIZED_KEY, UNCATEGORIZED_COLOR],
  ]);
  const incomeTotals = new Map<string, number>();
  const expenseTotals = new Map<string, number>();
  // Detailed mode: per-child totals, plus which root each child rolls up
  // into, so an extra child<->root hop can be inserted on either side
  // (income flows leaf -> root -> Total, expenses Total -> root -> leaf).
  const childTotals = new Map<string, number>();
  const childParent = new Map<string, string>();

  for (const { amount, categoryIds } of byTransaction.values()) {
    if (amount === 0) continue;
    const isIncome = amount > 0;
    const value = Math.abs(amount);
    const side = isIncome ? "income" : "expense";
    const totals = isIncome ? incomeTotals : expenseTotals;
    const uncategorizedKey = isIncome ? FLOW_INCOME_UNCATEGORIZED_KEY : FLOW_EXPENSE_UNCATEGORIZED_KEY;

    if (categoryIds.length === 0) {
      totals.set(uncategorizedKey, (totals.get(uncategorizedKey) ?? 0) + value);
      continue;
    }

    for (const categoryId of categoryIds) {
      const category = byId.get(categoryId);
      if (!category) continue;
      const root = rootOfCategory(category, byId);
      const rootKey = `${side}:${root.id}`;

      nodeNames.set(rootKey, root.name);
      nodeColors.set(rootKey, root.effectiveColor);
      totals.set(rootKey, (totals.get(rootKey) ?? 0) + value);

      if (detailed && category.id !== root.id) {
        const childKey = `${side}:child:${category.id}`;
        nodeNames.set(childKey, category.name);
        nodeColors.set(childKey, category.effectiveColor);
        childTotals.set(childKey, (childTotals.get(childKey) ?? 0) + value);
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

  const totalIncome = Array.from(incomeTotals.values()).reduce((sum, value) => sum + value, 0);
  const totalExpense = Array.from(expenseTotals.values()).reduce((sum, value) => sum + value, 0);
  const savings = totalIncome - totalExpense;
  if (savings > 0) {
    nodeKeys.add(FLOW_SAVINGS_KEY);
    links.push({ source: FLOW_TOTAL_KEY, target: FLOW_SAVINGS_KEY, value: Math.round(savings * 100) / 100 });
  }

  if (links.length === 0) {
    return { nodes: [], links: [] };
  }

  nodeKeys.add(FLOW_TOTAL_KEY);
  const nodeKeyList = Array.from(nodeKeys);
  const nodeIndex = new Map(nodeKeyList.map((key, index) => [key, index]));

  return {
    nodes: nodeKeyList.map((key) => {
      const isChild = key.includes(":child:");
      let kind: SankeyNodeDatum["kind"];
      if (key === FLOW_TOTAL_KEY) {
        kind = "root";
      } else if (key === FLOW_SAVINGS_KEY || key === FLOW_EXPENSE_UNCATEGORIZED_KEY) {
        // Always terminal on the expense side - never broken down further.
        kind = "leaf";
      } else if (key.startsWith("income:")) {
        kind = "source";
      } else if (isChild) {
        kind = "leaf";
      } else {
        // An expense category root: rightmost (leaf) unless detailed mode
        // adds a child column after it.
        kind = detailed ? "root" : "leaf";
      }
      return {
        name: nodeNames.get(key) ?? key,
        color: nodeColors.get(key) ?? UNCATEGORIZED_COLOR,
        kind,
      };
    }),
    links: links.map((link) => ({
      source: nodeIndex.get(link.source) ?? 0,
      target: nodeIndex.get(link.target) ?? 0,
      value: link.value,
    })),
  };
}

export async function getCombinedBalanceHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  // Per account, per day, keep only the latest snapshot of that day, then
  // sum across accounts - keeps this correct regardless of how many times
  // a day the worker runs. Grouped by captured_at rather than amount_date -
  // see getBalanceHistory for why amount_date isn't reliable for this.
  const { rows } = await pool.query<{ day: Date; balance: string }>(
    `WITH daily AS (
       SELECT
         date_trunc('day', b.captured_at) AS day,
         b.amount,
         ROW_NUMBER() OVER (
           PARTITION BY a.internal_id, date_trunc('day', b.captured_at)
           ORDER BY b.captured_at DESC
         ) AS rn
       FROM account_balances b
       JOIN accounts a ON a.internal_id = b.account_internal_id
       JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
       WHERE ($2::timestamptz IS NULL OR b.captured_at >= $2)
         AND ($3::timestamptz IS NULL OR b.captured_at < $3)
     )
     SELECT day, SUM(amount) AS balance
     FROM daily
     WHERE rn = 1
     GROUP BY day
     ORDER BY day ASC`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  return rows.map((row) => ({ date: row.day.toISOString(), balance: Number(row.balance) }));
}

interface AssetRow {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  value: string | null;
  value_currency: string | null;
  valued_at: Date | null;
}

function mapAsset(row: AssetRow): Asset {
  return {
    id: Number(row.id),
    name: row.name,
    type: row.type,
    notes: row.notes,
    value: row.value !== null ? Number(row.value) : 0,
    valueCurrency: row.value_currency ?? "EUR",
    valuedAt: row.valued_at ? row.valued_at.toISOString() : new Date(0).toISOString(),
  };
}

// assets has no value column - the current value is the latest row in
// asset_values for that asset, joined in via LATERAL (mirrors accounts).
const ASSET_SELECT = `
  SELECT a.id, a.name, a.type, a.notes, av.value, av.value_currency, av.valued_at
  FROM assets a
  LEFT JOIN LATERAL (
    SELECT value, value_currency, valued_at
    FROM asset_values v
    WHERE v.asset_id = a.id
    ORDER BY v.valued_at DESC
    LIMIT 1
  ) av ON true
`;

export async function getAssets(userId: number): Promise<Asset[]> {
  const { rows } = await pool.query<AssetRow>(
    `${ASSET_SELECT} WHERE a.user_id = $1 ORDER BY a.name`,
    [userId],
  );
  return rows.map(mapAsset);
}

export async function getAssetById(userId: number, assetId: number): Promise<Asset | undefined> {
  const { rows } = await pool.query<AssetRow>(`${ASSET_SELECT} WHERE a.user_id = $1 AND a.id = $2`, [
    userId,
    assetId,
  ]);
  return rows[0] ? mapAsset(rows[0]) : undefined;
}

export async function getAssetValueHistory(assetId: number): Promise<AssetValuePoint[]> {
  // Same per-day dedup as getBalanceHistory - keeps only the latest value
  // snapshot per day if more than one was recorded that day.
  const { rows } = await pool.query<{
    asset_id: string;
    value: string;
    value_currency: string;
    valued_at: Date;
  }>(
    `SELECT asset_id, value, value_currency, valued_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', valued_at))
         asset_id, value, value_currency, valued_at
       FROM asset_values
       WHERE asset_id = $1
       ORDER BY date_trunc('day', valued_at), valued_at DESC
     ) latest_per_day
     ORDER BY valued_at ASC`,
    [assetId],
  );
  return rows.map((row) => ({
    assetId: Number(row.asset_id),
    value: Number(row.value),
    valueCurrency: row.value_currency,
    valuedAt: row.valued_at.toISOString(),
  }));
}

export async function getTotalAssetsValue(userId: number): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(av.value), 0) AS total
     FROM assets a
     LEFT JOIN LATERAL (
       SELECT value FROM asset_values v WHERE v.asset_id = a.id ORDER BY v.valued_at DESC LIMIT 1
     ) av ON true
     WHERE a.user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getCombinedAssetValueHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  // Per asset, per day, keep only the latest snapshot of that day, then sum
  // across assets - same approach as getCombinedBalanceHistory.
  const { rows } = await pool.query<{ day: Date; total: string }>(
    `WITH daily AS (
       SELECT
         date_trunc('day', v.valued_at) AS day,
         v.value,
         ROW_NUMBER() OVER (
           PARTITION BY a.id, date_trunc('day', v.valued_at)
           ORDER BY v.valued_at DESC
         ) AS rn
       FROM asset_values v
       JOIN assets a ON a.id = v.asset_id
       WHERE a.user_id = $1
         AND ($2::timestamptz IS NULL OR v.valued_at >= $2)
         AND ($3::timestamptz IS NULL OR v.valued_at < $3)
     )
     SELECT day, SUM(value) AS total
     FROM daily
     WHERE rn = 1
     GROUP BY day
     ORDER BY day ASC`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  return rows.map((row) => ({ date: row.day.toISOString(), balance: Number(row.total) }));
}

interface DebtRow {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  value: string | null;
  value_currency: string | null;
  valued_at: Date | null;
}

function mapDebt(row: DebtRow): Debt {
  return {
    id: Number(row.id),
    name: row.name,
    type: row.type,
    notes: row.notes,
    value: row.value !== null ? Number(row.value) : 0,
    valueCurrency: row.value_currency ?? "EUR",
    valuedAt: row.valued_at ? row.valued_at.toISOString() : new Date(0).toISOString(),
  };
}

// debts has no value column - the current value is the latest row in
// debt_values for that debt, joined in via LATERAL (mirrors assets).
const DEBT_SELECT = `
  SELECT d.id, d.name, d.type, d.notes, dv.value, dv.value_currency, dv.valued_at
  FROM debts d
  LEFT JOIN LATERAL (
    SELECT value, value_currency, valued_at
    FROM debt_values v
    WHERE v.debt_id = d.id
    ORDER BY v.valued_at DESC
    LIMIT 1
  ) dv ON true
`;

export async function getDebts(userId: number): Promise<Debt[]> {
  const { rows } = await pool.query<DebtRow>(`${DEBT_SELECT} WHERE d.user_id = $1 ORDER BY d.name`, [
    userId,
  ]);
  return rows.map(mapDebt);
}

export async function getDebtById(userId: number, debtId: number): Promise<Debt | undefined> {
  const { rows } = await pool.query<DebtRow>(`${DEBT_SELECT} WHERE d.user_id = $1 AND d.id = $2`, [
    userId,
    debtId,
  ]);
  return rows[0] ? mapDebt(rows[0]) : undefined;
}

export async function getDebtValueHistory(debtId: number): Promise<DebtValuePoint[]> {
  // Same per-day dedup as getAssetValueHistory.
  const { rows } = await pool.query<{
    debt_id: string;
    value: string;
    value_currency: string;
    valued_at: Date;
  }>(
    `SELECT debt_id, value, value_currency, valued_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', valued_at))
         debt_id, value, value_currency, valued_at
       FROM debt_values
       WHERE debt_id = $1
       ORDER BY date_trunc('day', valued_at), valued_at DESC
     ) latest_per_day
     ORDER BY valued_at ASC`,
    [debtId],
  );
  return rows.map((row) => ({
    debtId: Number(row.debt_id),
    value: Number(row.value),
    valueCurrency: row.value_currency,
    valuedAt: row.valued_at.toISOString(),
  }));
}

export async function getTotalDebtsValue(userId: number): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(dv.value), 0) AS total
     FROM debts d
     LEFT JOIN LATERAL (
       SELECT value FROM debt_values v WHERE v.debt_id = d.id ORDER BY v.valued_at DESC LIMIT 1
     ) dv ON true
     WHERE d.user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getCombinedDebtValueHistory(
  userId: number,
  range?: DateRange,
): Promise<{ date: string; balance: number }[]> {
  // Per debt, per day, keep only the latest snapshot of that day, then sum
  // across debts - same approach as getCombinedAssetValueHistory.
  const { rows } = await pool.query<{ day: Date; total: string }>(
    `WITH daily AS (
       SELECT
         date_trunc('day', v.valued_at) AS day,
         v.value,
         ROW_NUMBER() OVER (
           PARTITION BY d.id, date_trunc('day', v.valued_at)
           ORDER BY v.valued_at DESC
         ) AS rn
       FROM debt_values v
       JOIN debts d ON d.id = v.debt_id
       WHERE d.user_id = $1
         AND ($2::timestamptz IS NULL OR v.valued_at >= $2)
         AND ($3::timestamptz IS NULL OR v.valued_at < $3)
     )
     SELECT day, SUM(value) AS total
     FROM daily
     WHERE rn = 1
     GROUP BY day
     ORDER BY day ASC`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  return rows.map((row) => ({ date: row.day.toISOString(), balance: Number(row.total) }));
}

export async function getCashOnHand(userId: number): Promise<CashValuePoint | null> {
  const { rows } = await pool.query<{ value: string; value_currency: string; valued_at: Date }>(
    "SELECT value, value_currency, valued_at FROM cash_values WHERE user_id = $1 ORDER BY valued_at DESC LIMIT 1",
    [userId],
  );
  if (rows.length === 0) {
    return null;
  }
  return {
    value: Number(rows[0].value),
    valueCurrency: rows[0].value_currency,
    valuedAt: rows[0].valued_at.toISOString(),
  };
}

export async function getCashHistory(userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  // Same per-day dedup as getAssetValueHistory/getDebtValueHistory, and same
  // range filter as getCombinedDebtValueHistory.
  const { rows } = await pool.query<{ value: string; value_currency: string; valued_at: Date }>(
    `SELECT value, value_currency, valued_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', valued_at))
         value, value_currency, valued_at
       FROM cash_values
       WHERE user_id = $1
         AND ($2::timestamptz IS NULL OR valued_at >= $2)
         AND ($3::timestamptz IS NULL OR valued_at < $3)
       ORDER BY date_trunc('day', valued_at), valued_at DESC
     ) latest_per_day
     ORDER BY valued_at ASC`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  return rows.map((row) => ({
    value: Number(row.value),
    valueCurrency: row.value_currency,
    valuedAt: row.valued_at.toISOString(),
  }));
}

export async function getVoucherOnHand(userId: number): Promise<CashValuePoint | null> {
  const { rows } = await pool.query<{ value: string; value_currency: string; valued_at: Date }>(
    "SELECT value, value_currency, valued_at FROM vacation_voucher_values WHERE user_id = $1 ORDER BY valued_at DESC LIMIT 1",
    [userId],
  );
  if (rows.length === 0) {
    return null;
  }
  return {
    value: Number(rows[0].value),
    valueCurrency: rows[0].value_currency,
    valuedAt: rows[0].valued_at.toISOString(),
  };
}

export async function getVoucherHistory(userId: number, range?: DateRange): Promise<CashValuePoint[]> {
  // Same per-day dedup as getCashHistory.
  const { rows } = await pool.query<{ value: string; value_currency: string; valued_at: Date }>(
    `SELECT value, value_currency, valued_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', valued_at))
         value, value_currency, valued_at
       FROM vacation_voucher_values
       WHERE user_id = $1
         AND ($2::timestamptz IS NULL OR valued_at >= $2)
         AND ($3::timestamptz IS NULL OR valued_at < $3)
       ORDER BY date_trunc('day', valued_at), valued_at DESC
     ) latest_per_day
     ORDER BY valued_at ASC`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  return rows.map((row) => ({
    value: Number(row.value),
    valueCurrency: row.value_currency,
    valuedAt: row.valued_at.toISOString(),
  }));
}

export async function getBudgets(userId: number, range?: DateRange): Promise<Budget[]> {
  const [{ rows: budgetRows }, categories] = await Promise.all([
    pool.query<{ id: string; category_id: string; amount: string }>(
      "SELECT id, category_id, amount FROM budgets WHERE user_id = $1",
      [userId],
    ),
    getCategories(userId),
  ]);

  if (budgetRows.length === 0) return [];

  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenOf = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenOf.set(category.parentId, siblings);
  }

  // A budget on a category covers that category's own spend plus any
  // descendants' (e.g. a "Transport" budget also counts spend tagged
  // "Essence" underneath it) - same rollup convention as the spending
  // breakdown charts use when aggregating up to root categories.
  function descendantsOf(categoryId: number): number[] {
    const ids = [categoryId];
    for (const childId of childrenOf.get(categoryId) ?? []) {
      ids.push(...descendantsOf(childId));
    }
    return ids;
  }

  // Spend per category for the selected period - defaults to the current
  // calendar month when no range is picked (a budget's natural period),
  // but follows the header's global range filter when one is active, so
  // "spent" reflects "spent during the selected period" instead. category_id
  // is bigint, same pg-string trap as elsewhere, converted below.
  const { rows: spendRows } = await pool.query<{ category_id: string; spent: string }>(
    `SELECT tc.category_id, SUM(ABS(t.amount)) AS spent
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
     WHERE t.amount < 0
       AND t.booking_date_time >= COALESCE($2::timestamptz, date_trunc('month', now()))
       AND t.booking_date_time < COALESCE($3::timestamptz, date_trunc('month', now()) + interval '1 month')
     GROUP BY tc.category_id`,
    [userId, range?.from ?? null, range?.to ?? null],
  );
  const spendByCategory = new Map(spendRows.map((row) => [Number(row.category_id), Number(row.spent)]));

  return budgetRows
    .map((row) => {
      const category = byId.get(Number(row.category_id));
      if (!category) return null;
      const spent = descendantsOf(category.id).reduce((sum, id) => sum + (spendByCategory.get(id) ?? 0), 0);
      return {
        id: Number(row.id),
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.effectiveColor,
        amount: Number(row.amount),
        spent: Math.round(spent * 100) / 100,
      };
    })
    .filter((budget): budget is Budget => budget !== null)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

export async function getIncomePrediction(userId: number): Promise<IncomePrediction | null> {
  const { rows } = await pool.query<{ period_month: Date; predicted_amount: string }>(
    `SELECT period_month, predicted_amount FROM income_predictions
     WHERE user_id = $1 AND period_month = date_trunc('month', now())::date`,
    [userId],
  );
  if (rows.length === 0) return null;

  // Matches the worker's _forecast_income query: current accounts only (so
  // a transfer into savings doesn't get counted as income on both ends),
  // and excludes "Remboursement"-tagged transactions (refunds aren't real
  // income, and would otherwise skew actual-vs-expected).
  const { rows: actualRows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     WHERE t.amount > 0 AND a.type = 'current'
       AND t.booking_date_time >= date_trunc('month', now())
       AND NOT EXISTS (
         SELECT 1 FROM transaction_categories tc
         JOIN categories c ON c.id = tc.category_id
         WHERE tc.transaction_row_id = t.row_id AND LOWER(c.name) = 'remboursement'
       )`,
    [userId],
  );

  const predictedAmount = Number(rows[0].predicted_amount);
  const actualSoFar = Number(actualRows[0]?.total ?? 0);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedSoFar = Math.round(((predictedAmount * now.getDate()) / daysInMonth) * 100) / 100;

  return {
    periodMonth: rows[0].period_month.toISOString(),
    predictedAmount,
    actualSoFar,
    expectedSoFar,
  };
}

// Main (current) accounts only, same convention as the rest of Insights;
// excludeRemboursement mirrors getIncomePrediction for income totals.
async function getAmountTotal(
  userId: number,
  direction: "expense" | "income",
  start: Date,
  end: Date,
  excludeRemboursement: boolean,
): Promise<number> {
  const amountFilter = direction === "expense" ? "t.amount < 0" : "t.amount > 0";
  const exclusion = excludeRemboursement
    ? `AND NOT EXISTS (
         SELECT 1 FROM transaction_categories tc
         JOIN categories c ON c.id = tc.category_id
         WHERE tc.transaction_row_id = t.row_id AND LOWER(c.name) = 'remboursement'
       )`
    : "";

  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     WHERE a.type = 'current' AND ${amountFilter}
       AND t.booking_date_time >= $2 AND t.booking_date_time < $3
       ${exclusion}`,
    [userId, start, end],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getExpenseComparisons(
  userId: number,
): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const [monthlyCurrent, monthlyPrevious, yearlyCurrent, yearlyPrevious] = await Promise.all([
    getAmountTotal(userId, "expense", monthStart, nextMonthStart, false),
    getAmountTotal(userId, "expense", prevMonthStart, monthStart, false),
    getAmountTotal(userId, "expense", yearStart, nextYearStart, false),
    getAmountTotal(userId, "expense", prevYearStart, yearStart, false),
  ]);

  return {
    monthly: { current: monthlyCurrent, previous: monthlyPrevious },
    yearly: { current: yearlyCurrent, previous: yearlyPrevious },
  };
}

export async function getIncomeComparisons(
  userId: number,
): Promise<{ monthly: PeriodComparison; yearly: PeriodComparison }> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const [monthlyCurrent, monthlyPrevious, yearlyCurrent, yearlyPrevious] = await Promise.all([
    getAmountTotal(userId, "income", monthStart, nextMonthStart, true),
    getAmountTotal(userId, "income", prevMonthStart, monthStart, true),
    getAmountTotal(userId, "income", yearStart, nextYearStart, true),
    getAmountTotal(userId, "income", prevYearStart, yearStart, true),
  ]);

  return {
    monthly: { current: monthlyCurrent, previous: monthlyPrevious },
    yearly: { current: yearlyCurrent, previous: yearlyPrevious },
  };
}

export async function getSavingsComparison(userId: number): Promise<PeriodComparison> {
  const categories = await getCategories(userId);
  // Matched by name regardless of where it sits in the tree - "Epargne" may
  // be a root or nested under another category depending on how the user
  // has organized things.
  const savingsCategory = categories.find((category) => category.name.toLowerCase() === "epargne");
  if (!savingsCategory) {
    return { current: 0, previous: 0 };
  }

  const childrenOf = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenOf.set(category.parentId, siblings);
  }
  function descendantsOf(categoryId: number): number[] {
    const ids = [categoryId];
    for (const childId of childrenOf.get(categoryId) ?? []) {
      ids.push(...descendantsOf(childId));
    }
    return ids;
  }
  const categoryIds = descendantsOf(savingsCategory.id);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  async function totalFor(start: Date, end: Date): Promise<number> {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
       FROM transactions t
       JOIN accounts a ON a.internal_id = t.account_internal_id
       JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
       JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
       WHERE a.type = 'current'
         AND tc.category_id = ANY($2::bigint[])
         AND t.booking_date_time >= $3 AND t.booking_date_time < $4`,
      [userId, categoryIds, start, end],
    );
    return Number(rows[0]?.total ?? 0);
  }

  const [current, previous] = await Promise.all([
    totalFor(monthStart, nextMonthStart),
    totalFor(prevMonthStart, monthStart),
  ]);
  return { current, previous };
}
