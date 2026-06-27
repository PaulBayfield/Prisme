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
  CategoryUseCase,
  DateRange,
  Debt,
  DebtValuePoint,
  IncomePrediction,
  PendingTransaction,
  PeriodComparison,
  PredictedCategory,
  SankeyData,
  SankeyNodeDatum,
  SavingsGoal,
  SavingsGoalValuePoint,
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
  predicted_categories: PredictedCategory[];
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
    predictedCategories: row.predicted_categories,
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

interface SyncRequestRow {
  id: string;
  status: string;
  error: string | null;
  requested_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

function mapSyncRequest(row: SyncRequestRow): SyncStatus {
  return {
    id: Number(row.id),
    status: row.status as SyncStatus["status"],
    error: row.error,
    requestedAt: row.requested_at.toISOString(),
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
  };
}

export async function getLatestSyncStatus(userId: number): Promise<SyncStatus | null> {
  const { rows } = await pool.query<SyncRequestRow>(
    `SELECT id, status, error, requested_at, started_at, finished_at
     FROM sync_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  return row ? mapSyncRequest(row) : null;
}

// The worker's run log, most recent first - this is what the Monitoring
// page lists so a user can see whether their last several syncs actually
// succeeded, not just the single latest one getLatestSyncStatus exposes.
export async function getSyncRequests(userId: number, limit = 50): Promise<SyncStatus[]> {
  const { rows } = await pool.query<SyncRequestRow>(
    `SELECT id, status, error, requested_at, started_at, finished_at
     FROM sync_requests
     WHERE user_id = $1
     ORDER BY requested_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map(mapSyncRequest);
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
// Scoped to $1 (userId) in both arms - unscoped, this would recursively
// build every user's category tree on every call instead of just the
// current one's (the only ones that could ever match via the join anyway,
// since transaction_categories.category_id always belongs to the same user
// who categorized that transaction).
const CATEGORY_TREE_CTE = `
  WITH RECURSIVE category_tree AS (
    SELECT id, parent_id, name, color, color AS effective_color, name AS root_name, 0 AS depth
    FROM categories
    WHERE user_id = $1 AND parent_id IS NULL
    UNION ALL
    SELECT c.id, c.parent_id, c.name, c.color, COALESCE(c.color, ct.effective_color), ct.root_name, ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
    WHERE c.user_id = $1
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
            COALESCE(cat_agg.categories, '[]') AS categories,
            COALESCE(pred_agg.predicted_categories, '[]') AS predicted_categories
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     -- Each aggregate runs in its own LATERAL rather than a single
     -- GROUP BY over both LEFT JOINs - a transaction with, say, 2 assigned
     -- categories and 3 pending predictions would otherwise fan out into 6
     -- joined rows, and a single jsonb_agg per column would count each side
     -- 3x/2x too many times.
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(
         jsonb_build_object('id', ct.id, 'name', ct.name, 'color', ct.effective_color)
         ORDER BY ct.root_name, ct.depth, ct.name
       ) AS categories
       FROM transaction_categories tc
       JOIN category_tree ct ON ct.id = tc.category_id
       WHERE tc.transaction_row_id = t.row_id
     ) cat_agg ON true
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(
         jsonb_build_object('id', pct.id, 'name', pct.name, 'color', pct.effective_color, 'confidence', tcp.confidence)
         ORDER BY tcp.confidence DESC
       ) AS predicted_categories
       FROM transaction_category_predictions tcp
       JOIN category_tree pct ON pct.id = tcp.category_id
       WHERE tcp.transaction_row_id = t.row_id
     ) pred_agg ON true
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

// Which of the user's own categories feed each built-in use case (see
// category_use_cases in schema.sql) - powers the Settings pickers, and is
// the user-configurable replacement for what used to be hardcoded category
// names (e.g. LOWER(c.name) = 'salaire') across the income forecast,
// income totals, and savings widgets.
export const getCategoryUseCases = cache(
  async (userId: number): Promise<Record<CategoryUseCase, AssignedCategory[]>> => {
    const [categories, { rows }] = await Promise.all([
      getCategories(userId),
      pool.query<{ use_case: CategoryUseCase; category_id: string }>(
        "SELECT use_case, category_id FROM category_use_cases WHERE user_id = $1",
        [userId],
      ),
    ]);
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const result: Record<CategoryUseCase, AssignedCategory[]> = {
      income_forecast: [],
      income_exclude: [],
      savings: [],
    };
    for (const row of rows) {
      const category = categoryById.get(Number(row.category_id));
      if (!category) continue;
      result[row.use_case].push({ id: category.id, name: category.name, color: category.effectiveColor });
    }
    for (const useCase of Object.keys(result) as CategoryUseCase[]) {
      result[useCase].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  },
);

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

function buildCategoryChildrenMap(categories: Category[]): Map<number, number[]> {
  const childrenOf = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category.id);
    childrenOf.set(category.parentId, siblings);
  }
  return childrenOf;
}

// A category rollup covers its own id plus every descendant's (e.g. a
// "Transport" budget or savings goal also counts activity tagged "Essence"
// underneath it) - same convention the spending breakdown charts use when
// aggregating up to root categories.
function descendantsOf(categoryId: number, childrenOf: Map<number, number[]>): number[] {
  const ids = [categoryId];
  for (const childId of childrenOf.get(categoryId) ?? []) {
    ids.push(...descendantsOf(childId, childrenOf));
  }
  return ids;
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

  // A transaction tagged with several categories splits its amount evenly
  // across them, so slices always sum back to the real total instead of
  // double-counting overlapping tags.
  for (const { amount, categoryIds } of byTransaction.values()) {
    const value = Math.abs(amount);

    if (categoryIds.length === 0) {
      pieTotals.set("uncategorized", (pieTotals.get("uncategorized") ?? 0) + value);
      continue;
    }

    const share = value / categoryIds.length;
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

    // Split evenly across tagged categories - same reasoning as
    // getCategoryAmountBreakdown, so the Total/savings nodes derived from
    // these sums don't inflate when a transaction carries multiple tags.
    const share = value / categoryIds.length;
    for (const categoryId of categoryIds) {
      const category = byId.get(categoryId);
      if (!category) continue;
      const root = rootOfCategory(category, byId);
      const rootKey = `${side}:${root.id}`;

      nodeNames.set(rootKey, root.name);
      nodeColors.set(rootKey, root.effectiveColor);
      totals.set(rootKey, (totals.get(rootKey) ?? 0) + share);

      if (detailed && category.id !== root.id) {
        const childKey = `${side}:child:${category.id}`;
        nodeNames.set(childKey, category.name);
        nodeColors.set(childKey, category.effectiveColor);
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

interface SavingsGoalDefRow {
  id: string;
  name: string;
  target_amount: string;
  target_date: Date | null;
  notes: string | null;
  period: string;
  category_id: string | null;
  category_name: string | null;
  account_internal_id: string | null;
  account_label: string | null;
}

interface SavingsGoalOnceValueRow {
  savings_goal_id: string;
  value: string;
  value_currency: string;
  valued_at: Date;
}

function savingsGoalSource(row: SavingsGoalDefRow): SavingsGoal["source"] {
  if (row.category_id !== null) return "category";
  if (row.account_internal_id !== null) return "account";
  return "manual";
}

const SAVINGS_GOAL_DEF_SELECT = `
  SELECT g.id, g.name, g.target_amount, g.target_date, g.notes, g.period, g.category_id, c.name AS category_name,
         g.account_internal_id, REGEXP_REPLACE(a.label, '\\s*\\([^)]*\\)', '', 'g') AS account_label
  FROM savings_goals g
  LEFT JOIN categories c ON c.id = g.category_id
  LEFT JOIN accounts a ON a.internal_id = g.account_internal_id
`;

// "monthly"/"yearly" goals track progress against the current calendar
// period, recomputed live - never stored, unlike "once" goals' manual
// snapshots in savings_goal_values.
function currentPeriodRange(period: "monthly" | "yearly"): DateRange {
  const now = new Date();
  if (period === "yearly") {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}

async function getCurrentPeriodTotal(
  userId: number,
  categoryIds: number[],
  period: "monthly" | "yearly",
  accountInternalId: string | null,
): Promise<number> {
  const range = currentPeriodRange(period);
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS total
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
     WHERE tc.category_id = ANY($2::bigint[])
       AND t.booking_date_time >= $3 AND t.booking_date_time < $4
       AND ($5::text IS NULL OR t.account_internal_id = $5)`,
    [userId, categoryIds, range.from, range.to, accountInternalId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function resolveSavingsGoals(userId: number, defRows: SavingsGoalDefRow[]): Promise<SavingsGoal[]> {
  if (defRows.length === 0) return [];

  const manualIds = defRows.filter((row) => savingsGoalSource(row) === "manual").map((row) => Number(row.id));
  const manualValues = manualIds.length
    ? await pool.query<SavingsGoalOnceValueRow>(
        `SELECT savings_goal_id, value, value_currency, valued_at
         FROM (
           SELECT DISTINCT ON (savings_goal_id) savings_goal_id, value, value_currency, valued_at
           FROM savings_goal_values
           WHERE savings_goal_id = ANY($1::bigint[])
           ORDER BY savings_goal_id, valued_at DESC
         ) latest
         `,
        [manualIds],
      )
    : { rows: [] };
  const manualValueById = new Map(manualValues.rows.map((row) => [Number(row.savings_goal_id), row]));

  const categoryRows = defRows.filter((row) => savingsGoalSource(row) === "category");
  let categoryTotals = new Map<number, number>();
  if (categoryRows.length > 0) {
    const categories = await getCategories(userId);
    const childrenOf = buildCategoryChildrenMap(categories);
    const totals = await Promise.all(
      categoryRows.map((row) =>
        getCurrentPeriodTotal(
          userId,
          descendantsOf(Number(row.category_id), childrenOf),
          row.period as "monthly" | "yearly",
          row.account_internal_id,
        ),
      ),
    );
    categoryTotals = new Map(categoryRows.map((row, index) => [Number(row.id), totals[index]]));
  }

  const accountRows = defRows.filter((row) => savingsGoalSource(row) === "account");
  let accountById = new Map<string, Account>();
  if (accountRows.length > 0) {
    const accounts = await getAccounts(userId);
    accountById = new Map(accounts.map((account) => [account.internalId, account]));
  }

  const now = new Date().toISOString();
  return defRows.map((row) => {
    const id = Number(row.id);
    const source = savingsGoalSource(row);
    const manualValue = manualValueById.get(id);
    const linkedAccount = row.account_internal_id ? accountById.get(row.account_internal_id) : undefined;

    let value = 0;
    let valueCurrency = "EUR";
    let valuedAt = new Date(0).toISOString();
    if (source === "manual") {
      value = manualValue ? Number(manualValue.value) : 0;
      valueCurrency = manualValue?.value_currency ?? "EUR";
      valuedAt = manualValue ? manualValue.valued_at.toISOString() : valuedAt;
    } else if (source === "category") {
      value = categoryTotals.get(id) ?? 0;
      valuedAt = now;
    } else {
      value = linkedAccount?.amount ?? 0;
      valueCurrency = linkedAccount?.amountCurrency ?? "EUR";
      valuedAt = now;
    }

    return {
      id,
      name: row.name,
      targetAmount: Number(row.target_amount),
      targetDate: row.target_date ? row.target_date.toISOString() : null,
      notes: row.notes,
      period: row.period as SavingsGoal["period"],
      source,
      categoryId: row.category_id !== null ? Number(row.category_id) : null,
      categoryName: row.category_name,
      accountInternalId: row.account_internal_id,
      accountLabel: row.account_label,
      value,
      valueCurrency,
      valuedAt,
    };
  });
}

export async function getSavingsGoals(userId: number): Promise<SavingsGoal[]> {
  const { rows } = await pool.query<SavingsGoalDefRow>(
    `${SAVINGS_GOAL_DEF_SELECT} WHERE g.user_id = $1 ORDER BY g.name`,
    [userId],
  );
  return resolveSavingsGoals(userId, rows);
}

export async function getSavingsGoalById(userId: number, goalId: number): Promise<SavingsGoal | undefined> {
  const { rows } = await pool.query<SavingsGoalDefRow>(
    `${SAVINGS_GOAL_DEF_SELECT} WHERE g.user_id = $1 AND g.id = $2`,
    [userId, goalId],
  );
  const resolved = await resolveSavingsGoals(userId, rows);
  return resolved[0];
}

export async function getSavingsGoalValueHistory(goalId: number): Promise<SavingsGoalValuePoint[]> {
  // Same per-day dedup as getAssetValueHistory.
  const { rows } = await pool.query<{
    savings_goal_id: string;
    value: string;
    value_currency: string;
    valued_at: Date;
  }>(
    `SELECT savings_goal_id, value, value_currency, valued_at
     FROM (
       SELECT DISTINCT ON (date_trunc('day', valued_at))
         savings_goal_id, value, value_currency, valued_at
       FROM savings_goal_values
       WHERE savings_goal_id = $1
       ORDER BY date_trunc('day', valued_at), valued_at DESC
     ) latest_per_day
     ORDER BY valued_at ASC`,
    [goalId],
  );
  return rows.map((row) => ({
    savingsGoalId: Number(row.savings_goal_id),
    value: Number(row.value),
    valueCurrency: row.value_currency,
    valuedAt: row.valued_at.toISOString(),
  }));
}

export async function getTotalSavingsGoalsValue(userId: number): Promise<number> {
  const goals = await getSavingsGoals(userId);
  return goals.reduce((sum, goal) => sum + goal.value, 0);
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
  const childrenOf = buildCategoryChildrenMap(categories);

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
      const spent = descendantsOf(category.id, childrenOf).reduce((sum, id) => sum + (spendByCategory.get(id) ?? 0), 0);
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
  // scoped to whichever categories the user picked for the "income_forecast"
  // use case (gifts, interest, internal transfers, and other one-off income
  // aren't part of the predicted trend, and would otherwise skew
  // actual-vs-expected).
  const { rows: actualRows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN accounts a ON a.internal_id = t.account_internal_id
     JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
     WHERE t.amount > 0 AND a.type = 'current'
       AND t.booking_date_time >= date_trunc('month', now())
       AND EXISTS (
         SELECT 1 FROM transaction_categories tc
         WHERE tc.transaction_row_id = t.row_id
           AND tc.category_id IN (
             SELECT category_id FROM category_use_cases WHERE user_id = $1 AND use_case = 'income_forecast'
           )
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
// excludeReimbursements mirrors getIncomePrediction for income totals,
// scoped to whichever categories the user picked for the "income_exclude"
// use case (refunds aren't real income, and would otherwise skew totals).
async function getAmountTotal(
  userId: number,
  direction: "expense" | "income",
  start: Date,
  end: Date,
  excludeReimbursements: boolean,
): Promise<number> {
  const amountFilter = direction === "expense" ? "t.amount < 0" : "t.amount > 0";
  const exclusion = excludeReimbursements
    ? `AND NOT EXISTS (
         SELECT 1 FROM transaction_categories tc
         WHERE tc.transaction_row_id = t.row_id
           AND tc.category_id IN (
             SELECT category_id FROM category_use_cases WHERE user_id = $1 AND use_case = 'income_exclude'
           )
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
  // Whichever categories the user picked for the "savings" use case - a
  // flat list, not auto-expanded to descendants, so a transaction tagged
  // with a child of a selected category only counts if that child was
  // picked too.
  const { rows: useCaseRows } = await pool.query<{ category_id: string }>(
    "SELECT category_id FROM category_use_cases WHERE user_id = $1 AND use_case = 'savings'",
    [userId],
  );
  const categoryIds = useCaseRows.map((row) => Number(row.category_id));
  if (categoryIds.length === 0) {
    return { current: 0, previous: 0 };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const savingsCategoryIds = new Set(categoryIds);

  // Fetches every category tagged on a matching transaction (not just the
  // savings ones) so a transaction split between a savings category and
  // something else only contributes its savings share, same splitting rule
  // as getCategoryAmountBreakdown - otherwise a transaction tagged with both
  // "Epargne" and a child category would be summed twice.
  async function totalFor(start: Date, end: Date): Promise<number> {
    const { rows } = await pool.query<{ row_id: string; amount: string; category_id: string }>(
      `SELECT t.row_id, t.amount, tc.category_id
       FROM transactions t
       JOIN accounts a ON a.internal_id = t.account_internal_id
       JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
       JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
       WHERE a.type = 'current'
         AND t.booking_date_time >= $2 AND t.booking_date_time < $3
         AND EXISTS (
           SELECT 1 FROM transaction_categories tc2
           WHERE tc2.transaction_row_id = t.row_id AND tc2.category_id = ANY($4::bigint[])
         )`,
      [userId, start, end, categoryIds],
    );

    const byTransaction = new Map<string, { amount: number; categoryCount: number; savingsCount: number }>();
    for (const row of rows) {
      const entry = byTransaction.get(row.row_id) ?? { amount: Number(row.amount), categoryCount: 0, savingsCount: 0 };
      entry.categoryCount += 1;
      if (savingsCategoryIds.has(Number(row.category_id))) entry.savingsCount += 1;
      byTransaction.set(row.row_id, entry);
    }

    let total = 0;
    for (const { amount, categoryCount, savingsCount } of byTransaction.values()) {
      total += (Math.abs(amount) / categoryCount) * savingsCount;
    }
    return Math.round(total * 100) / 100;
  }

  const [current, previous] = await Promise.all([
    totalFor(monthStart, nextMonthStart),
    totalFor(prevMonthStart, monthStart),
  ]);
  return { current, previous };
}
