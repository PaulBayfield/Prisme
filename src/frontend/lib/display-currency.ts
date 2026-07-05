import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { getExchangeRates } from "./exchange-rate";

export const DISPLAY_CURRENCY_COOKIE = "prisme-display-currency";

// All amounts are stored in EUR (see schema.sql defaults) - this reads the
// user's chosen display currency from a cookie (set via
// setDisplayCurrencyCookie in lib/actions.ts, same pattern as
// date-range.ts/transaction-filters.ts) and resolves the EUR -> code rate
// once per request. Wrapped in React's cache() so every server component
// that calls this independently (cards, tables, pages) shares one lookup
// instead of re-fetching per component.
export const getDisplayCurrency = cache(async (): Promise<{ code: string; rate: number }> => {
  const store = await cookies();
  const code = store.get(DISPLAY_CURRENCY_COOKIE)?.value || "EUR";

  if (code === "EUR") {
    return { code: "EUR", rate: 1 };
  }

  // This runs on every page that displays money, so a third-party API
  // hiccup must degrade to showing EUR-equivalent amounts (mislabeled with
  // the chosen code until the next successful fetch) rather than throwing
  // and breaking every page that calls this.
  try {
    const { rates } = await getExchangeRates("EUR");
    return { code, rate: rates[code] ?? 1 };
  } catch {
    return { code, rate: 1 };
  }
});
