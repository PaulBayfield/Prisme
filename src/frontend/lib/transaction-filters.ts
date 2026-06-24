import "server-only";

import { cookies } from "next/headers";

import type { TransactionFilters } from "./types";

export const FILTERS_COOKIE_NAME = "prisme-filters";

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  categoryIds: [],
  type: "all",
  accountIds: [],
  amountMin: null,
  amountMax: null,
  search: "",
};

function parseTransactionFilters(raw: string): TransactionFilters {
  try {
    const parsed = JSON.parse(raw) as Partial<TransactionFilters>;
    return {
      categoryIds: Array.isArray(parsed.categoryIds)
        ? parsed.categoryIds.filter((id): id is number => typeof id === "number")
        : [],
      type: parsed.type === "income" || parsed.type === "expense" ? parsed.type : "all",
      accountIds: Array.isArray(parsed.accountIds)
        ? parsed.accountIds.filter((id): id is string => typeof id === "string")
        : [],
      amountMin: typeof parsed.amountMin === "number" ? parsed.amountMin : null,
      amountMax: typeof parsed.amountMax === "number" ? parsed.amountMax : null,
      search: typeof parsed.search === "string" ? parsed.search : "",
    };
  } catch {
    return EMPTY_TRANSACTION_FILTERS;
  }
}

// The filter panel lives in the site header, not in any one page's URL, so
// the selection is persisted as a cookie (set via setTransactionFiltersCookie
// in lib/actions.ts) instead - same reasoning, and same mechanism, as
// RANGE_COOKIE_NAME in date-range.ts.
export async function getTransactionFiltersFromCookies(): Promise<TransactionFilters> {
  const store = await cookies();
  const raw = store.get(FILTERS_COOKIE_NAME)?.value;
  if (!raw) return EMPTY_TRANSACTION_FILTERS;
  return parseTransactionFilters(raw);
}
